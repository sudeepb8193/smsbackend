import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { EffectivePermissionResolverService } from '../../role-permission/services/effective-permission-resolver.service';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { LeaveAccessHelper } from '../utils/leave-access.util';
import { LeaveCalculatorUtil } from '../utils/leave-calculator.util';
import { InitializeBalanceDto } from '../dto/initialize-balance.dto';
import { AdjustBalanceDto } from '../dto/adjust-balance.dto';
import { QueryBalanceDto } from '../dto/query-balance.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class LeaveBalanceService {
  private readonly logger = new Logger(LeaveBalanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionResolver: EffectivePermissionResolverService,
  ) {}

  /**
   * Task 9.2: Authoritative Balance Calculation helper
   */
  calculateAvailableBalance(balance: {
    openingBalanceDays: Prisma.Decimal | number;
    carriedForwardDays: Prisma.Decimal | number;
    accruedDays: Prisma.Decimal | number;
    usedDays: Prisma.Decimal | number;
    manualAdjustmentDays: Prisma.Decimal | number;
  }): number {
    const opening = Number(balance.openingBalanceDays) || 0;
    const carried = Number(balance.carriedForwardDays) || 0;
    const accrued = Number(balance.accruedDays) || 0;
    const used = Number(balance.usedDays) || 0;
    const adjustment = Number(balance.manualAdjustmentDays) || 0;

    const available = opening + carried + accrued + adjustment - used;
    return Math.round(available * 10) / 10;
  }

  /**
   * Task 9.2: Initialize Balances for Staff & Leave Types for a Given Year
   */
  async initializeStaffBalances(
    user: AuthenticatedUser,
    dto: InitializeBalanceDto,
    queryOrgId?: string,
  ) {
    const orgId = LeaveAccessHelper.resolveOrgId(user, queryOrgId);
    const staff = await LeaveAccessHelper.validateStaff(this.prisma, dto.staffId, orgId);

    await LeaveAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      orgId,
      'staff_leave.manage',
      staff.homeBranchId,
      staff,
    );

    const year = dto.balanceYear || new Date().getFullYear();

    // Fetch active leave types for org
    const leaveTypeWhere: Prisma.sms_leaveTypesWhereInput = {
      organizationId: orgId,
      status: 'active',
    };
    if (dto.leaveTypeId) {
      leaveTypeWhere.id = dto.leaveTypeId;
    }

    const leaveTypes = await this.prisma.sms_leaveTypes.findMany({
      where: leaveTypeWhere,
    });

    if (leaveTypes.length === 0) {
      throw new NotFoundException({
        code: 'NO_LEAVE_TYPES',
        message: 'No active leave types found for initialization',
      });
    }

    const results: any[] = [];

    // Find staff joining date
    const firstEmployment = await this.prisma.sms_staffEmploymentHistory.findFirst({
      where: { staffId: staff.id },
      orderBy: { effectiveFrom: 'asc' },
    });
    const joiningDate = firstEmployment?.effectiveFrom || staff.createdAt;

    for (const lt of leaveTypes) {
      // Check gender applicability
      if (lt.applicableGender !== 'all' && staff.gender) {
        if (lt.applicableGender !== staff.gender) {
          continue; // Skip not applicable gender
        }
      }

      // Check existing balance record
      const existing = await this.prisma.sms_staffLeaveBalances.findUnique({
        where: {
          staffId_leaveTypeId_balanceYear: {
            staffId: staff.id,
            leaveTypeId: lt.id,
            balanceYear: year,
          },
        },
      });

      if (existing) {
        results.push({ ...existing, isNew: false });
        continue;
      }

      // Calculate initial entitlement based on accrual method and joining date
      let openingDays = 0;
      const annualDays = Number(lt.annualEntitlementDays) || 0;

      if (lt.accrualMethod === 'annual_grant') {
        openingDays = LeaveCalculatorUtil.calculateProRataEntitlement(
          new Date(joiningDate),
          annualDays,
          year,
        );
      }

      const created = await this.prisma.sms_staffLeaveBalances.create({
        data: {
          staffId: staff.id,
          leaveTypeId: lt.id,
          balanceYear: year,
          openingBalanceDays: new Prisma.Decimal(openingDays),
          carriedForwardDays: new Prisma.Decimal(0),
          accruedDays: new Prisma.Decimal(0),
          usedDays: new Prisma.Decimal(0),
          manualAdjustmentDays: new Prisma.Decimal(0),
          closingBalanceDays: new Prisma.Decimal(openingDays),
        },
        include: {
          leaveType: { select: { id: true, name: true, code: true, isPaid: true } },
        },
      });

      // Record transaction
      if (openingDays > 0) {
        await this.recordBalanceTransaction({
          balanceId: created.id,
          staffId: staff.id,
          leaveTypeId: lt.id,
          balanceYear: year,
          transactionType: 'ANNUAL_GRANT',
          amount: openingDays,
          beforeBalance: 0,
          afterBalance: openingDays,
          reason: `Annual leave grant initialization for year ${year}`,
          actorId: user.id,
        });
      }

      results.push({ ...created, isNew: true });
    }

    return {
      message: `Initialized ${results.filter((r) => r.isNew).length} balances for ${staff.fullName}`,
      year,
      balances: results,
    };
  }

  /**
   * Task 9.2: Manual Balance Adjustment (Positive or Negative with Mandatory Reason & Audit)
   */
  async adjustStaffBalance(
    user: AuthenticatedUser,
    dto: AdjustBalanceDto,
    queryOrgId?: string,
  ) {
    const orgId = LeaveAccessHelper.resolveOrgId(user, queryOrgId);
    const staff = await LeaveAccessHelper.validateStaff(this.prisma, dto.staffId, orgId);

    await LeaveAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      orgId,
      'staff_leave.manage',
      staff.homeBranchId,
      staff,
    );

    const year = dto.balanceYear || new Date().getFullYear();
    const adjustmentAmount = Math.round(Number(dto.adjustmentDays) * 10) / 10;

    if (adjustmentAmount === 0) {
      throw new BadRequestException({
        code: 'INVALID_ADJUSTMENT',
        message: 'Adjustment amount cannot be zero',
      });
    }

    // Locate or create balance record
    let balance = await this.prisma.sms_staffLeaveBalances.findUnique({
      where: {
        staffId_leaveTypeId_balanceYear: {
          staffId: staff.id,
          leaveTypeId: dto.leaveTypeId,
          balanceYear: year,
        },
      },
    });

    if (!balance) {
      // Auto-initialize balance record if absent
      balance = await this.prisma.sms_staffLeaveBalances.create({
        data: {
          staffId: staff.id,
          leaveTypeId: dto.leaveTypeId,
          balanceYear: year,
          openingBalanceDays: new Prisma.Decimal(0),
          carriedForwardDays: new Prisma.Decimal(0),
          accruedDays: new Prisma.Decimal(0),
          usedDays: new Prisma.Decimal(0),
          manualAdjustmentDays: new Prisma.Decimal(0),
          closingBalanceDays: new Prisma.Decimal(0),
        },
      });
    }

    const beforeBalance = this.calculateAvailableBalance(balance);
    const currentAdjustments = Number(balance.manualAdjustmentDays) || 0;
    const newAdjustments = Math.round((currentAdjustments + adjustmentAmount) * 10) / 10;
    const newClosing = Math.round((beforeBalance + adjustmentAmount) * 10) / 10;

    const [updatedBalance] = await this.prisma.$transaction([
      this.prisma.sms_staffLeaveBalances.update({
        where: { id: balance.id },
        data: {
          manualAdjustmentDays: new Prisma.Decimal(newAdjustments),
          closingBalanceDays: new Prisma.Decimal(newClosing),
        },
        include: {
          leaveType: { select: { id: true, name: true, code: true, isPaid: true } },
          staff: { select: { id: true, fullName: true, employeeCode: true } },
        },
      }),
    ]);

    // Record auditable balance transaction ledger
    await this.recordBalanceTransaction({
      balanceId: balance.id,
      staffId: staff.id,
      leaveTypeId: dto.leaveTypeId,
      balanceYear: year,
      transactionType: 'MANUAL_ADJUSTMENT',
      amount: adjustmentAmount,
      beforeBalance,
      afterBalance: newClosing,
      reason: dto.reason.trim(),
      actorId: user.id,
    });

    await LeaveAccessHelper.recordAuditLog(
      this.prisma,
      orgId,
      user.id,
      'LEAVE_BALANCE_MANUALLY_ADJUSTED',
      { beforeBalance, manualAdjustmentDays: currentAdjustments },
      {
        afterBalance: newClosing,
        manualAdjustmentDays: newAdjustments,
        adjustmentAmount,
        reason: dto.reason,
      },
    );

    return {
      message: `Balance adjusted by ${adjustmentAmount > 0 ? '+' : ''}${adjustmentAmount} days`,
      balance: updatedBalance,
      beforeBalance,
      afterBalance: newClosing,
      transaction: {
        amount: adjustmentAmount,
        reason: dto.reason,
        actorId: user.id,
        timestamp: new Date(),
      },
    };
  }

  /**
   * Task 9.2: Helper to ensure active, gender-applicable leave balances exist for a staff member.
   * Auto-provisions missing balances with pro-rata entitlement.
   * Also repairs legacy zero-opening balances if no manual adjustment was made.
   */
  async ensureStaffBalances(
    staff: { id: string; gender?: string | null; createdAt: Date; employmentHistory?: any[] },
    organizationId: string,
    year: number,
    actorId?: string,
  ): Promise<void> {
    const leaveTypes = await this.prisma.sms_leaveTypes.findMany({
      where: {
        organizationId,
        status: 'active',
      },
    });

    if (!leaveTypes.length) return;

    let joiningDate = staff.createdAt;
    if (staff.employmentHistory && staff.employmentHistory.length > 0) {
      joiningDate = staff.employmentHistory[0]?.effectiveFrom || staff.createdAt;
    } else {
      const firstEmployment = await this.prisma.sms_staffEmploymentHistory.findFirst({
        where: { staffId: staff.id },
        orderBy: { effectiveFrom: 'asc' },
      });
      if (firstEmployment?.effectiveFrom) {
        joiningDate = firstEmployment.effectiveFrom;
      }
    }

    for (const lt of leaveTypes) {
      if (lt.applicableGender !== 'all' && staff.gender) {
        if (lt.applicableGender !== staff.gender) {
          continue;
        }
      }

      const existing = await this.prisma.sms_staffLeaveBalances.findUnique({
        where: {
          staffId_leaveTypeId_balanceYear: {
            staffId: staff.id,
            leaveTypeId: lt.id,
            balanceYear: year,
          },
        },
      });

      const annualDays = Number(lt.annualEntitlementDays) || 0;
      let entitledDays = 0;
      if (lt.accrualMethod === 'annual_grant') {
        entitledDays = LeaveCalculatorUtil.calculateProRataEntitlement(
          new Date(joiningDate),
          annualDays,
          year,
        );
      }

      if (!existing) {
        const created = await this.prisma.sms_staffLeaveBalances.create({
          data: {
            staffId: staff.id,
            leaveTypeId: lt.id,
            balanceYear: year,
            openingBalanceDays: new Prisma.Decimal(entitledDays),
            carriedForwardDays: new Prisma.Decimal(0),
            accruedDays: new Prisma.Decimal(0),
            usedDays: new Prisma.Decimal(0),
            manualAdjustmentDays: new Prisma.Decimal(0),
            closingBalanceDays: new Prisma.Decimal(entitledDays),
          },
        });

        if (entitledDays > 0) {
          await this.recordBalanceTransaction({
            balanceId: created.id,
            staffId: staff.id,
            leaveTypeId: lt.id,
            balanceYear: year,
            transactionType: 'ANNUAL_GRANT',
            amount: entitledDays,
            beforeBalance: 0,
            afterBalance: entitledDays,
            reason: `Auto-initialized pro-rata entitlement for year ${year}`,
            actorId: actorId || undefined,
          });
        }
      } else if (
        Number(existing.openingBalanceDays) === 0 &&
        Number(existing.manualAdjustmentDays) === 0 &&
        Number(existing.carriedForwardDays) === 0 &&
        entitledDays > 0
      ) {
        // Auto-heal legacy uninitialized opening balance
        const used = Number(existing.usedDays) || 0;
        const newClosing = Math.round((entitledDays - used) * 10) / 10;
        await this.prisma.sms_staffLeaveBalances.update({
          where: { id: existing.id },
          data: {
            openingBalanceDays: new Prisma.Decimal(entitledDays),
            closingBalanceDays: new Prisma.Decimal(newClosing),
          },
        });

        await this.recordBalanceTransaction({
          balanceId: existing.id,
          staffId: staff.id,
          leaveTypeId: lt.id,
          balanceYear: year,
          transactionType: 'SYSTEM_CORRECTION',
          amount: entitledDays,
          beforeBalance: Number(existing.closingBalanceDays),
          afterBalance: newClosing,
          reason: `Auto-healed legacy zero-opening balance with pro-rata entitlement for year ${year}`,
          actorId: actorId || undefined,
        });
      }
    }
  }

  /**
   * Task 9.2: Self-Service Current Staff Balances (For Service Staff Workspace)
   */
  async getMyBalances(
    user: AuthenticatedUser,
    year?: number,
    queryOrgId?: string,
  ) {
    const orgId = LeaveAccessHelper.resolveOrgId(user, queryOrgId);
    const balanceYear = year || new Date().getFullYear();

    const staff = await LeaveAccessHelper.getStaffForUserSafe(this.prisma, user.id, orgId);
    if (!staff) {
      return {
        staff: null,
        year: balanceYear,
        balances: [],
        items: [],
        data: [],
        total: 0,
        hasStaffProfile: false,
      };
    }

    // Auto-provision and heal missing balances
    await this.ensureStaffBalances(staff, orgId, balanceYear, user.id);

    const balances = await this.prisma.sms_staffLeaveBalances.findMany({
      where: {
        staffId: staff.id,
        balanceYear,
      },
      include: {
        leaveType: {
          select: {
            id: true,
            name: true,
            code: true,
            isPaid: true,
            accrualMethod: true,
            annualEntitlementDays: true,
            monthlyAccrualDays: true,
            maxCarryForwardDays: true,
            documentRequiredAfterDays: true,
            minNoticeDays: true,
            status: true,
          },
        },
      },
      orderBy: { leaveType: { name: 'asc' } },
    });

    // Also compute pending days requested for each leave type
    const pendingRequests = await this.prisma.sms_staffLeaveRequests.findMany({
      where: {
        staffId: staff.id,
        status: 'pending',
        startDate: {
          gte: new Date(Date.UTC(balanceYear, 0, 1)),
          lte: new Date(Date.UTC(balanceYear, 11, 31)),
        },
      },
      select: {
        leaveTypeId: true,
        totalDays: true,
      },
    });

    const pendingMap = new Map<string, number>();
    for (const pr of pendingRequests) {
      const curr = pendingMap.get(pr.leaveTypeId) || 0;
      pendingMap.set(pr.leaveTypeId, curr + Number(pr.totalDays));
    }

    const items = balances.map((b) => {
      const available = this.calculateAvailableBalance(b);
      const pendingDays = pendingMap.get(b.leaveTypeId) || 0;
      const opening = Number(b.openingBalanceDays);
      const carried = Number(b.carriedForwardDays);
      const accrued = Number(b.accruedDays);
      const entitledDays = opening + carried + accrued;
      return {
        ...b,
        openingBalanceDays: opening,
        carriedForwardDays: carried,
        accruedDays: accrued,
        usedDays: Number(b.usedDays),
        manualAdjustmentDays: Number(b.manualAdjustmentDays),
        closingBalanceDays: available,
        availableDays: available,
        entitledDays,
        annualEntitlementDays: Number(b.leaveType?.annualEntitlementDays || 0),
        pendingDays,
        netProjectedDays: Math.max(0, available - pendingDays),
      };
    });

    return {
      staff: {
        id: staff.id,
        fullName: staff.fullName,
        employeeCode: staff.employeeCode,
        homeBranch: staff.homeBranch,
      },
      year: balanceYear,
      balances: items,
      items,
      data: items,
      total: items.length,
      hasStaffProfile: true,
    };
  }

  /**
   * Task 9.2: Admin / Manager Staff Leave Balances List (Paginated & Filtered)
   */
  async listStaffBalances(
    user: AuthenticatedUser,
    query: QueryBalanceDto,
    queryOrgId?: string,
  ) {
    const orgId = LeaveAccessHelper.resolveOrgId(user, queryOrgId);
    await LeaveAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      orgId,
      'staff_leave.view',
      query.branchId,
    );

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const balanceYear = query.year || new Date().getFullYear();

    const staffWhere: Prisma.sms_staffWhereInput = {
      organizationId: orgId,
      deletedAt: null,
    };

    if (query.branchId) {
      staffWhere.homeBranchId = query.branchId;
    }

    if (query.search) {
      const s = query.search.trim();
      staffWhere.OR = [
        { fullName: { contains: s, mode: 'insensitive' } },
        { employeeCode: { contains: s, mode: 'insensitive' } },
      ];
    }

    const where: Prisma.sms_staffLeaveBalancesWhereInput = {
      balanceYear,
      staff: staffWhere,
    };

    if (query.staffId) {
      where.staffId = query.staffId;
    }

    if (query.leaveTypeId) {
      where.leaveTypeId = query.leaveTypeId;
    }

    const sortOrder: Prisma.SortOrder = query.sortOrder === 'desc' ? 'desc' : 'asc';
    let orderBy: Prisma.sms_staffLeaveBalancesOrderByWithRelationInput[];
    switch (query.sortBy) {
      case 'closingBalanceDays':
        orderBy = [{ closingBalanceDays: sortOrder }];
        break;
      case 'usedDays':
        orderBy = [{ usedDays: sortOrder }];
        break;
      case 'accruedDays':
        orderBy = [{ accruedDays: sortOrder }];
        break;
      case 'openingBalanceDays':
        orderBy = [{ openingBalanceDays: sortOrder }];
        break;
      case 'balanceYear':
        orderBy = [{ balanceYear: sortOrder }];
        break;
      case 'createdAt':
        orderBy = [{ createdAt: sortOrder }];
        break;
      case 'staffName':
      default:
        orderBy = [{ staff: { fullName: sortOrder } }, { leaveType: { name: 'asc' } }];
        break;
    }

    const [items, total] = await Promise.all([
      this.prisma.sms_staffLeaveBalances.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          staff: {
            select: {
              id: true,
              fullName: true,
              employeeCode: true,
              homeBranch: { select: { id: true, name: true, code: true } },
            },
          },
          leaveType: {
            select: {
              id: true,
              name: true,
              code: true,
              isPaid: true,
              accrualMethod: true,
            },
          },
        },
      }),
      this.prisma.sms_staffLeaveBalances.count({ where }),
    ]);

    const formatted = items.map((b) => {
      const opening = Number(b.openingBalanceDays);
      const carried = Number(b.carriedForwardDays);
      const accrued = Number(b.accruedDays);
      const entitledDays = opening + carried + accrued;
      return {
        ...b,
        openingBalanceDays: opening,
        carriedForwardDays: carried,
        accruedDays: accrued,
        usedDays: Number(b.usedDays),
        manualAdjustmentDays: Number(b.manualAdjustmentDays),
        entitledDays,
        availableDays: this.calculateAvailableBalance(b),
      };
    });

    return {
      items: formatted,
      data: formatted,
      total,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        year: balanceYear,
      },
    };
  }

  /**
   * Task 9.2: Balance Transaction History
   */
  async getBalanceTransactions(
    user: AuthenticatedUser,
    params: { staffId?: string; leaveTypeId?: string; year?: number },
    queryOrgId?: string,
  ) {
    const orgId = LeaveAccessHelper.resolveOrgId(user, queryOrgId);
    await LeaveAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      orgId,
      'staff_leave.view',
    );

    const year = params.year || new Date().getFullYear();

    let sql = `
      SELECT t.*, u."displayName" as "actorName", lt."name" as "leaveTypeName", lt."code" as "leaveTypeCode", s."fullName" as "staffName", s."employeeCode"
      FROM "sms_staffLeaveBalanceTransactions" t
      JOIN "sms_staff" s ON t."staffId" = s."id"
      JOIN "sms_leaveTypes" lt ON t."leaveTypeId" = lt."id"
      LEFT JOIN "sms_users" u ON t."actorId" = u."id"
      WHERE s."organizationId" = '${orgId}'::uuid
      AND t."balanceYear" = ${year}
    `;

    if (params.staffId) {
      sql += ` AND t."staffId" = '${params.staffId}'::uuid`;
    }
    if (params.leaveTypeId) {
      sql += ` AND t."leaveTypeId" = '${params.leaveTypeId}'::uuid`;
    }

    sql += ` ORDER BY t."createdAt" DESC LIMIT 100`;

    const txs: any = await this.prisma.$queryRawUnsafe(sql);
    return txs;
  }

  /**
   * Internal helper to record balance transaction in ledger
   */
  async recordBalanceTransaction(data: {
    balanceId: string;
    staffId: string;
    leaveTypeId: string;
    balanceYear: number;
    transactionType: string;
    amount: number;
    beforeBalance: number;
    afterBalance: number;
    reason?: string;
    referencePeriod?: string;
    actorId?: string;
  }) {
    try {
      const sql = `
        INSERT INTO "sms_staffLeaveBalanceTransactions" (
          "id", "balanceId", "staffId", "leaveTypeId", "balanceYear",
          "transactionType", "amount", "beforeBalance", "afterBalance",
          "reason", "referencePeriod", "actorId", "createdAt"
        ) VALUES (
          gen_random_uuid(),
          '${data.balanceId}'::uuid,
          '${data.staffId}'::uuid,
          '${data.leaveTypeId}'::uuid,
          ${data.balanceYear},
          '${data.transactionType}',
          ${data.amount},
          ${data.beforeBalance},
          ${data.afterBalance},
          ${data.reason ? `'${data.reason.replace(/'/g, "''")}'` : 'NULL'},
          ${data.referencePeriod ? `'${data.referencePeriod}'` : 'NULL'},
          ${data.actorId ? `'${data.actorId}'::uuid` : 'NULL'},
          NOW()
        )
      `;
      await this.prisma.$executeRawUnsafe(sql);
    } catch (err: any) {
      this.logger.warn(`Failed to record leave balance transaction: ${err.message}`);
    }
  }
}

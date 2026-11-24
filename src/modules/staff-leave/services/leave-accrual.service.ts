import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { EffectivePermissionResolverService } from '../../role-permission/services/effective-permission-resolver.service';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { LeaveAccessHelper } from '../utils/leave-access.util';
import { LeaveBalanceService } from './leave-balance.service';
import { LeaveNotificationService } from './leave-notification.service';
import { ProcessAccrualDto } from '../dto/process-accrual.dto';
import { ProcessCarryForwardDto } from '../dto/process-carry-forward.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class LeaveAccrualService {
  private readonly logger = new Logger(LeaveAccrualService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionResolver: EffectivePermissionResolverService,
    private readonly balanceService: LeaveBalanceService,
    private readonly notificationService: LeaveNotificationService,
  ) {}

  /**
   * Task 9.2: Process Monthly Accrual with Idempotency and Detailed Logging
   */
  async processMonthlyAccrual(
    user: AuthenticatedUser,
    dto: ProcessAccrualDto,
    queryOrgId?: string,
  ) {
    const orgId = LeaveAccessHelper.resolveOrgId(user, queryOrgId);
    await LeaveAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      orgId,
      'staff_leave.manage',
    );

    const year = dto.year || new Date().getFullYear();
    const month = dto.month || new Date().getMonth() + 1;
    const referencePeriod = `${year}-${String(month).padStart(2, '0')}`;

    this.logger.log(`Starting monthly accrual for Org: ${orgId}, Period: ${referencePeriod}`);

    // Fetch monthly accrual leave types
    const leaveTypes = await this.prisma.sms_leaveTypes.findMany({
      where: {
        organizationId: orgId,
        status: 'active',
        accrualMethod: 'monthly_accrual',
        ...(dto.leaveTypeId ? { id: dto.leaveTypeId } : {}),
      },
    });

    if (leaveTypes.length === 0) {
      return {
        message: 'No active leave types configured for monthly accrual in this organization',
        referencePeriod,
        processedCount: 0,
        skippedCount: 0,
        errors: [],
      };
    }

    // Fetch active staff
    const staffMembers = await this.prisma.sms_staff.findMany({
      where: {
        organizationId: orgId,
        employmentStatus: 'active',
        deletedAt: null,
        ...(dto.staffId ? { id: dto.staffId } : {}),
        ...(dto.branchId
          ? {
              OR: [
                { homeBranchId: dto.branchId },
                { staffBranchAssignments: { some: { branchId: dto.branchId } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        fullName: true,
        employeeCode: true,
        gender: true,
        createdAt: true,
      },
    });

    let processedCount = 0;
    let skippedCount = 0;
    const errors: { staffId: string; staffName: string; error: string }[] = [];
    const successfulDetails: any[] = [];

    for (const staff of staffMembers) {
      for (const lt of leaveTypes) {
        // Gender applicability
        if (lt.applicableGender !== 'all' && staff.gender) {
          if (lt.applicableGender !== staff.gender) {
            continue;
          }
        }

        const monthlyRate = Number(lt.monthlyAccrualDays) || 0;
        if (monthlyRate <= 0) {
          continue;
        }

        try {
          // Check if this month has ALREADY been accrued (Idempotency Check)
          const checkSql = `
            SELECT id FROM "sms_staffLeaveBalanceTransactions"
            WHERE "staffId" = '${staff.id}'::uuid
            AND "leaveTypeId" = '${lt.id}'::uuid
            AND "balanceYear" = ${year}
            AND "transactionType" = 'MONTHLY_ACCRUAL'
            AND "referencePeriod" = '${referencePeriod}'
            LIMIT 1
          `;
          const existingTx: any = await this.prisma.$queryRawUnsafe(checkSql);

          if (existingTx && existingTx.length > 0) {
            skippedCount++;
            continue; // Already accrued for this period
          }

          // Locate or create balance record for this year
          let balance = await this.prisma.sms_staffLeaveBalances.findUnique({
            where: {
              staffId_leaveTypeId_balanceYear: {
                staffId: staff.id,
                leaveTypeId: lt.id,
                balanceYear: year,
              },
            },
          });

          if (!balance) {
            balance = await this.prisma.sms_staffLeaveBalances.create({
              data: {
                staffId: staff.id,
                leaveTypeId: lt.id,
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

          const beforeBalance = this.balanceService.calculateAvailableBalance(balance);
          const currentAccrued = Number(balance.accruedDays) || 0;
          const newAccrued = Math.round((currentAccrued + monthlyRate) * 10) / 10;
          const newClosing = Math.round((beforeBalance + monthlyRate) * 10) / 10;

          await this.prisma.sms_staffLeaveBalances.update({
            where: { id: balance.id },
            data: {
              accruedDays: new Prisma.Decimal(newAccrued),
              closingBalanceDays: new Prisma.Decimal(newClosing),
            },
          });

          // Record ledger transaction
          await this.balanceService.recordBalanceTransaction({
            balanceId: balance.id,
            staffId: staff.id,
            leaveTypeId: lt.id,
            balanceYear: year,
            transactionType: 'MONTHLY_ACCRUAL',
            amount: monthlyRate,
            beforeBalance,
            afterBalance: newClosing,
            reason: `Automatic monthly leave accrual for ${referencePeriod}`,
            referencePeriod,
            actorId: user.id,
          });

          processedCount++;
          successfulDetails.push({
            staffName: staff.fullName,
            leaveType: lt.name,
            accrued: monthlyRate,
            newBalance: newClosing,
          });
        } catch (err: any) {
          this.logger.error(
            `Failed monthly accrual for staff ${staff.id} (${staff.fullName}): ${err.message}`,
          );
          errors.push({
            staffId: staff.id,
            staffName: staff.fullName,
            error: err.message,
          });
        }
      }
    }

    await LeaveAccessHelper.recordAuditLog(
      this.prisma,
      orgId,
      user.id,
      'MONTHLY_ACCRUAL_PROCESSED',
      null,
      {
        referencePeriod,
        processedCount,
        skippedCount,
        errorCount: errors.length,
      },
    );

    return {
      message: `Monthly accrual processed: ${processedCount} credited, ${skippedCount} skipped (already processed), ${errors.length} errors`,
      referencePeriod,
      processedCount,
      skippedCount,
      errors,
      sampleCredited: successfulDetails.slice(0, 10),
    };
  }

  /**
   * Task 9.2: Year-End Carry-Forward Processing
   */
  async processYearEndCarryForward(
    user: AuthenticatedUser,
    dto: ProcessCarryForwardDto,
    queryOrgId?: string,
  ) {
    const orgId = LeaveAccessHelper.resolveOrgId(user, queryOrgId);
    await LeaveAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      orgId,
      'staff_leave.manage',
    );

    const fromYear = dto.fromYear;
    const toYear = dto.toYear || fromYear + 1;

    if (toYear <= fromYear) {
      throw new BadRequestException({
        code: 'INVALID_YEAR_RANGE',
        message: 'Destination year must be greater than source year',
      });
    }

    this.logger.log(`Executing year-end carry forward from ${fromYear} to ${toYear} for Org: ${orgId}`);

    // Fetch active leave types that permit carry-forward
    const leaveTypes = await this.prisma.sms_leaveTypes.findMany({
      where: {
        organizationId: orgId,
        status: 'active',
      },
    });

    const leaveTypeMap = new Map(leaveTypes.map((lt) => [lt.id, lt]));

    // Fetch all balances for fromYear
    const balances = await this.prisma.sms_staffLeaveBalances.findMany({
      where: {
        balanceYear: fromYear,
        staff: {
          organizationId: orgId,
          deletedAt: null,
          employmentStatus: { not: 'terminated' },
          ...(dto.staffId ? { id: dto.staffId } : {}),
          ...(dto.branchId
            ? {
                OR: [
                  { homeBranchId: dto.branchId },
                  { staffBranchAssignments: { some: { branchId: dto.branchId } } },
                ],
              }
            : {}),
        },
      },
      include: {
        staff: { select: { id: true, fullName: true, employeeCode: true } },
      },
    });

    let carriedCount = 0;
    let skippedCount = 0;
    const deficitsFlagged: any[] = [];

    for (const b of balances) {
      const lt = leaveTypeMap.get(b.leaveTypeId);
      if (!lt) continue;

      const available = this.balanceService.calculateAvailableBalance(b);
      const maxCarry = Number(lt.maxCarryForwardDays) || 0;

      // Handle deficit (negative balance)
      if (available < 0) {
        deficitsFlagged.push({
          staffId: b.staffId,
          staffName: b.staff.fullName,
          leaveType: lt.name,
          deficit: available,
        });
      }

      // Carry forward days cannot be negative, and cannot exceed maxCarryForwardDays
      const carryForwardDays = Math.min(maxCarry, Math.max(0, available));

      // Find or create next year balance
      const nextBalance = await this.prisma.sms_staffLeaveBalances.findUnique({
        where: {
          staffId_leaveTypeId_balanceYear: {
            staffId: b.staffId,
            leaveTypeId: b.leaveTypeId,
            balanceYear: toYear,
          },
        },
      });

      if (nextBalance) {
        // Update carried forward days on next year's record
        const updated = await this.prisma.sms_staffLeaveBalances.update({
          where: { id: nextBalance.id },
          data: {
            carriedForwardDays: new Prisma.Decimal(carryForwardDays),
            closingBalanceDays: new Prisma.Decimal(
              this.balanceService.calculateAvailableBalance({
                ...nextBalance,
                carriedForwardDays: carryForwardDays,
              }),
            ),
          },
        });

        await this.balanceService.recordBalanceTransaction({
          balanceId: updated.id,
          staffId: b.staffId,
          leaveTypeId: b.leaveTypeId,
          balanceYear: toYear,
          transactionType: 'CARRY_FORWARD',
          amount: carryForwardDays,
          beforeBalance: Number(nextBalance.closingBalanceDays),
          afterBalance: Number(updated.closingBalanceDays),
          reason: `Carry forward from ${fromYear} (eligible: ${available}, capped at ${maxCarry})`,
          referencePeriod: `${fromYear}->${toYear}`,
          actorId: user.id,
        });

        carriedCount++;
      } else {
        // Create next year balance
        const initialAnnualGrant =
          lt.accrualMethod === 'annual_grant' ? Number(lt.annualEntitlementDays) || 0 : 0;
        const closing = carryForwardDays + initialAnnualGrant;

        const created = await this.prisma.sms_staffLeaveBalances.create({
          data: {
            staffId: b.staffId,
            leaveTypeId: b.leaveTypeId,
            balanceYear: toYear,
            openingBalanceDays: new Prisma.Decimal(initialAnnualGrant),
            carriedForwardDays: new Prisma.Decimal(carryForwardDays),
            accruedDays: new Prisma.Decimal(0),
            usedDays: new Prisma.Decimal(0),
            manualAdjustmentDays: new Prisma.Decimal(0),
            closingBalanceDays: new Prisma.Decimal(closing),
          },
        });

        await this.balanceService.recordBalanceTransaction({
          balanceId: created.id,
          staffId: b.staffId,
          leaveTypeId: b.leaveTypeId,
          balanceYear: toYear,
          transactionType: 'CARRY_FORWARD',
          amount: carryForwardDays,
          beforeBalance: initialAnnualGrant,
          afterBalance: closing,
          reason: `Carry forward from ${fromYear} into ${toYear}`,
          referencePeriod: `${fromYear}->${toYear}`,
          actorId: user.id,
        });

        carriedCount++;
      }
    }

    await LeaveAccessHelper.recordAuditLog(
      this.prisma,
      orgId,
      user.id,
      'YEAR_END_CARRY_FORWARD_PROCESSED',
      { fromYear, toYear },
      { carriedCount, deficitsFlaggedCount: deficitsFlagged.length },
    );

    return {
      message: `Year-end carry forward completed from ${fromYear} to ${toYear}`,
      fromYear,
      toYear,
      carriedCount,
      deficitsFlagged,
    };
  }
}

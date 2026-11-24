import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { EffectivePermissionResolverService } from '../../role-permission/services/effective-permission-resolver.service';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { CreateBlackoutPeriodDto } from '../dto/create-blackout.dto';
import { UpdateBlackoutPeriodDto } from '../dto/update-blackout.dto';
import { QueryBlackoutPeriodDto } from '../dto/query-blackout.dto';
import { LeaveAccessHelper } from '../utils/leave-access.util';
import { LeaveCalculatorUtil } from '../utils/leave-calculator.util';
import { Prisma } from '@prisma/client';

export interface BlackoutValidationResult {
  hasRestriction: boolean;
  isBlocked: boolean;
  warnings: string[];
  blackoutName?: string;
  restrictionType?: 'block_all' | 'limit_percentage';
  percentageExceeded?: boolean;
  currentOnLeavePercentage?: number;
  maxPercentageStaffOnLeave?: number;
}

@Injectable()
export class LeaveBlackoutService {
  private readonly logger = new Logger(LeaveBlackoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionResolver: EffectivePermissionResolverService,
  ) {}

  /**
   * Task 9.5: Create Blackout Period with Overlap Review
   */
  async createBlackoutPeriod(
    user: AuthenticatedUser,
    dto: CreateBlackoutPeriodDto,
    queryOrgId?: string,
  ) {
    const orgId = LeaveAccessHelper.resolveOrgId(user, queryOrgId);
    await LeaveAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      orgId,
      'staff_leave.manage',
      dto.branchId,
    );

    const start = LeaveCalculatorUtil.normalizeDate(dto.startDate);
    const end = LeaveCalculatorUtil.normalizeDate(dto.endDate);

    if (end < start) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: 'End date cannot precede start date',
      });
    }

    if (dto.restrictionType === 'limit_percentage' && !dto.maxPercentageStaffOnLeave) {
      throw new BadRequestException({
        code: 'MISSING_PERCENTAGE_CAP',
        message: 'maxPercentageStaffOnLeave is required when restrictionType is limit_percentage',
      });
    }

    // Inspect existing approved leave requests overlapping this new blackout period
    const overlappingApproved = await this.prisma.sms_staffLeaveRequests.findMany({
      where: {
        staff: {
          organizationId: orgId,
          ...(dto.branchId ? { homeBranchId: dto.branchId } : {}),
        },
        status: 'approved',
        startDate: { lte: end },
        endDate: { gte: start },
      },
      include: {
        staff: { select: { id: true, fullName: true, employeeCode: true } },
        leaveType: { select: { id: true, name: true, code: true } },
      },
    });

    const created = await this.prisma.sms_leaveBlackoutPeriods.create({
      data: {
        organizationId: orgId,
        branchId: dto.branchId || null,
        name: dto.name.trim(),
        startDate: start,
        endDate: end,
        restrictionType: dto.restrictionType || 'block_all',
        maxPercentageStaffOnLeave:
          dto.maxPercentageStaffOnLeave !== undefined && dto.maxPercentageStaffOnLeave !== null
            ? new Prisma.Decimal(dto.maxPercentageStaffOnLeave)
            : null,
        appliesToLeaveTypeIds: dto.appliesToLeaveTypeIds || null,
        reason: dto.reason || null,
        createdById: user.id,
      },
      include: {
        branch: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, displayName: true } },
      },
    });

    await LeaveAccessHelper.recordAuditLog(
      this.prisma,
      orgId,
      user.id,
      'BLACKOUT_PERIOD_CREATED',
      null,
      created,
    );

    return {
      blackoutPeriod: created,
      overlappingApprovedLeavesCount: overlappingApproved.length,
      overlappingApprovedLeaves: overlappingApproved,
      warning:
        overlappingApproved.length > 0
          ? `Notice: ${overlappingApproved.length} staff member(s) already have approved leave during this blackout period. Existing approved leaves remain preserved.`
          : null,
    };
  }

  /**
   * Task 9.5: List Blackout Periods
   */
  async listBlackoutPeriods(
    user: AuthenticatedUser,
    query: QueryBlackoutPeriodDto,
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

    const where: Prisma.sms_leaveBlackoutPeriodsWhereInput = {
      organizationId: orgId,
    };

    if (query.branchId) {
      where.OR = [{ branchId: null }, { branchId: query.branchId }];
    }

    if (query.startDate && query.endDate) {
      where.startDate = { lte: LeaveCalculatorUtil.normalizeDate(query.endDate) };
      where.endDate = { gte: LeaveCalculatorUtil.normalizeDate(query.startDate) };
    }

    if (query.search) {
      const s = query.search.trim();
      where.name = { contains: s, mode: 'insensitive' };
    }

    const sortOrder: Prisma.SortOrder = query.sortOrder === 'desc' ? 'desc' : 'asc';
    let orderBy: Prisma.sms_leaveBlackoutPeriodsOrderByWithRelationInput;
    switch (query.sortBy) {
      case 'name':
        orderBy = { name: sortOrder };
        break;
      case 'endDate':
        orderBy = { endDate: sortOrder };
        break;
      case 'restrictionType':
        orderBy = { restrictionType: sortOrder };
        break;
      case 'createdAt':
        orderBy = { createdAt: sortOrder };
        break;
      case 'startDate':
      default:
        orderBy = { startDate: sortOrder };
        break;
    }

    const [items, total] = await Promise.all([
      this.prisma.sms_leaveBlackoutPeriods.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          branch: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, displayName: true } },
        },
      }),
      this.prisma.sms_leaveBlackoutPeriods.count({ where }),
    ]);

    return {
      items,
      data: items,
      total,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Task 9.5: Update Blackout Period
   */
  async updateBlackoutPeriod(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateBlackoutPeriodDto,
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

    const existing = await this.prisma.sms_leaveBlackoutPeriods.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'BLACKOUT_NOT_FOUND',
        message: 'Blackout period does not exist',
      });
    }

    const start = dto.startDate ? LeaveCalculatorUtil.normalizeDate(dto.startDate) : existing.startDate;
    const end = dto.endDate ? LeaveCalculatorUtil.normalizeDate(dto.endDate) : existing.endDate;

    if (end < start) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: 'End date cannot precede start date',
      });
    }

    const updated = await this.prisma.sms_leaveBlackoutPeriods.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.startDate ? { startDate: start } : {}),
        ...(dto.endDate ? { endDate: end } : {}),
        ...(dto.branchId !== undefined ? { branchId: dto.branchId || null } : {}),
        ...(dto.restrictionType ? { restrictionType: dto.restrictionType } : {}),
        ...(dto.maxPercentageStaffOnLeave !== undefined
          ? {
              maxPercentageStaffOnLeave:
                dto.maxPercentageStaffOnLeave !== null
                  ? new Prisma.Decimal(dto.maxPercentageStaffOnLeave)
                  : null,
            }
          : {}),
        ...(dto.appliesToLeaveTypeIds !== undefined
          ? { appliesToLeaveTypeIds: dto.appliesToLeaveTypeIds }
          : {}),
        ...(dto.reason !== undefined ? { reason: dto.reason } : {}),
      },
      include: {
        branch: { select: { id: true, name: true, code: true } },
      },
    });

    await LeaveAccessHelper.recordAuditLog(
      this.prisma,
      orgId,
      user.id,
      'BLACKOUT_PERIOD_UPDATED',
      existing,
      updated,
    );

    return updated;
  }

  /**
   * Task 9.5: Delete Blackout Period
   */
  async deleteBlackoutPeriod(
    user: AuthenticatedUser,
    id: string,
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

    const existing = await this.prisma.sms_leaveBlackoutPeriods.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'BLACKOUT_NOT_FOUND',
        message: 'Blackout period does not exist',
      });
    }

    await this.prisma.sms_leaveBlackoutPeriods.delete({
      where: { id },
    });

    await LeaveAccessHelper.recordAuditLog(
      this.prisma,
      orgId,
      user.id,
      'BLACKOUT_PERIOD_DELETED',
      existing,
      null,
    );

    return { message: 'Blackout period removed successfully' };
  }

  /**
   * Task 9.5: Authoritative Backend Blackout Validation for Leave Dates
   */
  async validateLeaveDatesAgainstBlackout(
    organizationId: string,
    branchId: string,
    leaveTypeId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<BlackoutValidationResult> {
    const blackouts = await this.prisma.sms_leaveBlackoutPeriods.findMany({
      where: {
        organizationId,
        OR: [{ branchId: null }, { branchId }],
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });

    if (blackouts.length === 0) {
      return { hasRestriction: false, isBlocked: false, warnings: [] };
    }

    const warnings: string[] = [];
    let isBlocked = false;
    let restrictionType: 'block_all' | 'limit_percentage' = 'block_all';
    let triggeredBlackoutName = '';

    for (const b of blackouts) {
      // Check if applies to this specific leave type
      let applies = true;
      if (b.appliesToLeaveTypeIds && b.appliesToLeaveTypeIds.trim().length > 0) {
        const idList = b.appliesToLeaveTypeIds.split(',').map((x) => x.trim());
        applies = idList.includes(leaveTypeId);
      }

      if (!applies) {
        continue; // Exempt leave type (e.g. sick leave exception)
      }

      triggeredBlackoutName = b.name;

      if (b.restrictionType === 'block_all') {
        isBlocked = true;
        restrictionType = 'block_all';
        warnings.push(
          `Blackout Period '${b.name}': Full leave block in effect from ${b.startDate.toISOString().split('T')[0]} to ${b.endDate.toISOString().split('T')[0]}.`,
        );
        break;
      }

      if (b.restrictionType === 'limit_percentage') {
        restrictionType = 'limit_percentage';
        const maxPercent = Number(b.maxPercentageStaffOnLeave) || 20;

        // Count total active staff in branch
        const totalBranchStaff = await this.prisma.sms_staff.count({
          where: {
            organizationId,
            homeBranchId: branchId,
            employmentStatus: 'active',
            deletedAt: null,
          },
        });

        // Count staff already on approved leave during this time
        const approvedOverlaps = await this.prisma.sms_staffLeaveRequests.findMany({
          where: {
            staff: { organizationId, homeBranchId: branchId },
            status: 'approved',
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
          select: { staffId: true },
          distinct: ['staffId'],
        });

        const currentOnLeaveCount = approvedOverlaps.length;
        const projectedPercentage = totalBranchStaff > 0
          ? Math.round(((currentOnLeaveCount + 1) / totalBranchStaff) * 100)
          : 0;

        if (projectedPercentage > maxPercent) {
          warnings.push(
            `Staff Leave Cap Warning for '${b.name}': ${currentOnLeaveCount}/${totalBranchStaff} staff already on leave (${Math.round((currentOnLeaveCount / totalBranchStaff) * 100)}%). Adding this request reaches ${projectedPercentage}%, exceeding the configured ${maxPercent}% branch limit.`,
          );
          return {
            hasRestriction: true,
            isBlocked: false,
            warnings,
            blackoutName: b.name,
            restrictionType: 'limit_percentage',
            percentageExceeded: true,
            currentOnLeavePercentage: projectedPercentage,
            maxPercentageStaffOnLeave: maxPercent,
          };
        }
      }
    }

    return {
      hasRestriction: warnings.length > 0,
      isBlocked,
      warnings,
      blackoutName: triggeredBlackoutName || undefined,
      restrictionType,
    };
  }
}

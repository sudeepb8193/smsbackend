import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { EffectivePermissionResolverService } from '../../role-permission/services/effective-permission-resolver.service';
import {
  CreateScheduleOverrideDto,
  UpdateScheduleOverrideDto,
  CreateShiftSwapDto,
  ReviewOverrideDto,
  QueryScheduleOverrideDto,
} from '../dto/schedule-override.dto';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import {
  parseTimeToDate,
  parseDateOnly,
  formatTime,
  formatDate,
  timeToMinutes,
} from '../utils/time-range.util';
import { SchedulingAccessHelper } from '../utils/scheduling-access.util';
import { Prisma } from '@prisma/client';

@Injectable()
export class ScheduleOverrideService {
  private readonly logger = new Logger(ScheduleOverrideService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    private readonly permissionResolver?: EffectivePermissionResolverService,
  ) {}

  /**
   * Create a schedule override (Task 7.4)
   */
  async createOverride(
    organizationId: string,
    dto: CreateScheduleOverrideDto,
    user: AuthenticatedUser,
  ) {
    if (!organizationId) {
      throw new BadRequestException('organizationId is required');
    }

    // 1. Mandatory reason check
    if (!dto.reason || !dto.reason.trim()) {
      throw new BadRequestException({
        code: 'REASON_REQUIRED',
        message: 'A detailed reason is mandatory for creating a schedule override',
      });
    }

    // 2. Validate staff
    const staff = await SchedulingAccessHelper.validateStaff(
      this.prisma,
      dto.staffId,
      organizationId,
    );

    // 3. Authorization check
    await SchedulingAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      organizationId,
      'staff_schedule.create',
      staff.homeBranchId,
      staff,
    );

    const targetDate = parseDateOnly(dto.overrideDate);

    // 4. Check for approved leave conflicts (Module 09)
    if (['extra_shift', 'shift_change', 'late_arrival', 'early_leave'].includes(dto.overrideType)) {
      const leaveConflict = await this.prisma.sms_staffLeaveRequests.findFirst({
        where: {
          staffId: dto.staffId,
          status: 'approved',
          startDate: { lte: targetDate },
          endDate: { gte: targetDate },
        },
        include: {
          leaveType: { select: { name: true } },
        },
      });

      if (leaveConflict) {
        throw new ConflictException({
          code: 'LEAVE_CONFLICT',
          message: `Cannot schedule staff on ${dto.overrideDate}: Employee has an approved leave request (${
            leaveConflict.leaveType?.name || 'Leave'
          } from ${formatDate(leaveConflict.startDate)} to ${formatDate(leaveConflict.endDate)})`,
          leaveId: leaveConflict.id,
        });
      }
    }

    // 5. Check if an override already exists for this date
    const existing = await this.prisma.sms_staffScheduleOverrides.findFirst({
      where: {
        staffId: dto.staffId,
        overrideDate: targetDate,
      },
    });

    if (existing) {
      throw new ConflictException({
        code: 'OVERRIDE_DATE_EXISTS',
        message: `A schedule override (${existing.overrideType}) already exists for this employee on ${dto.overrideDate}. Please edit or remove the existing override before adding a new one.`,
      });
    }

    // 6. Validate time requirements per override type
    if (['extra_shift', 'shift_change'].includes(dto.overrideType)) {
      if (!dto.startTime || !dto.endTime) {
        throw new BadRequestException({
          code: 'TIMES_REQUIRED',
          message: `Both startTime and endTime are required for ${dto.overrideType}`,
        });
      }
      if (timeToMinutes(dto.endTime) <= timeToMinutes(dto.startTime)) {
        throw new BadRequestException({
          code: 'INVALID_TIME_RANGE',
          message: 'endTime must be later than startTime',
        });
      }
    } else if (dto.overrideType === 'early_leave') {
      if (!dto.endTime) {
        throw new BadRequestException({
          code: 'END_TIME_REQUIRED',
          message: 'Adjusted endTime is required for early_leave override',
        });
      }
    } else if (dto.overrideType === 'late_arrival') {
      if (!dto.startTime) {
        throw new BadRequestException({
          code: 'START_TIME_REQUIRED',
          message: 'Adjusted startTime is required for late_arrival override',
        });
      }
    }

    // Determine initial approval status
    const approvalStatus = dto.approvalStatus || 'approved';

    const override = await this.prisma.sms_staffScheduleOverrides.create({
      data: {
        staffId: dto.staffId,
        overrideDate: targetDate,
        overrideType: dto.overrideType,
        startTime: dto.startTime ? parseTimeToDate(dto.startTime) : null,
        endTime: dto.endTime ? parseTimeToDate(dto.endTime) : null,
        reason: dto.reason.trim(),
        approvalStatus,
        approvedById: approvalStatus === 'approved' ? user.id : null,
        createdById: user.id,
      },
      include: {
        staff: {
          select: { id: true, fullName: true, employeeCode: true },
        },
        createdBy: {
          select: { id: true, displayName: true, email: true },
        },
        approvedBy: {
          select: { id: true, displayName: true, email: true },
        },
      },
    });

    await SchedulingAccessHelper.recordAuditLog(
      this.prisma,
      organizationId,
      user.id,
      'CREATE_SCHEDULE_OVERRIDE',
      null,
      override,
    );

    return this.serializeOverride(override);
  }

  /**
   * Execute 2-Person Shift Swap (Task 7.4)
   */
  async createShiftSwap(
    organizationId: string,
    dto: CreateShiftSwapDto,
    user: AuthenticatedUser,
  ) {
    if (!organizationId) {
      throw new BadRequestException('organizationId is required');
    }

    if (dto.staffAId === dto.staffBId) {
      throw new BadRequestException({
        code: 'SAME_STAFF_SWAP',
        message: 'Cannot swap shift with the same employee',
      });
    }

    if (!dto.reason || !dto.reason.trim()) {
      throw new BadRequestException({
        code: 'REASON_REQUIRED',
        message: 'Reason is required for shift swap',
      });
    }

    // Validate both employees
    const staffA = await SchedulingAccessHelper.validateStaff(
      this.prisma,
      dto.staffAId,
      organizationId,
    );
    const staffB = await SchedulingAccessHelper.validateStaff(
      this.prisma,
      dto.staffBId,
      organizationId,
    );

    // Validate manager authorization
    await SchedulingAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      organizationId,
      'staff_schedule.manage',
      staffA.homeBranchId,
      staffA,
    );
    await SchedulingAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      organizationId,
      'staff_schedule.manage',
      staffB.homeBranchId,
      staffB,
    );

    const dateA = parseDateOnly(dto.dateA);
    const dateB = parseDateOnly(dto.dateB || dto.dateA);

    // Check leave conflicts for both
    const leaveA = await this.prisma.sms_staffLeaveRequests.findFirst({
      where: {
        staffId: dto.staffAId,
        status: 'approved',
        startDate: { lte: dateB },
        endDate: { gte: dateB },
      },
    });
    if (leaveA) {
      throw new ConflictException({
        code: 'LEAVE_CONFLICT',
        message: `Employee ${staffA.fullName} has approved leave on target date ${formatDate(dateB)}`,
      });
    }

    const leaveB = await this.prisma.sms_staffLeaveRequests.findFirst({
      where: {
        staffId: dto.staffBId,
        status: 'approved',
        startDate: { lte: dateA },
        endDate: { gte: dateA },
      },
    });
    if (leaveB) {
      throw new ConflictException({
        code: 'LEAVE_CONFLICT',
        message: `Employee ${staffB.fullName} has approved leave on target date ${formatDate(dateA)}`,
      });
    }

    // Look up existing schedules for both on their respective dates
    const dayOfWeekA = dateA.getDay();
    const dayOfWeekB = dateB.getDay();

    const schedA = await this.prisma.sms_staffWeeklySchedules.findFirst({
      where: {
        staffId: dto.staffAId,
        dayOfWeek: dayOfWeekA,
        effectiveFrom: { lte: dateA },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: dateA } }],
      },
      include: { shiftTemplate: true },
    });

    const schedB = await this.prisma.sms_staffWeeklySchedules.findFirst({
      where: {
        staffId: dto.staffBId,
        dayOfWeek: dayOfWeekB,
        effectiveFrom: { lte: dateB },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: dateB } }],
      },
      include: { shiftTemplate: true },
    });

    const hoursA = schedA?.isWorking
      ? {
          startTime: schedA.shiftTemplate
            ? schedA.shiftTemplate.startTime
            : schedA.customStartTime,
          endTime: schedA.shiftTemplate
            ? schedA.shiftTemplate.endTime
            : schedA.customEndTime,
        }
      : null;

    const hoursB = schedB?.isWorking
      ? {
          startTime: schedB.shiftTemplate
            ? schedB.shiftTemplate.startTime
            : schedB.customStartTime,
          endTime: schedB.shiftTemplate
            ? schedB.shiftTemplate.endTime
            : schedB.customEndTime,
        }
      : null;

    // Save linked pair atomically in transaction
    const swapResult = await this.prisma.$transaction(async (tx) => {
      // Clean any existing override on the exact dates
      await tx.sms_staffScheduleOverrides.deleteMany({
        where: {
          OR: [
            { staffId: dto.staffAId, overrideDate: dateA },
            { staffId: dto.staffBId, overrideDate: dateB },
          ],
        },
      });

      // Create side A: Staff A takes Staff B's hours on dateA
      const overrideA = await tx.sms_staffScheduleOverrides.create({
        data: {
          staffId: dto.staffAId,
          overrideDate: dateA,
          overrideType: hoursB ? 'shift_change' : 'day_off',
          startTime: hoursB?.startTime || null,
          endTime: hoursB?.endTime || null,
          reason: `Shift swap with ${staffB.fullName}: ${dto.reason.trim()}`,
          approvalStatus: 'approved',
          approvedById: user.id,
          createdById: user.id,
        },
      });

      // Create side B: Staff B takes Staff A's hours on dateB, linked to side A
      const overrideB = await tx.sms_staffScheduleOverrides.create({
        data: {
          staffId: dto.staffBId,
          overrideDate: dateB,
          overrideType: hoursA ? 'shift_change' : 'day_off',
          startTime: hoursA?.startTime || null,
          endTime: hoursA?.endTime || null,
          reason: `Shift swap with ${staffA.fullName}: ${dto.reason.trim()}`,
          linkedSwapId: overrideA.id,
          approvalStatus: 'approved',
          approvedById: user.id,
          createdById: user.id,
        },
      });

      // Link side A to side B
      const linkedA = await tx.sms_staffScheduleOverrides.update({
        where: { id: overrideA.id },
        data: { linkedSwapId: overrideB.id },
        include: {
          staff: { select: { id: true, fullName: true, employeeCode: true } },
          linkedSwap: {
            include: {
              staff: { select: { id: true, fullName: true, employeeCode: true } },
            },
          },
        },
      });

      const linkedB = await tx.sms_staffScheduleOverrides.findUnique({
        where: { id: overrideB.id },
        include: {
          staff: { select: { id: true, fullName: true, employeeCode: true } },
          linkedSwap: {
            include: {
              staff: { select: { id: true, fullName: true, employeeCode: true } },
            },
          },
        },
      });

      return { sideA: linkedA, sideB: linkedB };
    });

    await SchedulingAccessHelper.recordAuditLog(
      this.prisma,
      organizationId,
      user.id,
      'CREATE_SHIFT_SWAP',
      null,
      swapResult,
    );

    return {
      message: `Shift swap confirmed between ${staffA.fullName} and ${staffB.fullName}`,
      sideA: this.serializeOverride(swapResult.sideA),
      sideB: this.serializeOverride(swapResult.sideB),
    };
  }

  /**
   * List overrides with filters
   */
  async getOverrides(
    organizationId: string,
    query: QueryScheduleOverrideDto,
    user: AuthenticatedUser,
  ) {
    if (!organizationId) {
      throw new BadRequestException('organizationId is required');
    }

    await SchedulingAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      organizationId,
      'staff_schedule.view',
      query.branchId,
    );

    const where: Prisma.sms_staffScheduleOverridesWhereInput = {
      staff: {
        organizationId,
        deletedAt: null,
        ...(query.branchId ? { homeBranchId: query.branchId } : {}),
      },
    };

    if (query.staffId) {
      where.staffId = query.staffId;
    }

    if (query.approvalStatus) {
      where.approvalStatus = query.approvalStatus;
    }

    if (query.overrideType) {
      where.overrideType = query.overrideType;
    }

    if (query.startDate || query.endDate) {
      where.overrideDate = {
        ...(query.startDate ? { gte: parseDateOnly(query.startDate) } : {}),
        ...(query.endDate ? { lte: parseDateOnly(query.endDate) } : {}),
      };
    }

    const overrides = await this.prisma.sms_staffScheduleOverrides.findMany({
      where,
      include: {
        staff: {
          select: { id: true, fullName: true, employeeCode: true, homeBranchId: true },
        },
        createdBy: {
          select: { id: true, displayName: true, email: true },
        },
        approvedBy: {
          select: { id: true, displayName: true, email: true },
        },
        linkedSwap: {
          include: {
            staff: { select: { id: true, fullName: true, employeeCode: true } },
          },
        },
      },
      orderBy: [{ overrideDate: 'desc' }, { createdAt: 'desc' }],
    });

    return overrides.map((o) => this.serializeOverride(o));
  }

  /**
   * Approve or reject a pending override (Task 7.4)
   */
  async reviewOverride(
    organizationId: string,
    overrideId: string,
    dto: ReviewOverrideDto,
    user: AuthenticatedUser,
  ) {
    const existing = await this.prisma.sms_staffScheduleOverrides.findUnique({
      where: { id: overrideId },
      include: {
        staff: true,
        linkedSwap: true,
      },
    });

    if (!existing || existing.staff.organizationId !== organizationId) {
      throw new NotFoundException({
        code: 'OVERRIDE_NOT_FOUND',
        message: 'Schedule override not found',
      });
    }

    // Prevent self-approval
    if (existing.staff.userId === user.id) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_SELF_APPROVAL',
        message: 'Employees are strictly forbidden from approving their own schedule overrides or shift swaps',
      });
    }

    await SchedulingAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      organizationId,
      'staff_schedule.approve',
      existing.staff.homeBranchId,
      existing.staff,
    );

    // Update the override and linked swap if present
    const updated = await this.prisma.$transaction(async (tx) => {
      const main = await tx.sms_staffScheduleOverrides.update({
        where: { id: overrideId },
        data: {
          approvalStatus: dto.status,
          approvedById: dto.status === 'approved' ? user.id : null,
        },
        include: {
          staff: { select: { id: true, fullName: true, employeeCode: true } },
          approvedBy: { select: { id: true, displayName: true } },
          linkedSwap: {
            include: {
              staff: { select: { id: true, fullName: true, employeeCode: true } },
            },
          },
        },
      });

      if (existing.linkedSwapId) {
        await tx.sms_staffScheduleOverrides.update({
          where: { id: existing.linkedSwapId },
          data: {
            approvalStatus: dto.status,
            approvedById: dto.status === 'approved' ? user.id : null,
          },
        });
      }

      return main;
    });

    await SchedulingAccessHelper.recordAuditLog(
      this.prisma,
      organizationId,
      user.id,
      `REVIEW_SCHEDULE_OVERRIDE_${dto.status.toUpperCase()}`,
      existing,
      updated,
    );

    return this.serializeOverride(updated);
  }

  /**
   * Cancel or remove an override (Task 7.4)
   */
  async cancelOverride(
    organizationId: string,
    overrideId: string,
    user: AuthenticatedUser,
  ) {
    const existing = await this.prisma.sms_staffScheduleOverrides.findUnique({
      where: { id: overrideId },
      include: {
        staff: true,
        linkedSwap: true,
      },
    });

    if (!existing || existing.staff.organizationId !== organizationId) {
      throw new NotFoundException({
        code: 'OVERRIDE_NOT_FOUND',
        message: 'Schedule override not found',
      });
    }

    await SchedulingAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      organizationId,
      'staff_schedule.delete',
      existing.staff.homeBranchId,
      existing.staff,
    );

    await this.prisma.$transaction(async (tx) => {
      if (existing.linkedSwapId) {
        // Break self-reference first
        await tx.sms_staffScheduleOverrides.updateMany({
          where: { id: { in: [overrideId, existing.linkedSwapId] } },
          data: { linkedSwapId: null },
        });

        await tx.sms_staffScheduleOverrides.delete({
          where: { id: existing.linkedSwapId },
        });
      }

      await tx.sms_staffScheduleOverrides.delete({
        where: { id: overrideId },
      });
    });

    await SchedulingAccessHelper.recordAuditLog(
      this.prisma,
      organizationId,
      user.id,
      'CANCEL_SCHEDULE_OVERRIDE',
      existing,
      null,
    );

    return {
      message: 'Schedule override cancelled successfully',
      id: overrideId,
      linkedSwapCancelled: !!existing.linkedSwapId,
    };
  }

  public serializeOverride(override: any) {
    return {
      id: override.id,
      staffId: override.staffId,
      staff: override.staff || null,
      overrideDate: formatDate(override.overrideDate),
      overrideType: override.overrideType,
      startTime: formatTime(override.startTime),
      endTime: formatTime(override.endTime),
      reason: override.reason,
      approvalStatus: override.approvalStatus,
      approvedBy: override.approvedBy || null,
      createdBy: override.createdBy || null,
      linkedSwapId: override.linkedSwapId,
      linkedSwap: override.linkedSwap
        ? {
            id: override.linkedSwap.id,
            staff: override.linkedSwap.staff || null,
            overrideDate: formatDate(override.linkedSwap.overrideDate),
            overrideType: override.linkedSwap.overrideType,
          }
        : null,
      createdAt: override.createdAt,
      updatedAt: override.updatedAt,
    };
  }
}

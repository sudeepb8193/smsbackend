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
  CreateBlockedTimeDto,
  BulkCreateBlockedTimeDto,
  UpdateBlockedTimeDto,
  QueryBlockedTimeDto,
} from '../dto/blocked-time.dto';
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
export class BlockedTimeService {
  private readonly logger = new Logger(BlockedTimeService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    private readonly permissionResolver?: EffectivePermissionResolverService,
  ) {}

  /**
   * Helper: Check appointment conflicts (Module 18 integration hook)
   */
  private async checkAppointmentConflicts(
    staffId: string,
    branchId: string,
    blockDate: Date,
    startMin: number,
    endMin: number,
  ): Promise<{ hasConflict: boolean; message?: string }> {
    try {
      if ((this.prisma as any).sms_appointments) {
        const conflicting = await (this.prisma as any).sms_appointments.findFirst({
          where: {
            staffId,
            branchId,
            appointmentDate: blockDate,
            status: { in: ['confirmed', 'in_progress', 'scheduled'] },
          },
        });
        if (conflicting) {
          return {
            hasConflict: true,
            message: `Conflicting customer appointment found on this date (Appointment #${conflicting.id.substring(
              0,
              8,
            )}). Please reschedule the customer appointment first.`,
          };
        }
      }
    } catch {
      // sms_appointments table not yet created
    }
    return { hasConflict: false };
  }

  /**
   * Create blocked time for a single employee (Task 7.5)
   */
  async createBlockedTime(
    organizationId: string,
    dto: CreateBlockedTimeDto,
    user: AuthenticatedUser,
  ) {
    if (!organizationId) {
      throw new BadRequestException('organizationId is required');
    }

    // 1. Validate employee
    const staff = await SchedulingAccessHelper.validateStaff(
      this.prisma,
      dto.staffId,
      organizationId,
    );

    // 2. Validate branch assignment
    if (!SchedulingAccessHelper.isStaffEligibleForBranch(staff, dto.branchId)) {
      throw new BadRequestException({
        code: 'BRANCH_ELIGIBILITY_MISMATCH',
        message: 'Employee is not authorized or assigned to work at the selected branch',
      });
    }

    // 3. User access check (allows Service Staff for own record)
    await SchedulingAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      organizationId,
      'staff_schedule.create',
      dto.branchId,
      staff,
    );

    // 4. Validate time range
    const startMin = timeToMinutes(dto.startTime);
    const endMin = timeToMinutes(dto.endTime);
    if (endMin <= startMin) {
      throw new BadRequestException({
        code: 'INVALID_TIME_RANGE',
        message: 'endTime must be later than startTime',
      });
    }

    const blockDateObj = parseDateOnly(dto.blockDate);

    // 5. Check appointment conflicts
    const conflictCheck = await this.checkAppointmentConflicts(
      dto.staffId,
      dto.branchId,
      blockDateObj,
      startMin,
      endMin,
    );
    if (conflictCheck.hasConflict) {
      throw new ConflictException({
        code: 'APPOINTMENT_CONFLICT',
        message: conflictCheck.message,
      });
    }

    // 6. Recurrence validation
    const isRecurring = dto.isRecurring || false;
    const recurrenceEndDate =
      isRecurring && dto.recurrenceEndDate
        ? parseDateOnly(dto.recurrenceEndDate)
        : null;

    if (recurrenceEndDate && recurrenceEndDate < blockDateObj) {
      throw new BadRequestException({
        code: 'INVALID_RECURRENCE_DATE',
        message: 'recurrenceEndDate must be on or after the initial blockDate',
      });
    }

    const blockedTime = await this.prisma.sms_staffBlockedTime.create({
      data: {
        staffId: dto.staffId,
        branchId: dto.branchId,
        blockDate: blockDateObj,
        startTime: parseTimeToDate(dto.startTime)!,
        endTime: parseTimeToDate(dto.endTime)!,
        reasonCategory: (dto.reasonCategory as any) || 'other',
        note: dto.note ? dto.note.trim() : null,
        isRecurring,
        recurrenceEndDate,
        createdById: user.id,
      },
      include: {
        staff: { select: { id: true, fullName: true, employeeCode: true } },
        branch: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, displayName: true, email: true } },
      },
    });

    await SchedulingAccessHelper.recordAuditLog(
      this.prisma,
      organizationId,
      user.id,
      'CREATE_BLOCKED_TIME',
      null,
      blockedTime,
    );

    return this.serializeBlockedTime(blockedTime);
  }

  /**
   * Bulk-create blocked time for multiple employees (Task 7.5)
   */
  async bulkCreateBlockedTime(
    organizationId: string,
    dto: BulkCreateBlockedTimeDto,
    user: AuthenticatedUser,
  ) {
    if (!organizationId) {
      throw new BadRequestException('organizationId is required');
    }

    if (!dto.staffIds || dto.staffIds.length === 0) {
      throw new BadRequestException('staffIds array must contain at least one employee');
    }

    // Validate times
    const startMin = timeToMinutes(dto.startTime);
    const endMin = timeToMinutes(dto.endTime);
    if (endMin <= startMin) {
      throw new BadRequestException({
        code: 'INVALID_TIME_RANGE',
        message: 'endTime must be later than startTime',
      });
    }

    const blockDateObj = parseDateOnly(dto.blockDate);
    const isRecurring = dto.isRecurring || false;
    const recurrenceEndDate =
      isRecurring && dto.recurrenceEndDate
        ? parseDateOnly(dto.recurrenceEndDate)
        : null;

    // Validate every employee first
    for (const staffId of dto.staffIds) {
      const staff = await SchedulingAccessHelper.validateStaff(
        this.prisma,
        staffId,
        organizationId,
      );

      if (!SchedulingAccessHelper.isStaffEligibleForBranch(staff, dto.branchId)) {
        throw new BadRequestException({
          code: 'BRANCH_ELIGIBILITY_MISMATCH',
          message: `Employee ${staff.fullName} is not assigned to branch ${dto.branchId}`,
        });
      }

      await SchedulingAccessHelper.validateUserAccess(
        this.prisma,
        this.permissionResolver,
        user,
        organizationId,
        'staff_schedule.create',
        dto.branchId,
        staff,
      );

      // Check appointment conflict for this staff
      const conflict = await this.checkAppointmentConflicts(
        staffId,
        dto.branchId,
        blockDateObj,
        startMin,
        endMin,
      );
      if (conflict.hasConflict) {
        throw new ConflictException({
          code: 'APPOINTMENT_CONFLICT',
          message: `${staff.fullName}: ${conflict.message}`,
        });
      }
    }

    // Atomic creation in transaction
    const createdBlocks = await this.prisma.$transaction(async (tx) => {
      const records: any[] = [];
      for (const staffId of dto.staffIds) {
        const b = await tx.sms_staffBlockedTime.create({
          data: {
            staffId,
            branchId: dto.branchId,
            blockDate: blockDateObj,
            startTime: parseTimeToDate(dto.startTime)!,
            endTime: parseTimeToDate(dto.endTime)!,
            reasonCategory: (dto.reasonCategory as any) || 'other',
            note: dto.note ? dto.note.trim() : null,
            isRecurring,
            recurrenceEndDate,
            createdById: user.id,
          },
          include: {
            staff: { select: { id: true, fullName: true, employeeCode: true } },
            branch: { select: { id: true, name: true, code: true } },
          },
        });
        records.push(b);
      }
      return records;
    });

    await SchedulingAccessHelper.recordAuditLog(
      this.prisma,
      organizationId,
      user.id,
      'BULK_CREATE_BLOCKED_TIME',
      null,
      {
        count: createdBlocks.length,
        staffIds: dto.staffIds,
        branchId: dto.branchId,
        date: dto.blockDate,
      },
    );

    return {
      message: `Blocked time successfully recorded for ${createdBlocks.length} employee(s)`,
      count: createdBlocks.length,
      blockedTimes: createdBlocks.map((b) => this.serializeBlockedTime(b)),
    };
  }

  /**
   * List blocked time records
   */
  async getBlockedTimes(
    organizationId: string,
    query: QueryBlockedTimeDto,
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

    const where: Prisma.sms_staffBlockedTimeWhereInput = {
      staff: {
        organizationId,
        deletedAt: null,
      },
    };

    if (query.branchId) {
      where.branchId = query.branchId;
    }

    if (query.staffId) {
      where.staffId = query.staffId;
    }

    if (query.reasonCategory) {
      where.reasonCategory = query.reasonCategory as any;
    }

    if (query.startDate || query.endDate) {
      where.OR = [
        {
          blockDate: {
            ...(query.startDate ? { gte: parseDateOnly(query.startDate) } : {}),
            ...(query.endDate ? { lte: parseDateOnly(query.endDate) } : {}),
          },
        },
        { isRecurring: true },
      ];
    }

    const blocks = await this.prisma.sms_staffBlockedTime.findMany({
      where,
      include: {
        staff: { select: { id: true, fullName: true, employeeCode: true, homeBranchId: true } },
        branch: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, displayName: true, email: true } },
      },
      orderBy: [{ blockDate: 'desc' }, { startTime: 'asc' }],
    });

    return blocks.map((b) => this.serializeBlockedTime(b));
  }

  /**
   * Cancel / delete blocked time
   */
  async cancelBlockedTime(
    organizationId: string,
    blockId: string,
    user: AuthenticatedUser,
  ) {
    const existing = await this.prisma.sms_staffBlockedTime.findUnique({
      where: { id: blockId },
      include: { staff: true },
    });

    if (!existing || existing.staff.organizationId !== organizationId) {
      throw new NotFoundException({
        code: 'BLOCKED_TIME_NOT_FOUND',
        message: 'Blocked time record not found',
      });
    }

    await SchedulingAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      organizationId,
      'staff_schedule.delete',
      existing.branchId,
      existing.staff,
    );

    await this.prisma.sms_staffBlockedTime.delete({
      where: { id: blockId },
    });

    await SchedulingAccessHelper.recordAuditLog(
      this.prisma,
      organizationId,
      user.id,
      'CANCEL_BLOCKED_TIME',
      existing,
      null,
    );

    return {
      message: 'Blocked time cancelled successfully',
      id: blockId,
    };
  }

  public serializeBlockedTime(block: any) {
    return {
      id: block.id,
      staffId: block.staffId,
      staff: block.staff || null,
      branchId: block.branchId,
      branch: block.branch || null,
      blockDate: formatDate(block.blockDate),
      startTime: formatTime(block.startTime),
      endTime: formatTime(block.endTime),
      reasonCategory: block.reasonCategory,
      note: block.note || null,
      isRecurring: block.isRecurring,
      recurrenceEndDate: block.recurrenceEndDate
        ? formatDate(block.recurrenceEndDate)
        : null,
      isOngoing: block.isRecurring && !block.recurrenceEndDate,
      createdBy: block.createdBy || null,
      createdAt: block.createdAt,
      updatedAt: block.updatedAt,
    };
  }
}

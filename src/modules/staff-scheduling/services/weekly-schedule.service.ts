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
  SaveWeeklyScheduleDto,
  CopyWeeklyScheduleDto,
  QueryWeeklyScheduleDto,
} from '../dto/weekly-schedule.dto';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import {
  validateShiftAndBreakTimes,
  parseTimeToDate,
  parseDateOnly,
  formatTime,
  formatDate,
} from '../utils/time-range.util';
import { SchedulingAccessHelper } from '../utils/scheduling-access.util';
import { Prisma } from '@prisma/client';

@Injectable()
export class WeeklyScheduleService {
  private readonly logger = new Logger(WeeklyScheduleService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    private readonly permissionResolver?: EffectivePermissionResolverService,
  ) {}

  /**
   * Save (create or update) 7-day recurring weekly schedule for an employee (Task 7.2)
   */
  async saveWeeklySchedule(
    organizationId: string,
    dto: SaveWeeklyScheduleDto,
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

    // 2. Authorization check (Service staff cannot assign their own actual shifts)
    await SchedulingAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      organizationId,
      'staff_schedule.create',
      staff.homeBranchId,
      staff,
    );

    // Prevent Service Staff from self-assigning actual shifts
    const roles = (user.roles || []).map((r) =>
      r.toUpperCase().replace(/[\s_-]+/g, '_'),
    );
    const isServiceStaffOnly =
      (roles.includes('SERVICE_STAFF') || roles.includes('STAFF')) &&
      !roles.some((r) =>
        ['SUPER_ADMIN', 'SUPERADMIN', 'OWNER', 'BRANCH_MANAGER'].includes(r),
      );
    if (isServiceStaffOnly) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_SELF_SCHEDULING',
        message: 'Service staff cannot modify their own assigned shifts',
      });
    }

    // 3. Validate effective date ranges
    const effectiveFromDate = parseDateOnly(dto.effectiveFrom);
    let effectiveToDate = dto.effectiveTo ? parseDateOnly(dto.effectiveTo) : null;

    if (effectiveToDate && effectiveToDate < effectiveFromDate) {
      throw new BadRequestException({
        code: 'INVALID_EFFECTIVE_DATE',
        message: 'effectiveTo date must be on or after effectiveFrom date',
      });
    }

    // 4. Validate all 7 days
    if (!dto.days || dto.days.length !== 7) {
      throw new BadRequestException({
        code: 'INVALID_WEEK_DAYS',
        message: 'A complete weekly schedule must specify all 7 days (Sunday..Saturday, 0..6)',
      });
    }

    const dayNumbers = new Set(dto.days.map((d) => d.dayOfWeek));
    for (let i = 0; i <= 6; i++) {
      if (!dayNumbers.has(i)) {
        throw new BadRequestException({
          code: 'MISSING_DAY',
          message: `Schedule is missing weekday definition for day ${i}`,
        });
      }
    }

    // Cache template lookups for validation
    const templateIds = dto.days
      .map((d) => d.shiftTemplateId)
      .filter(Boolean) as string[];

    const templatesMap = new Map<string, any>();
    if (templateIds.length > 0) {
      const templates = await this.prisma.sms_shiftTemplates.findMany({
        where: {
          id: { in: templateIds },
          organizationId,
        },
      });

      for (const t of templates) {
        templatesMap.set(t.id, t);
      }
    }

    // Validate each day's hours
    for (const day of dto.days) {
      if (day.isWorking) {
        if (!day.shiftTemplateId && (!day.customStartTime || !day.customEndTime)) {
          throw new BadRequestException({
            code: 'INCONSISTENT_WORKING_DAY',
            message: `Day ${day.dayOfWeek} is marked working with zero assigned hours (neither template nor custom times set)`,
          });
        }

        if (day.shiftTemplateId) {
          const t = templatesMap.get(day.shiftTemplateId);
          if (!t) {
            throw new BadRequestException({
              code: 'INVALID_TEMPLATE',
              message: `Shift template ${day.shiftTemplateId} not found in this organization`,
            });
          }
          if (t.status === 'inactive') {
            throw new BadRequestException({
              code: 'INACTIVE_TEMPLATE',
              message: `Template "${t.name}" is retired/inactive and cannot be newly assigned`,
            });
          }
          // If template is branch-specific, verify staff eligibility for that branch
          if (t.branchId && !SchedulingAccessHelper.isStaffEligibleForBranch(staff, t.branchId)) {
            throw new BadRequestException({
              code: 'TEMPLATE_BRANCH_MISMATCH',
              message: `Template "${t.name}" is restricted to a branch where the employee is not assigned`,
            });
          }
        } else if (day.customStartTime && day.customEndTime) {
          const check = validateShiftAndBreakTimes(
            day.customStartTime,
            day.customEndTime,
            day.customBreakStartTime,
            day.customBreakEndTime,
          );
          if (!check.valid) {
            throw new BadRequestException({
              code: 'INVALID_CUSTOM_HOURS',
              message: `Day ${day.dayOfWeek}: ${check.error}`,
            });
          }
        }
      }
    }

    // 5. Transaction: manage prior effective schedules & insert new records
    const savedRecords = await this.prisma.$transaction(async (tx) => {
      // Find existing schedules for this staff member
      const existingSchedules = await tx.sms_staffWeeklySchedules.findMany({
        where: { staffId: dto.staffId },
      });

      // Group by effectiveFrom
      const existingRanges = new Map<string, { from: Date; to: Date | null }>();
      for (const row of existingSchedules) {
        const key = formatDate(row.effectiveFrom);
        if (!existingRanges.has(key)) {
          existingRanges.set(key, { from: row.effectiveFrom, to: row.effectiveTo });
        }
      }

      for (const [key, range] of existingRanges.entries()) {
        const fromStr = formatDate(range.from);
        const newFromStr = formatDate(effectiveFromDate);

        if (fromStr === newFromStr) {
          // Exactly same effectiveFrom: delete old rows to replace with new definition
          await tx.sms_staffWeeklySchedules.deleteMany({
            where: {
              staffId: dto.staffId,
              effectiveFrom: range.from,
            },
          });
        } else if (range.from < effectiveFromDate && (!range.to || range.to >= effectiveFromDate)) {
          // Prior schedule overlaps future schedule: automatically close prior schedule to day before new start!
          const closedToDate = new Date(effectiveFromDate.getTime() - 24 * 60 * 60 * 1000);
          await tx.sms_staffWeeklySchedules.updateMany({
            where: {
              staffId: dto.staffId,
              effectiveFrom: range.from,
            },
            data: {
              effectiveTo: closedToDate,
            },
          });
        } else if (range.from > effectiveFromDate) {
          // A schedule that starts in the future after this one
          if (!effectiveToDate || effectiveToDate >= range.from) {
            // Adjust current effectiveTo to right before the future schedule
            const autoTo = new Date(range.from.getTime() - 24 * 60 * 60 * 1000);
            effectiveToDate = autoTo;
          }
        }
      }

      // Create the 7 day rows
      const createdRows: any[] = [];
      for (const day of dto.days) {
        const row = await tx.sms_staffWeeklySchedules.create({
          data: {
            staffId: dto.staffId,
            dayOfWeek: day.dayOfWeek,
            isWorking: day.isWorking,
            shiftTemplateId: day.isWorking ? day.shiftTemplateId || null : null,
            customStartTime:
              day.isWorking && !day.shiftTemplateId && day.customStartTime
                ? parseTimeToDate(day.customStartTime)
                : null,
            customEndTime:
              day.isWorking && !day.shiftTemplateId && day.customEndTime
                ? parseTimeToDate(day.customEndTime)
                : null,
            customBreakStartTime:
              day.isWorking && !day.shiftTemplateId && day.customBreakStartTime
                ? parseTimeToDate(day.customBreakStartTime)
                : null,
            customBreakEndTime:
              day.isWorking && !day.shiftTemplateId && day.customBreakEndTime
                ? parseTimeToDate(day.customBreakEndTime)
                : null,
            effectiveFrom: effectiveFromDate,
            effectiveTo: effectiveToDate,
            createdById: user.id,
          },
          include: {
            shiftTemplate: true,
          },
        });
        createdRows.push(row);
      }

      return createdRows;
    });

    // 6. Audit log
    await SchedulingAccessHelper.recordAuditLog(
      this.prisma,
      organizationId,
      user.id,
      'SAVE_WEEKLY_SCHEDULE',
      null,
      {
        staffId: dto.staffId,
        effectiveFrom: dto.effectiveFrom,
        effectiveTo: dto.effectiveTo,
        daysCount: savedRecords.length,
      },
    );

    return this.serializeWeeklySchedule(savedRecords);
  }

  /**
   * Copy weekly schedule from source employee to target employees (Task 7.2)
   */
  async copySchedule(
    organizationId: string,
    dto: CopyWeeklyScheduleDto,
    user: AuthenticatedUser,
  ) {
    if (!organizationId) {
      throw new BadRequestException('organizationId is required');
    }

    // 1. Source staff validation & access
    const sourceStaff = await SchedulingAccessHelper.validateStaff(
      this.prisma,
      dto.sourceStaffId,
      organizationId,
    );

    await SchedulingAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      organizationId,
      'staff_schedule.create',
      sourceStaff.homeBranchId,
      sourceStaff,
    );

    // 2. Retrieve source staff's most recent active weekly schedule
    const sourceSchedules = await this.prisma.sms_staffWeeklySchedules.findMany({
      where: { staffId: dto.sourceStaffId },
      orderBy: { effectiveFrom: 'desc' },
      take: 7,
    });

    if (sourceSchedules.length === 0) {
      throw new BadRequestException({
        code: 'SOURCE_SCHEDULE_NOT_FOUND',
        message: 'Source employee does not have an active weekly schedule to copy from',
      });
    }

    // Map source rows to DayScheduleItemDto
    const dayItems = sourceSchedules.map((s) => ({
      dayOfWeek: s.dayOfWeek,
      isWorking: s.isWorking,
      shiftTemplateId: s.shiftTemplateId,
      customStartTime: formatTime(s.customStartTime),
      customEndTime: formatTime(s.customEndTime),
      customBreakStartTime: formatTime(s.customBreakStartTime),
      customBreakEndTime: formatTime(s.customBreakEndTime),
    }));

    // 3. For each target staff, validate and apply
    const results: any[] = [];
    for (const targetStaffId of dto.targetStaffIds) {
      const targetStaff = await SchedulingAccessHelper.validateStaff(
        this.prisma,
        targetStaffId,
        organizationId,
      );

      // Validate branch access for target
      await SchedulingAccessHelper.validateUserAccess(
        this.prisma,
        this.permissionResolver,
        user,
        organizationId,
        'staff_schedule.create',
        targetStaff.homeBranchId,
        targetStaff,
      );

      const saved = await this.saveWeeklySchedule(
        organizationId,
        {
          staffId: targetStaffId,
          effectiveFrom: dto.effectiveFrom,
          effectiveTo: dto.effectiveTo,
          days: dayItems,
        },
        user,
      );
      results.push(saved);
    }

    await SchedulingAccessHelper.recordAuditLog(
      this.prisma,
      organizationId,
      user.id,
      'COPY_WEEKLY_SCHEDULE',
      { sourceStaffId: dto.sourceStaffId },
      {
        targetStaffIds: dto.targetStaffIds,
        effectiveFrom: dto.effectiveFrom,
      },
    );

    return {
      message: `Weekly schedule successfully copied to ${results.length} employee(s)`,
      count: results.length,
      schedules: results,
    };
  }

  /**
   * Get weekly schedules for an individual employee (Task 7.2)
   */
  async getStaffWeeklySchedule(
    organizationId: string,
    staffId: string,
    queryDate?: string,
    user?: AuthenticatedUser,
  ) {
    const staff = await SchedulingAccessHelper.validateStaff(
      this.prisma,
      staffId,
      organizationId,
    );

    if (user) {
      await SchedulingAccessHelper.validateUserAccess(
        this.prisma,
        this.permissionResolver,
        user,
        organizationId,
        'staff_schedule.view',
        staff.homeBranchId,
        staff,
      );
    }

    const where: Prisma.sms_staffWeeklySchedulesWhereInput = {
      staffId,
    };

    if (queryDate) {
      const targetDate = parseDateOnly(queryDate);
      where.effectiveFrom = { lte: targetDate };
      where.OR = [{ effectiveTo: null }, { effectiveTo: { gte: targetDate } }];
    }

    const rows = await this.prisma.sms_staffWeeklySchedules.findMany({
      where,
      include: {
        shiftTemplate: {
          include: {
            branch: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ effectiveFrom: 'desc' }, { dayOfWeek: 'asc' }],
    });

    return this.groupSchedulesByEffectiveRange(rows);
  }

  /**
   * Get branch-wide team schedule grid for a given week (Task 7.2 UI/UX)
   */
  async getBranchTeamSchedule(
    organizationId: string,
    branchId: string,
    weekStartDateStr: string,
    user: AuthenticatedUser,
  ) {
    if (!branchId) {
      throw new BadRequestException('branchId is required for team schedule view');
    }

    // Branch authorization check
    await SchedulingAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      organizationId,
      'staff_schedule.view',
      branchId,
    );

    const weekStart = parseDateOnly(weekStartDateStr);
    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);

    // Retrieve all staff assigned to this branch
    const staffMembers = await this.prisma.sms_staff.findMany({
      where: {
        organizationId,
        deletedAt: null,
        employmentStatus: 'active',
        OR: [
          { homeBranchId: branchId },
          {
            staffBranchAssignments: {
              some: {
                branchId,
                OR: [
                  { effectiveTo: null },
                  { effectiveTo: { gte: weekStart } },
                ],
              },
            },
          },
        ],
      },
      include: {
        homeBranch: { select: { id: true, name: true, code: true } },
        staffDesignations: true,
        user: { select: { id: true, email: true, displayName: true } },
      },
      orderBy: [{ fullName: 'asc' }],
    });

    const staffIds = staffMembers.map((s) => s.id);

    // Retrieve active weekly schedules that apply during this week
    const weeklyRows = await this.prisma.sms_staffWeeklySchedules.findMany({
      where: {
        staffId: { in: staffIds },
        effectiveFrom: { lte: weekEnd },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: weekStart } }],
      },
      include: {
        shiftTemplate: true,
      },
      orderBy: [{ dayOfWeek: 'asc' }],
    });

    // Retrieve availability preferences for advisory overlay (Task 7.3)
    const preferences = await this.prisma.sms_staffAvailabilityPreferences.findMany({
      where: {
        staffId: { in: staffIds },
      },
    });

    // Retrieve date-specific overrides during this week (Task 7.4)
    const overrides = await this.prisma.sms_staffScheduleOverrides.findMany({
      where: {
        staffId: { in: staffIds },
        overrideDate: { gte: weekStart, lte: weekEnd },
      },
      include: {
        linkedSwap: true,
      },
    });

    // Retrieve blocked time during this week (Task 7.5)
    const blockedTimes = await this.prisma.sms_staffBlockedTime.findMany({
      where: {
        staffId: { in: staffIds },
        branchId,
        OR: [
          { blockDate: { gte: weekStart, lte: weekEnd } },
          { isRecurring: true },
        ],
      },
    });

    // Build 7-day team schedule rows
    const teamGrid = staffMembers.map((staff) => {
      const staffRows = weeklyRows.filter((r) => r.staffId === staff.id);
      const staffPrefs = preferences.filter((p) => p.staffId === staff.id);
      const staffOverrides = overrides.filter((o) => o.staffId === staff.id);
      const staffBlocks = blockedTimes.filter((b) => b.staffId === staff.id);

      // Build each of the 7 days
      const days: any[] = [];
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const currentDate = new Date(weekStart.getTime() + dayOffset * 24 * 60 * 60 * 1000);
        const dayOfWeek = currentDate.getDay(); // 0=Sunday .. 6=Saturday
        const dateStr = formatDate(currentDate);

        // Find applicable weekly schedule row for this date
        const matchingSchedule = staffRows.find(
          (r) =>
            r.dayOfWeek === dayOfWeek &&
            r.effectiveFrom <= currentDate &&
            (!r.effectiveTo || r.effectiveTo >= currentDate),
        );

        // Check for overrides on this date
        const dayOverride = staffOverrides.find(
          (o) => formatDate(o.overrideDate) === dateStr,
        );

        // Check for blocked times on this date
        const dayBlocks = staffBlocks.filter((b) => {
          if (formatDate(b.blockDate) === dateStr) return true;
          if (b.isRecurring) {
            const recurrenceEnd = b.recurrenceEndDate
              ? new Date(b.recurrenceEndDate)
              : null;
            if (recurrenceEnd && currentDate > recurrenceEnd) return false;
            // Match same day of week for recurring blocks
            return new Date(b.blockDate).getDay() === dayOfWeek;
          }
          return false;
        });

        // Check preferences for this weekday / general
        const dayPrefs = staffPrefs.filter(
          (p) => p.dayOfWeek === dayOfWeek || p.dayOfWeek === null,
        );

        let isWorking = matchingSchedule ? matchingSchedule.isWorking : false;
        let startTime: string | null = null;
        let endTime: string | null = null;
        let breakStartTime: string | null = null;
        let breakEndTime: string | null = null;
        let templateName: string | null = null;
        let colorTag = 'default';

        if (matchingSchedule?.isWorking) {
          if (matchingSchedule.shiftTemplate) {
            startTime = formatTime(matchingSchedule.shiftTemplate.startTime);
            endTime = formatTime(matchingSchedule.shiftTemplate.endTime);
            breakStartTime = formatTime(matchingSchedule.shiftTemplate.breakStartTime);
            breakEndTime = formatTime(matchingSchedule.shiftTemplate.breakEndTime);
            templateName = matchingSchedule.shiftTemplate.name;
            colorTag = matchingSchedule.shiftTemplate.colorTag;
          } else {
            startTime = formatTime(matchingSchedule.customStartTime);
            endTime = formatTime(matchingSchedule.customEndTime);
            breakStartTime = formatTime(matchingSchedule.customBreakStartTime);
            breakEndTime = formatTime(matchingSchedule.customBreakEndTime);
            colorTag = 'custom';
          }
        }

        // Apply approved override overlay for display
        let overrideBadge: any = null;
        if (dayOverride && dayOverride.approvalStatus === 'approved') {
          if (dayOverride.overrideType === 'extra_shift') {
            isWorking = true;
            startTime = formatTime(dayOverride.startTime);
            endTime = formatTime(dayOverride.endTime);
            colorTag = 'emerald';
            overrideBadge = { type: 'extra_shift', label: 'Extra Shift' };
          } else if (dayOverride.overrideType === 'day_off') {
            isWorking = false;
            startTime = null;
            endTime = null;
            overrideBadge = { type: 'day_off', label: 'Day Off' };
          } else if (dayOverride.overrideType === 'shift_change') {
            startTime = formatTime(dayOverride.startTime);
            endTime = formatTime(dayOverride.endTime);
            overrideBadge = { type: 'shift_change', label: 'Shift Change' };
          } else if (dayOverride.overrideType === 'early_leave') {
            endTime = formatTime(dayOverride.endTime);
            overrideBadge = { type: 'early_leave', label: 'Early Leave' };
          } else if (dayOverride.overrideType === 'late_arrival') {
            startTime = formatTime(dayOverride.startTime);
            overrideBadge = { type: 'late_arrival', label: 'Late Arrival' };
          }
        } else if (dayOverride && dayOverride.approvalStatus === 'pending') {
          overrideBadge = {
            type: dayOverride.overrideType,
            label: `Pending Approval (${dayOverride.overrideType})`,
            isPending: true,
          };
        }

        days.push({
          date: dateStr,
          dayOfWeek,
          isWorking,
          startTime,
          endTime,
          breakStartTime,
          breakEndTime,
          templateId: matchingSchedule?.shiftTemplateId || null,
          templateName,
          colorTag,
          override: overrideBadge,
          blocksCount: dayBlocks.length,
          preferences: dayPrefs.map((p) => ({
            id: p.id,
            type: p.preferenceType,
            startTime: formatTime(p.startTime),
            endTime: formatTime(p.endTime),
            note: p.note,
          })),
        });
      }

      return {
        staff: {
          id: staff.id,
          fullName: staff.fullName,
          employeeCode: staff.employeeCode,
          email: staff.user?.email || null,
          avatarUrl: staff.profilePhotoUrl || null,
          primaryDesignation:
            staff.staffDesignations?.[0]?.customLabel ||
            staff.staffDesignations?.[0]?.designationType ||
            'Staff Member',
          homeBranch: staff.homeBranch,
        },
        days,
      };
    });

    return {
      branchId,
      weekStartDate: formatDate(weekStart),
      weekEndDate: formatDate(weekEnd),
      totalStaff: staffMembers.length,
      teamGrid,
    };
  }

  /**
   * Helper to format weekly schedule list
   */
  private serializeWeeklySchedule(rows: any[]) {
    if (!rows || rows.length === 0) return null;
    const first = rows[0];

    return {
      staffId: first.staffId,
      effectiveFrom: formatDate(first.effectiveFrom),
      effectiveTo: first.effectiveTo ? formatDate(first.effectiveTo) : null,
      createdAt: first.createdAt,
      updatedAt: first.updatedAt,
      days: rows.map((r) => ({
        id: r.id,
        dayOfWeek: r.dayOfWeek,
        isWorking: r.isWorking,
        shiftTemplateId: r.shiftTemplateId,
        shiftTemplate: r.shiftTemplate
          ? {
              id: r.shiftTemplate.id,
              name: r.shiftTemplate.name,
              startTime: formatTime(r.shiftTemplate.startTime),
              endTime: formatTime(r.shiftTemplate.endTime),
              colorTag: r.shiftTemplate.colorTag,
            }
          : null,
        customStartTime: formatTime(r.customStartTime),
        customEndTime: formatTime(r.customEndTime),
        customBreakStartTime: formatTime(r.customBreakStartTime),
        customBreakEndTime: formatTime(r.customBreakEndTime),
      })),
    };
  }

  /**
   * Helper to group schedule records by effectiveFrom range
   */
  private groupSchedulesByEffectiveRange(rows: any[]) {
    const map = new Map<string, any[]>();
    for (const r of rows) {
      const key = `${formatDate(r.effectiveFrom)}_${r.effectiveTo ? formatDate(r.effectiveTo) : 'ongoing'}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(r);
    }

    const versions: any[] = [];
    for (const group of map.values()) {
      const s = this.serializeWeeklySchedule(group);
      if (s) versions.push(s);
    }
    return versions;
  }
}

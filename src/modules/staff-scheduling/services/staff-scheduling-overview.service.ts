import {
  Injectable,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { EffectivePermissionResolverService } from '../../role-permission/services/effective-permission-resolver.service';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import {
  parseDateOnly,
  formatDate,
  formatTime,
  timeToMinutes,
} from '../utils/time-range.util';
import { SchedulingAccessHelper } from '../utils/scheduling-access.util';

@Injectable()
export class StaffSchedulingOverviewService {
  private readonly logger = new Logger(StaffSchedulingOverviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    private readonly permissionResolver?: EffectivePermissionResolverService,
  ) {}

  /**
   * Get operational overview metrics for Module 07 workspace
   */
  async getOverviewMetrics(
    organizationId: string,
    branchId?: string,
    dateStr?: string,
    user?: AuthenticatedUser,
  ) {
    if (!organizationId) {
      throw new BadRequestException('organizationId is required');
    }

    if (user) {
      await SchedulingAccessHelper.validateUserAccess(
        this.prisma,
        this.permissionResolver,
        user,
        organizationId,
        'staff_schedule.view',
        branchId,
      );
    }

    const todayDate = dateStr ? parseDateOnly(dateStr) : new Date();
    const todayFormatted = formatDate(todayDate);
    const dayOfWeek = todayDate.getDay();
    const nowMinutes = todayDate.getHours() * 60 + todayDate.getMinutes();

    // 1. Total Active Staff
    const staffWhere: any = {
      organizationId,
      deletedAt: null,
      employmentStatus: 'active',
      ...(branchId
        ? {
            OR: [
              { homeBranchId: branchId },
              {
                staffBranchAssignments: {
                  some: {
                    branchId,
                    OR: [
                      { effectiveTo: null },
                      { effectiveTo: { gte: todayDate } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };

    const activeStaff = await this.prisma.sms_staff.findMany({
      where: staffWhere,
      select: { id: true, fullName: true, homeBranchId: true },
    });

    const activeStaffIds = activeStaff.map((s) => s.id);

    // 2. Weekly schedule definitions active today
    const weeklySchedules = await this.prisma.sms_staffWeeklySchedules.findMany({
      where: {
        staffId: { in: activeStaffIds },
        dayOfWeek,
        effectiveFrom: { lte: todayDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: todayDate } }],
      },
      include: {
        shiftTemplate: true,
      },
    });

    // 3. Overrides today
    const overridesToday = await this.prisma.sms_staffScheduleOverrides.findMany({
      where: {
        staffId: { in: activeStaffIds },
        overrideDate: todayDate,
        approvalStatus: 'approved',
      },
      include: {
        staff: { select: { id: true, fullName: true } },
      },
    });

    // 4. Blocked time today
    const blockedTimeToday = await this.prisma.sms_staffBlockedTime.findMany({
      where: {
        staffId: { in: activeStaffIds },
        ...(branchId ? { branchId } : {}),
        OR: [
          { blockDate: todayDate },
          { isRecurring: true },
        ],
      },
      include: {
        staff: { select: { id: true, fullName: true } },
      },
    });

    // 5. Calculate scheduled, working now, and off today counts
    let scheduledCount = 0;
    let currentlyWorkingCount = 0;
    let dayOffCount = 0;

    for (const s of activeStaff) {
      const schedule = weeklySchedules.find((w) => w.staffId === s.id);
      const override = overridesToday.find((o) => o.staffId === s.id);

      let isWorkingToday = schedule ? schedule.isWorking : false;
      let startMin = 0;
      let endMin = 0;

      if (schedule && schedule.isWorking) {
        if (schedule.shiftTemplate) {
          startMin = timeToMinutes(schedule.shiftTemplate.startTime);
          endMin = timeToMinutes(schedule.shiftTemplate.endTime);
        } else if (schedule.customStartTime && schedule.customEndTime) {
          startMin = timeToMinutes(schedule.customStartTime);
          endMin = timeToMinutes(schedule.customEndTime);
        }
      }

      if (override) {
        if (override.overrideType === 'extra_shift') {
          isWorkingToday = true;
          startMin = timeToMinutes(override.startTime);
          endMin = timeToMinutes(override.endTime);
        } else if (override.overrideType === 'day_off') {
          isWorkingToday = false;
        } else if (override.overrideType === 'shift_change') {
          startMin = timeToMinutes(override.startTime);
          endMin = timeToMinutes(override.endTime);
        } else if (override.overrideType === 'early_leave') {
          endMin = timeToMinutes(override.endTime);
        } else if (override.overrideType === 'late_arrival') {
          startMin = timeToMinutes(override.startTime);
        }
      }

      if (isWorkingToday) {
        scheduledCount++;
        if (nowMinutes >= startMin && nowMinutes <= endMin) {
          currentlyWorkingCount++;
        }
      } else {
        dayOffCount++;
      }
    }

    // 6. Upcoming schedule changes (next 30 days)
    const thirtyDaysAhead = new Date(todayDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    const upcomingSchedules = await this.prisma.sms_staffWeeklySchedules.findMany({
      where: {
        staffId: { in: activeStaffIds },
        effectiveFrom: { gt: todayDate, lte: thirtyDaysAhead },
      },
      include: {
        staff: { select: { id: true, fullName: true } },
      },
      distinct: ['staffId', 'effectiveFrom'],
      orderBy: { effectiveFrom: 'asc' },
    });

    // 7. Branch coverage summary
    const branches = await this.prisma.sms_branches.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(branchId ? { id: branchId } : {}),
      },
      select: { id: true, name: true, code: true },
    });

    const branchCoverage = branches.map((b) => {
      const branchStaff = activeStaff.filter((s) => s.homeBranchId === b.id);
      const scheduledBranchStaff = weeklySchedules.filter((ws) => {
        const staffObj = activeStaff.find((s) => s.id === ws.staffId);
        return staffObj?.homeBranchId === b.id && ws.isWorking;
      });
      const coveragePercent =
        branchStaff.length > 0
          ? Math.round((scheduledBranchStaff.length / branchStaff.length) * 100)
          : 0;

      return {
        branchId: b.id,
        branchName: b.name,
        branchCode: b.code,
        totalStaff: branchStaff.length,
        scheduledToday: scheduledBranchStaff.length,
        coveragePercent,
      };
    });

    // 8. 7-Day Trend: compute working staff count for Mon-Sun
    const allWeekSchedules = await this.prisma.sms_staffWeeklySchedules.findMany({
      where: {
        staffId: { in: activeStaffIds },
        effectiveFrom: { lte: todayDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: todayDate } }],
        isWorking: true,
      },
      select: { staffId: true, dayOfWeek: true },
    });

    const dayKeys = [
      { day: 'Mon', index: 1 },
      { day: 'Tue', index: 2 },
      { day: 'Wed', index: 3 },
      { day: 'Thu', index: 4 },
      { day: 'Fri', index: 5 },
      { day: 'Sat', index: 6 },
      { day: 'Sun', index: 0 },
    ];

    const availabilityTrend = dayKeys.map((dk) => {
      const workingStaffOnDay = new Set(
        allWeekSchedules
          .filter((s) => s.dayOfWeek === dk.index)
          .map((s) => s.staffId),
      ).size;
      const onLeaveCount = Math.max(0, activeStaff.length - workingStaffOnDay);

      return {
        day: dk.day,
        dayOfWeek: dk.index,
        working: workingStaffOnDay,
        onLeave: onLeaveCount,
      };
    });

    return {
      date: todayFormatted,
      organizationId,
      branchId: branchId || null,
      kpis: {
        totalActiveStaff: activeStaff.length,
        scheduledToday: scheduledCount,
        currentlyWorking: currentlyWorkingCount,
        onDayOffToday: dayOffCount,
        overridesTodayCount: overridesToday.length,
        blockedTimeTodayCount: blockedTimeToday.length,
        upcomingChangesCount: upcomingSchedules.length,
      },
      recentOverrides: overridesToday.map((o) => ({
        id: o.id,
        staffName: o.staff.fullName,
        type: o.overrideType,
        reason: o.reason,
        startTime: formatTime(o.startTime),
        endTime: formatTime(o.endTime),
      })),
      recentBlocks: blockedTimeToday.map((b) => ({
        id: b.id,
        staffName: b.staff.fullName,
        category: b.reasonCategory,
        startTime: formatTime(b.startTime),
        endTime: formatTime(b.endTime),
        note: b.note,
        isRecurring: b.isRecurring,
      })),
      upcomingChanges: upcomingSchedules.map((u) => ({
        staffId: u.staffId,
        staffName: u.staff.fullName,
        effectiveFrom: formatDate(u.effectiveFrom),
      })),
      branchCoverage,
      availabilityTrend,
    };
  }
}

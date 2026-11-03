import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { EffectivePermissionResolverService } from '../../role-permission/services/effective-permission-resolver.service';
import {
  StaffAvailabilityQueryDto,
  BranchAvailabilityQueryDto,
} from '../dto/availability-query.dto';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import {
  parseDateOnly,
  formatDate,
  formatTime,
  timeToMinutes,
  minutesToTime,
  subtractIntervals,
  generateSlots,
  TimeInterval,
} from '../utils/time-range.util';
import { SchedulingAccessHelper } from '../utils/scheduling-access.util';

export interface StaffAvailabilityResult {
  staff: {
    id: string;
    fullName: string;
    email: string | null;
    avatarUrl: string | null;
    primaryDesignation: string;
    homeBranchId: string;
  };
  organizationId: string;
  branchId: string;
  date: string;
  dayOfWeek: number;
  isBookable: boolean;
  unavailabilityReasons: string[];
  workingIntervals: TimeInterval[];
  breakIntervals: TimeInterval[];
  blockedIntervals: TimeInterval[];
  leaveIntervals: TimeInterval[];
  appointmentIntervals: TimeInterval[];
  overrideApplied: {
    type: string;
    reason: string;
    startTime: string | null;
    endTime: string | null;
  } | null;
  availableIntervals: TimeInterval[];
  timeSlots: Array<{ start: string; end: string; durationMinutes: number }>;
}

@Injectable()
export class AvailabilityEngineService {
  private readonly logger = new Logger(AvailabilityEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    private readonly permissionResolver?: EffectivePermissionResolverService,
  ) {}

  /**
   * Compute effective availability for a single staff member on a specific date (Section 9)
   */
  async getStaffAvailability(
    organizationId: string,
    staffId: string,
    query: StaffAvailabilityQueryDto,
    user?: AuthenticatedUser,
  ): Promise<StaffAvailabilityResult> {
    if (!organizationId) {
      throw new BadRequestException('organizationId is required');
    }

    // 1. Validate employee
    const staff = await SchedulingAccessHelper.validateStaff(
      this.prisma,
      staffId,
      organizationId,
    );

    const targetBranchId = query.branchId || staff.homeBranchId;
    const targetDate = parseDateOnly(query.date);
    const dateStr = formatDate(targetDate);
    const dayOfWeek = targetDate.getDay();

    const unavailabilityReasons: string[] = [];

    // Check staff active status
    if (staff.employmentStatus !== 'active') {
      unavailabilityReasons.push(`Employee status is ${staff.employmentStatus} (not active)`);
    }

    // Check branch eligibility
    if (!SchedulingAccessHelper.isStaffEligibleForBranch(staff, targetBranchId)) {
      unavailabilityReasons.push('Employee is not assigned to work at this branch on this date');
    }

    // 2. Module 06: Service Qualification & Duration Check (if serviceId provided)
    let slotDurationMinutes = query.slotDurationMinutes || 30;
    if (query.serviceId) {
      const staffService = await this.prisma.sms_staffServices.findFirst({
        where: {
          staffId,
          serviceId: query.serviceId,
          isActive: true,
        },
        include: {
          service: true,
          staffServiceBranchOverrides: {
            where: { branchId: targetBranchId },
          },
        },
      });

      if (!staffService) {
        unavailabilityReasons.push('Employee is not qualified or assigned to deliver this service');
      } else {
        // Check branch availability override from Module 06
        const branchOverride = staffService.staffServiceBranchOverrides[0];
        if (branchOverride && !branchOverride.isAvailable) {
          unavailabilityReasons.push('Employee is restricted from performing this service at this branch');
        }

        // Determine effective duration
        if (staffService.durationOverrideMinutes) {
          slotDurationMinutes = staffService.durationOverrideMinutes;
        } else if (staffService.service?.baseDurationMinutes) {
          slotDurationMinutes = staffService.service.baseDurationMinutes;
        }
      }
    }

    // 3. Weekly Schedule Resolution
    const weeklySchedule = await this.prisma.sms_staffWeeklySchedules.findFirst({
      where: {
        staffId,
        dayOfWeek,
        effectiveFrom: { lte: targetDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: targetDate } }],
      },
      include: {
        shiftTemplate: true,
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    let isWorking = weeklySchedule ? weeklySchedule.isWorking : false;
    let baseStartMin = 0;
    let baseEndMin = 0;
    const breakIntervals: TimeInterval[] = [];

    if (weeklySchedule && weeklySchedule.isWorking) {
      if (weeklySchedule.shiftTemplate) {
        baseStartMin = timeToMinutes(weeklySchedule.shiftTemplate.startTime);
        baseEndMin = timeToMinutes(weeklySchedule.shiftTemplate.endTime);
        if (weeklySchedule.shiftTemplate.breakStartTime && weeklySchedule.shiftTemplate.breakEndTime) {
          breakIntervals.push({
            start: formatTime(weeklySchedule.shiftTemplate.breakStartTime)!,
            end: formatTime(weeklySchedule.shiftTemplate.breakEndTime)!,
            label: 'Shift Break',
            source: 'template',
          });
        }
      } else if (weeklySchedule.customStartTime && weeklySchedule.customEndTime) {
        baseStartMin = timeToMinutes(weeklySchedule.customStartTime);
        baseEndMin = timeToMinutes(weeklySchedule.customEndTime);
        if (weeklySchedule.customBreakStartTime && weeklySchedule.customBreakEndTime) {
          breakIntervals.push({
            start: formatTime(weeklySchedule.customBreakStartTime)!,
            end: formatTime(weeklySchedule.customBreakEndTime)!,
            label: 'Custom Break',
            source: 'custom',
          });
        }
      }
    }

    // 4. Check Approved Schedule Overrides for this Date (Task 7.4)
    const override = await this.prisma.sms_staffScheduleOverrides.findFirst({
      where: {
        staffId,
        overrideDate: targetDate,
        approvalStatus: 'approved',
      },
    });

    let overrideApplied: {
      type: string;
      reason: string;
      startTime: string | null;
      endTime: string | null;
    } | null = null;

    if (override) {
      overrideApplied = {
        type: override.overrideType,
        reason: override.reason,
        startTime: formatTime(override.startTime),
        endTime: formatTime(override.endTime),
      };

      if (override.overrideType === 'day_off') {
        isWorking = false;
        unavailabilityReasons.push(`Employee has an approved day off on this date ("${override.reason}")`);
      } else if (override.overrideType === 'extra_shift') {
        isWorking = true;
        baseStartMin = timeToMinutes(override.startTime);
        baseEndMin = timeToMinutes(override.endTime);
      } else if (override.overrideType === 'shift_change') {
        baseStartMin = timeToMinutes(override.startTime);
        baseEndMin = timeToMinutes(override.endTime);
      } else if (override.overrideType === 'early_leave') {
        baseEndMin = timeToMinutes(override.endTime);
      } else if (override.overrideType === 'late_arrival') {
        baseStartMin = timeToMinutes(override.startTime);
      }
    }

    if (!isWorking && !overrideApplied) {
      unavailabilityReasons.push('Employee is scheduled off (recurring day off)');
    }

    // 5. Check Approved Leave Requests (Module 09)
    const leaveIntervals: TimeInterval[] = [];
    const leave = await this.prisma.sms_staffLeaveRequests.findFirst({
      where: {
        staffId,
        status: 'approved',
        startDate: { lte: targetDate },
        endDate: { gte: targetDate },
      },
      include: {
        leaveType: { select: { name: true } },
      },
    });

    if (leave) {
      if (leave.isHalfDay) {
        if (leave.halfDayPeriod === 'morning') {
          leaveIntervals.push({
            start: '09:00',
            end: '13:00',
            label: `Half Day Leave (${leave.leaveType?.name || 'Leave'})`,
          });
        } else {
          leaveIntervals.push({
            start: '13:00',
            end: '18:00',
            label: `Half Day Leave (${leave.leaveType?.name || 'Leave'})`,
          });
        }
      } else {
        isWorking = false;
        unavailabilityReasons.push(
          `Employee has approved leave: ${leave.leaveType?.name || 'Leave'} (${formatDate(
            leave.startDate,
          )} to ${formatDate(leave.endDate)})`,
        );
      }
    }

    // 6. Check Blocked Time (Task 7.5)
    const blockedIntervals: TimeInterval[] = [];
    const blocks = await this.prisma.sms_staffBlockedTime.findMany({
      where: {
        staffId,
        branchId: targetBranchId,
        OR: [
          { blockDate: targetDate },
          { isRecurring: true },
        ],
      },
    });

    for (const b of blocks) {
      let applies = false;
      if (formatDate(b.blockDate) === dateStr) {
        applies = true;
      } else if (b.isRecurring) {
        const recurrenceEnd = b.recurrenceEndDate
          ? new Date(b.recurrenceEndDate)
          : null;
        if (!recurrenceEnd || targetDate <= recurrenceEnd) {
          applies = new Date(b.blockDate).getDay() === dayOfWeek;
        }
      }

      if (applies) {
        blockedIntervals.push({
          start: formatTime(b.startTime)!,
          end: formatTime(b.endTime)!,
          label: `Blocked: ${b.reasonCategory}${b.note ? ` (${b.note})` : ''}`,
          source: 'blocked_time',
        });
      }
    }

    // 7. Check Existing Confirmed Appointments (Module 18)
    const appointmentIntervals: TimeInterval[] = [];
    try {
      if ((this.prisma as any).sms_appointments) {
        const appointments = await (this.prisma as any).sms_appointments.findMany({
          where: {
            staffId,
            branchId: targetBranchId,
            appointmentDate: targetDate,
            status: { in: ['confirmed', 'in_progress', 'scheduled'] },
          },
        });
        for (const appt of appointments) {
          appointmentIntervals.push({
            start: formatTime(appt.startTime)!,
            end: formatTime(appt.endTime)!,
            label: `Appointment #${appt.id.substring(0, 8)}`,
            source: 'appointment',
          });
        }
      }
    } catch {
      // Appointments table not yet modeled
    }

    // 8. Math Interval Subtraction: working - (breaks + blocked + leave + appointments)
    let availableIntervals: TimeInterval[] = [];
    let timeSlots: Array<{ start: string; end: string; durationMinutes: number }> = [];

    const isBookable = isWorking && unavailabilityReasons.length === 0 && baseEndMin > baseStartMin;

    if (isBookable) {
      const busyIntervals = [
        ...breakIntervals.map((b) => ({
          startMin: timeToMinutes(b.start),
          endMin: timeToMinutes(b.end),
        })),
        ...blockedIntervals.map((b) => ({
          startMin: timeToMinutes(b.start),
          endMin: timeToMinutes(b.end),
        })),
        ...leaveIntervals.map((l) => ({
          startMin: timeToMinutes(l.start),
          endMin: timeToMinutes(l.end),
        })),
        ...appointmentIntervals.map((a) => ({
          startMin: timeToMinutes(a.start),
          endMin: timeToMinutes(a.end),
        })),
      ];

      const freeMinutesIntervals = subtractIntervals(baseStartMin, baseEndMin, busyIntervals);

      availableIntervals = freeMinutesIntervals.map((f) => ({
        start: minutesToTime(f.startMin),
        end: minutesToTime(f.endMin),
      }));

      // Generate discrete booking slots
      timeSlots = generateSlots(freeMinutesIntervals, slotDurationMinutes, 15);
    }

    return {
      staff: {
        id: staff.id,
        fullName: staff.fullName,
        email: staff.user?.email || null,
        avatarUrl: staff.profilePhotoUrl || null,
        primaryDesignation: 'Staff Member',
        homeBranchId: staff.homeBranchId,
      },
      organizationId,
      branchId: targetBranchId,
      date: dateStr,
      dayOfWeek,
      isBookable,
      unavailabilityReasons,
      workingIntervals: isWorking && baseEndMin > baseStartMin
        ? [{ start: minutesToTime(baseStartMin), end: minutesToTime(baseEndMin) }]
        : [],
      breakIntervals,
      blockedIntervals,
      leaveIntervals,
      appointmentIntervals,
      overrideApplied,
      availableIntervals,
      timeSlots,
    };
  }

  /**
   * Batch availability for all active staff at a branch on a date
   */
  async getBranchStaffAvailability(
    organizationId: string,
    branchId: string,
    query: BranchAvailabilityQueryDto,
    user?: AuthenticatedUser,
  ) {
    if (!branchId) {
      throw new BadRequestException('branchId is required');
    }

    // Retrieve active staff assigned to this branch
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
                  { effectiveTo: { gte: parseDateOnly(query.date) } },
                ],
              },
            },
          },
        ],
      },
      select: { id: true },
    });

    const staffResults: StaffAvailabilityResult[] = [];
    for (const s of staffMembers) {
      const res = await this.getStaffAvailability(
        organizationId,
        s.id,
        {
          date: query.date,
          branchId,
          serviceId: query.serviceId,
          slotDurationMinutes: query.slotDurationMinutes,
        },
        user,
      );
      staffResults.push(res);
    }

    return {
      branchId,
      date: query.date,
      serviceId: query.serviceId || null,
      slotDurationMinutes: query.slotDurationMinutes || 30,
      totalStaff: staffMembers.length,
      availableStaffCount: staffResults.filter((s) => s.isBookable && s.availableIntervals.length > 0).length,
      staff: staffResults,
    };
  }
}

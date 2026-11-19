import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CheckInDto } from '../dto/check-in.dto';
import { CheckOutDto } from '../dto/check-out.dto';
import { ManualAttendanceEntryDto } from '../dto/manual-attendance.dto';
import { KioskPunchDto } from '../dto/kiosk-punch.dto';
import { QueryAttendanceDto } from '../dto/query-attendance.dto';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { AttendanceCalculatorService, ShiftInfo } from './attendance-calculator.service';
import { AttendancePolicyService } from './attendance-policy.service';
import { AttendanceAccessHelper } from '../utils/attendance-access.util';
import { validateGeofence } from '../utils/geofence.util';
import { EffectivePermissionResolverService } from '../../role-permission/services/effective-permission-resolver.service';
import * as bcrypt from 'bcrypt';

// In-memory rate limiting for failed kiosk attempts: Map<employeeCode, { attempts: number, lockUntil: number }>
const kioskAttempts = new Map<string, { attempts: number; lockUntil: number }>();

export function formatTimeFromDate(d: Date | string | null | undefined): string {
  if (!d) return '00:00';
  if (typeof d === 'string') return d.slice(0, 5);
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const mins = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${mins}`;
}

export function calculateBreakDuration(
  start?: Date | null,
  end?: Date | null,
): number {
  if (!start || !end) return 0;
  const diffMs = Math.max(0, end.getTime() - start.getTime());
  return Math.floor(diffMs / 60000);
}

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: AttendanceCalculatorService,
    private readonly policyService: AttendancePolicyService,
    private readonly permissionResolver: EffectivePermissionResolverService,
  ) {}

  /**
   * Helper to normalize a Date into UTC Date at midnight (00:00:00.000)
   */
  normalizeDate(d: Date | string = new Date()): Date {
    const date = new Date(d);
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  }

  /**
   * Resolve scheduled shift for a staff member on a specific date (Module 07 integration)
   */
  async resolveStaffShift(
    staffId: string,
    targetDate: Date,
    branchId: string,
  ): Promise<{
    shift: ShiftInfo | null;
    isOnLeave: boolean;
    isHoliday: boolean;
  }> {
    const dayOfWeek = targetDate.getDay(); // 0 = Sun, 1 = Mon ...
    const dateMidnight = this.normalizeDate(targetDate);

    // 1. Check Approved Leave Requests (Module 09)
    const leave = await this.prisma.sms_staffLeaveRequests.findFirst({
      where: {
        staffId,
        status: 'approved',
        startDate: { lte: targetDate },
        endDate: { gte: targetDate },
      },
    });
    if (leave) {
      return { shift: null, isOnLeave: true, isHoliday: false };
    }

    // 2. Check Branch Holiday
    const holiday = await this.prisma.sms_holidays.findFirst({
      where: {
        branchId,
        holidayDate: dateMidnight,
        status: 'active',
      },
    });
    if (holiday) {
      return { shift: null, isOnLeave: false, isHoliday: true };
    }

    // 3. Check Date-Specific Approved Schedule Override (Task 7.4)
    const override = await this.prisma.sms_staffScheduleOverrides.findFirst({
      where: {
        staffId,
        overrideDate: dateMidnight,
        approvalStatus: 'approved',
      },
    });

    if (override) {
      if (override.overrideType === 'day_off') {
        return { shift: null, isOnLeave: false, isHoliday: false };
      }
      if (override.startTime && override.endTime) {
        return {
          shift: {
            startTime: formatTimeFromDate(override.startTime),
            endTime: formatTimeFromDate(override.endTime),
            breakDurationMinutes: 0,
            isOvernight: false,
          },
          isOnLeave: false,
          isHoliday: false,
        };
      }
    }

    // 4. Resolve Regular Weekly Schedule (Task 7.2)
    const weeklySchedule = await this.prisma.sms_staffWeeklySchedules.findFirst({
      where: {
        staffId,
        dayOfWeek,
        effectiveFrom: { lte: targetDate },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: targetDate } },
        ],
      },
      orderBy: { effectiveFrom: 'desc' },
      include: {
        shiftTemplate: true,
      },
    });

    if (!weeklySchedule || !weeklySchedule.isWorking) {
      return { shift: null, isOnLeave: false, isHoliday: false };
    }

    if (weeklySchedule.customStartTime && weeklySchedule.customEndTime) {
      return {
        shift: {
          startTime: formatTimeFromDate(weeklySchedule.customStartTime),
          endTime: formatTimeFromDate(weeklySchedule.customEndTime),
          breakDurationMinutes: calculateBreakDuration(
            weeklySchedule.customBreakStartTime,
            weeklySchedule.customBreakEndTime,
          ),
          isOvernight: false,
        },
        isOnLeave: false,
        isHoliday: false,
      };
    }

    if (!weeklySchedule.shiftTemplate) {
      return { shift: null, isOnLeave: false, isHoliday: false };
    }

    const tpl = weeklySchedule.shiftTemplate;
    return {
      shift: {
        startTime: formatTimeFromDate(tpl.startTime),
        endTime: formatTimeFromDate(tpl.endTime),
        breakDurationMinutes: calculateBreakDuration(
          tpl.breakStartTime,
          tpl.breakEndTime,
        ),
        isOvernight: false,
      },
      isOnLeave: false,
      isHoliday: false,
    };
  }

  /**
   * Task 8.1: Staff Check-In
   */
  async checkIn(
    user: AuthenticatedUser,
    dto: CheckInDto,
    queryOrgId?: string,
  ) {
    const orgId = AttendanceAccessHelper.resolveOrgId(user, queryOrgId);

    // 1. Resolve Staff
    let staff;
    if (dto.staffId) {
      staff = await AttendanceAccessHelper.validateStaff(this.prisma, dto.staffId, orgId);
      // Validate caller has permission to check in for another staff
      await AttendanceAccessHelper.validateUserAccess(
        this.prisma,
        this.permissionResolver,
        user,
        orgId,
        'staff_attendance.create',
        dto.branchId,
        staff,
      );
    } else {
      staff = await AttendanceAccessHelper.resolveStaffForUser(this.prisma, user, orgId);
      if (!staff) {
        throw new NotFoundException({
          code: 'STAFF_NOT_LINKED',
          message: 'No active employee profile linked to your user account.',
        });
      }
      if (staff.employmentStatus !== 'active') {
        throw new BadRequestException('Your employee profile is not currently active.');
      }
    }

    // 2. Validate Branch Assignment
    if (!AttendanceAccessHelper.isStaffEligibleForBranch(staff, dto.branchId)) {
      throw new ForbiddenException({
        code: 'BRANCH_NOT_ASSIGNED',
        message: 'You are not assigned to work at this branch.',
      });
    }

    // 3. Resolve Effective Policy and Check Allowed Method
    const policy = await this.policyService.getEffectivePolicy(orgId, dto.branchId);
    const allowed = (policy.allowedCheckinMethods || '')
      .split(',')
      .map((s) => s.trim().toLowerCase());

    if (!allowed.includes(dto.method.toLowerCase())) {
      throw new BadRequestException({
        code: 'CHECKIN_METHOD_DISABLED',
        message: `Check-in method '${dto.method}' is disabled by attendance policy for this branch. Allowed: ${allowed.join(', ')}`,
      });
    }

    // 4. Geofence Verification if geofenced_app method
    if (dto.method === 'geofenced_app') {
      if (dto.latitude === undefined || dto.longitude === undefined) {
        throw new BadRequestException({
          code: 'GPS_COORDINATES_REQUIRED',
          message: 'Geolocation coordinates (latitude, longitude) are required for mobile check-in.',
        });
      }

      const branchAddress = await this.prisma.sms_branchAddresses.findUnique({
        where: { branchId: dto.branchId },
      });

      if (
        branchAddress &&
        branchAddress.latitude !== null &&
        branchAddress.longitude !== null
      ) {
        const branchLat = Number(branchAddress.latitude);
        const branchLon = Number(branchAddress.longitude);
        const maxRadius = 200; // 200 meters default branch perimeter

        const geoCheck = validateGeofence(
          dto.latitude,
          dto.longitude,
          branchLat,
          branchLon,
          maxRadius,
        );

        if (!geoCheck.isWithinGeofence) {
          throw new BadRequestException({
            code: 'GEOFENCE_VERIFICATION_FAILED',
            message: geoCheck.message,
            distanceMeters: geoCheck.distanceInMeters,
            allowedRadiusMeters: maxRadius,
          });
        }
      }
    }

    // 5. Check Existing Attendance for Today
    const today = new Date();
    const todayMidnight = this.normalizeDate(today);

    const existing = await this.prisma.sms_staffAttendance.findUnique({
      where: {
        staffId_attendanceDate: {
          staffId: staff.id,
          attendanceDate: todayMidnight,
        },
      },
    });

    // Duplicate Check-In Rule: Treated as a safe no-op with friendly message
    if (existing && existing.checkInAt && !existing.checkOutAt) {
      const timeStr = existing.checkInAt.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
      return {
        success: true,
        message: `You're already checked in since ${timeStr}.`,
        alreadyCheckedIn: true,
        attendance: existing,
      };
    }

    if (existing && existing.isLocked) {
      throw new ForbiddenException({
        code: 'PERIOD_LOCKED',
        message: 'Attendance for this date is locked by pay-period approval.',
      });
    }

    // 6. Resolve Scheduled Shift & Compute Status
    const { shift, isOnLeave, isHoliday } = await this.resolveStaffShift(
      staff.id,
      today,
      dto.branchId,
    );

    const checkInTime = new Date();
    const calculation = this.calculator.calculateDailyAttendance(
      checkInTime,
      null,
      shift,
      policy,
      isOnLeave,
      isHoliday,
      today,
    );

    let attendanceRecord;
    if (existing) {
      attendanceRecord = await this.prisma.sms_staffAttendance.update({
        where: { id: existing.id },
        data: {
          branchId: dto.branchId,
          checkInAt: checkInTime,
          checkInMethod: dto.method,
          status: calculation.status,
        },
      });
    } else {
      attendanceRecord = await this.prisma.sms_staffAttendance.create({
        data: {
          staffId: staff.id,
          branchId: dto.branchId,
          attendanceDate: todayMidnight,
          checkInAt: checkInTime,
          checkInMethod: dto.method,
          status: calculation.status,
          workedMinutes: null,
          overtimeMinutes: 0,
        },
      });
    }

    await AttendanceAccessHelper.recordAuditLog(
      this.prisma,
      orgId,
      user.id,
      'attendance.check_in',
      existing,
      attendanceRecord,
    );

    return {
      success: true,
      message: `Checked in successfully at ${checkInTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}. Status: ${calculation.status.toUpperCase().replace('_', ' ')}.`,
      attendance: attendanceRecord,
      shift,
    };
  }

  /**
   * Task 8.1: Staff Check-Out
   */
  async checkOut(
    user: AuthenticatedUser,
    dto: CheckOutDto,
    queryOrgId?: string,
  ) {
    const orgId = AttendanceAccessHelper.resolveOrgId(user, queryOrgId);

    // 1. Resolve Staff
    let staff;
    if (dto.staffId) {
      staff = await AttendanceAccessHelper.validateStaff(this.prisma, dto.staffId, orgId);
      await AttendanceAccessHelper.validateUserAccess(
        this.prisma,
        this.permissionResolver,
        user,
        orgId,
        'staff_attendance.update',
        dto.branchId,
        staff,
      );
    } else {
      staff = await AttendanceAccessHelper.resolveStaffForUser(this.prisma, user, orgId);
      if (!staff) {
        throw new NotFoundException('No active employee profile linked to your user account.');
      }
    }

    const today = new Date();
    const todayMidnight = this.normalizeDate(today);

    // 2. Find Open Check-In
    const existing = await this.prisma.sms_staffAttendance.findUnique({
      where: {
        staffId_attendanceDate: {
          staffId: staff.id,
          attendanceDate: todayMidnight,
        },
      },
    });

    if (!existing || !existing.checkInAt) {
      throw new BadRequestException({
        code: 'NO_MATCHING_CHECKIN',
        message: 'Check-out attempted with no matching check-in for today. Please submit a retroactive correction request or contact your manager.',
      });
    }

    if (existing.checkOutAt) {
      return {
        success: true,
        message: `You have already checked out today at ${existing.checkOutAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}.`,
        alreadyCheckedOut: true,
        attendance: existing,
      };
    }

    if (existing.isLocked) {
      throw new ForbiddenException({
        code: 'PERIOD_LOCKED',
        message: 'This attendance record is locked by pay-period approval.',
      });
    }

    // 3. Resolve Policy & Shift
    const policy = await this.policyService.getEffectivePolicy(orgId, dto.branchId);
    const { shift, isOnLeave, isHoliday } = await this.resolveStaffShift(
      staff.id,
      today,
      dto.branchId,
    );

    const checkOutTime = new Date();
    const calculation = this.calculator.calculateDailyAttendance(
      existing.checkInAt,
      checkOutTime,
      shift,
      policy,
      isOnLeave,
      isHoliday,
      today,
    );

    // 4. Update Attendance with Worked Minutes & Overtime
    const updated = await this.prisma.sms_staffAttendance.update({
      where: { id: existing.id },
      data: {
        checkOutAt: checkOutTime,
        checkOutMethod: dto.method,
        workedMinutes: calculation.workedMinutes,
        overtimeMinutes: calculation.overtimeMinutes,
        status: calculation.status,
      },
    });

    await AttendanceAccessHelper.recordAuditLog(
      this.prisma,
      orgId,
      user.id,
      'attendance.check_out',
      existing,
      updated,
    );

    const hours = Math.floor((calculation.workedMinutes || 0) / 60);
    const mins = (calculation.workedMinutes || 0) % 60;

    return {
      success: true,
      message: `Checked out successfully at ${checkOutTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}. Total worked: ${hours}h ${mins}m. Status: ${calculation.status.toUpperCase().replace('_', ' ')}.`,
      attendance: updated,
      workedMinutes: calculation.workedMinutes,
      overtimeMinutes: calculation.overtimeMinutes,
    };
  }

  /**
   * Task 8.1: Front-Desk Kiosk Punch (PIN Entry)
   */
  async kioskPunch(dto: KioskPunchDto, clientIp?: string) {
    const code = (dto.employeeCode || '').trim();

    // 1. Check Rate Limiter
    const attemptInfo = kioskAttempts.get(code);
    const now = Date.now();
    if (attemptInfo && attemptInfo.lockUntil > now) {
      const waitSeconds = Math.ceil((attemptInfo.lockUntil - now) / 1000);
      throw new ForbiddenException({
        code: 'KIOSK_RATE_LIMITED',
        message: `Too many incorrect PIN attempts. Kiosk access locked for ${waitSeconds} seconds.`,
      });
    }

    // 2. Look up Staff
    const staff = await this.prisma.sms_staff.findFirst({
      where: {
        employeeCode: code,
        deletedAt: null,
      },
      include: {
        user: true,
        homeBranch: true,
        staffBranchAssignments: true,
      },
    });

    if (!staff) {
      this.recordFailedKioskAttempt(code);
      throw new NotFoundException({
        code: 'STAFF_NOT_FOUND',
        message: 'Invalid employee code.',
      });
    }

    if (staff.employmentStatus !== 'active') {
      throw new BadRequestException('Employee account is inactive.');
    }

    // 3. Verify Branch Assignment
    if (!AttendanceAccessHelper.isStaffEligibleForBranch(staff, dto.branchId)) {
      throw new ForbiddenException('Staff member is not assigned to this kiosk branch.');
    }

    // 4. Verify PIN
    // Expected PIN: Check if matches user password hash (if numeric), or staff last 4 digits of employeeCode / default PIN '1234'
    let isPinValid = false;
    if (dto.pin === '1234' || dto.pin === code.slice(-4)) {
      isPinValid = true;
    } else if (staff.user?.passwordHash) {
      try {
        isPinValid = await bcrypt.compare(dto.pin, staff.user.passwordHash);
      } catch {
        isPinValid = false;
      }
    }

    if (!isPinValid) {
      this.recordFailedKioskAttempt(code);
      throw new BadRequestException({
        code: 'INVALID_PIN',
        message: 'Incorrect PIN. Please re-enter your 4-digit PIN.',
      });
    }

    // Reset attempts on successful PIN
    kioskAttempts.delete(code);

    // 5. Determine whether to Check In or Check Out
    const today = new Date();
    const todayMidnight = this.normalizeDate(today);

    const existing = await this.prisma.sms_staffAttendance.findUnique({
      where: {
        staffId_attendanceDate: {
          staffId: staff.id,
          attendanceDate: todayMidnight,
        },
      },
    });

    const isCheckOut = existing && existing.checkInAt && !existing.checkOutAt;

    if (isCheckOut) {
      // Perform Check-Out
      const checkOutRes = await this.checkOut(
        { id: staff.userId || 'kiosk', roles: ['FRONT_DESK'], organizationId: staff.organizationId } as any,
        {
          staffId: staff.id,
          branchId: dto.branchId,
          method: 'manual',
        },
        staff.organizationId,
      );
      return {
        action: 'check_out',
        staffName: staff.fullName,
        employeeCode: staff.employeeCode,
        profilePhotoUrl: staff.profilePhotoUrl,
        ...checkOutRes,
      };
    } else {
      // Perform Check-In
      const checkInRes = await this.checkIn(
        { id: staff.userId || 'kiosk', roles: ['FRONT_DESK'], organizationId: staff.organizationId } as any,
        {
          staffId: staff.id,
          branchId: dto.branchId,
          method: 'manual',
        },
        staff.organizationId,
      );
      return {
        action: 'check_in',
        staffName: staff.fullName,
        employeeCode: staff.employeeCode,
        profilePhotoUrl: staff.profilePhotoUrl,
        ...checkInRes,
      };
    }
  }

  private recordFailedKioskAttempt(code: string) {
    const entry = kioskAttempts.get(code) || { attempts: 0, lockUntil: 0 };
    entry.attempts += 1;
    if (entry.attempts >= 5) {
      entry.lockUntil = Date.now() + 15 * 60 * 1000; // 15 mins lock
    }
    kioskAttempts.set(code, entry);
  }

  /**
   * Task 8.1: Authorized Manual Attendance Entry (Admin/Manager Entry)
   */
  async manualAttendanceEntry(
    user: AuthenticatedUser,
    dto: ManualAttendanceEntryDto,
    queryOrgId?: string,
  ) {
    const orgId = AttendanceAccessHelper.resolveOrgId(user, queryOrgId);
    const staff = await AttendanceAccessHelper.validateStaff(this.prisma, dto.staffId, orgId);

    await AttendanceAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      orgId,
      'staff_attendance.create',
      dto.branchId,
      staff,
    );

    const attDate = this.normalizeDate(dto.attendanceDate);

    // Check if period is locked
    const existing = await this.prisma.sms_staffAttendance.findUnique({
      where: {
        staffId_attendanceDate: {
          staffId: staff.id,
          attendanceDate: attDate,
        },
      },
    });

    if (existing?.isLocked) {
      throw new ForbiddenException({
        code: 'PERIOD_LOCKED',
        message: 'Cannot manually modify a locked attendance record. Reopen the pay period first.',
      });
    }

    const checkInAt = dto.checkInAt ? new Date(dto.checkInAt) : null;
    const checkOutAt = dto.checkOutAt ? new Date(dto.checkOutAt) : null;

    if (checkInAt && checkOutAt && checkOutAt <= checkInAt) {
      throw new BadRequestException('Check-out time must be after check-in time.');
    }

    const policy = await this.policyService.getEffectivePolicy(orgId, dto.branchId);
    const { shift, isOnLeave, isHoliday } = await this.resolveStaffShift(
      staff.id,
      attDate,
      dto.branchId,
    );

    const calculation = this.calculator.calculateDailyAttendance(
      checkInAt,
      checkOutAt,
      shift,
      policy,
      isOnLeave,
      isHoliday,
      attDate,
    );

    const status = dto.status || calculation.status;

    let result;
    if (existing) {
      result = await this.prisma.sms_staffAttendance.update({
        where: { id: existing.id },
        data: {
          branchId: dto.branchId,
          checkInAt,
          checkInMethod: checkInAt ? 'admin_entry' : existing.checkInMethod,
          checkOutAt,
          checkOutMethod: checkOutAt ? 'admin_entry' : existing.checkOutMethod,
          workedMinutes: calculation.workedMinutes,
          overtimeMinutes: calculation.overtimeMinutes,
          status,
        },
      });
    } else {
      result = await this.prisma.sms_staffAttendance.create({
        data: {
          staffId: staff.id,
          branchId: dto.branchId,
          attendanceDate: attDate,
          checkInAt,
          checkInMethod: checkInAt ? 'admin_entry' : null,
          checkOutAt,
          checkOutMethod: checkOutAt ? 'admin_entry' : null,
          workedMinutes: calculation.workedMinutes,
          overtimeMinutes: calculation.overtimeMinutes,
          status,
        },
      });
    }

    await AttendanceAccessHelper.recordAuditLog(
      this.prisma,
      orgId,
      user.id,
      'attendance.manual_entry',
      existing,
      { ...result, manualReason: dto.reason },
    );

    return {
      success: true,
      message: 'Manual attendance record recorded successfully.',
      attendance: result,
    };
  }

  /**
   * Task 8.1 & Task 8.2: Get Daily Attendance Roster
   */
  async getDailyAttendance(
    user: AuthenticatedUser,
    organizationId: string,
    query: QueryAttendanceDto,
  ) {
    const orgId = AttendanceAccessHelper.resolveOrgId(user, organizationId);
    const targetDate = query.date ? new Date(query.date) : new Date();
    const dateMidnight = this.normalizeDate(targetDate);

    // 1. Build Staff filter
    const staffWhere: any = {
      organizationId: orgId,
      deletedAt: null,
      employmentStatus: 'active',
    };

    if (query.branchId) {
      staffWhere.OR = [
        { homeBranchId: query.branchId },
        { staffBranchAssignments: { some: { branchId: query.branchId } } },
      ];
    }

    if (query.search) {
      staffWhere.AND = [
        {
          OR: [
            { fullName: { contains: query.search, mode: 'insensitive' } },
            { employeeCode: { contains: query.search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const [totalStaff, staffList] = await Promise.all([
      this.prisma.sms_staff.count({ where: staffWhere }),
      this.prisma.sms_staff.findMany({
        where: staffWhere,
        skip,
        take: limit,
        orderBy: { fullName: 'asc' },
        include: {
          homeBranch: { select: { id: true, name: true, code: true } },
          staffDesignations: {
            where: { isPrimary: true },
            select: { designationType: true, customLabel: true },
          },
          staffAttendance: {
            where: { attendanceDate: dateMidnight },
            take: 1,
            include: {
              staffAttendanceCorrections: {
                where: { status: 'pending' },
                take: 1,
              },
            },
          },
        },
      }),
    ]);

    // 2. Fetch Effective Policy for Cutoff calculation
    const policy = await this.policyService.getEffectivePolicy(orgId, query.branchId);

    // 3. Map staff roster with live attendance evaluation
    const rows = await Promise.all(
      staffList.map(async (st: any) => {
        const branchId = query.branchId || st.homeBranchId;
        const { shift, isOnLeave, isHoliday } = await this.resolveStaffShift(
          st.id,
          targetDate,
          branchId,
        );

        const record = st.staffAttendance?.[0] || null;
        let evaluatedStatus = record ? record.status : 'absent';

        if (!record) {
          const calc = this.calculator.calculateDailyAttendance(
            null,
            null,
            shift,
            policy,
            isOnLeave,
            isHoliday,
            targetDate,
          );
          evaluatedStatus = calc.status;
        }

        const pendingCorrection = record?.staffAttendanceCorrections?.[0] || null;
        const designation = st.staffDesignations?.[0]?.customLabel || st.staffDesignations?.[0]?.designationType || 'Staff';

        return {
          staffId: st.id,
          employeeCode: st.employeeCode,
          fullName: st.fullName,
          profilePhotoUrl: st.profilePhotoUrl,
          designation,
          homeBranch: st.homeBranch,
          scheduledShift: shift
            ? `${shift.startTime} - ${shift.endTime}`
            : isOnLeave
            ? 'On Leave'
            : isHoliday
            ? 'Holiday'
            : 'No Shift',
          shift,
          attendanceId: record?.id || null,
          checkInAt: record?.checkInAt || null,
          checkInMethod: record?.checkInMethod || null,
          checkOutAt: record?.checkOutAt || null,
          checkOutMethod: record?.checkOutMethod || null,
          workedMinutes: record?.workedMinutes ?? null,
          overtimeMinutes: record?.overtimeMinutes || 0,
          status: evaluatedStatus,
          isLocked: record?.isLocked || false,
          isCurrentlyIn: Boolean(record?.checkInAt && !record?.checkOutAt),
          hasPendingCorrection: Boolean(pendingCorrection),
          pendingCorrectionId: pendingCorrection?.id || null,
        };
      }),
    );

    // Apply status filter in-memory if requested (since status can be dynamically calculated)
    const filteredRows = query.status
      ? rows.filter((r) => r.status === query.status)
      : rows;

    return {
      date: dateMidnight.toISOString().split('T')[0],
      total: totalStaff,
      page,
      limit,
      totalPages: Math.ceil(totalStaff / limit),
      data: filteredRows,
    };
  }

  /**
   * Task 8.1: Live Currently Checked-In Staff Roster
   */
  async getCurrentlyCheckedIn(
    user: AuthenticatedUser,
    organizationId: string,
    branchId?: string,
  ) {
    const orgId = AttendanceAccessHelper.resolveOrgId(user, organizationId);
    const todayMidnight = this.normalizeDate(new Date());

    const where: any = {
      attendanceDate: todayMidnight,
      checkInAt: { not: null },
      checkOutAt: null,
      staff: {
        organizationId: orgId,
        deletedAt: null,
      },
    };

    if (branchId) {
      where.branchId = branchId;
    }

    const records = await this.prisma.sms_staffAttendance.findMany({
      where,
      include: {
        staff: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            profilePhotoUrl: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { checkInAt: 'desc' },
    });

    const mapped = records.map((r) => {
      const elapsedMs = Math.max(0, Date.now() - (r.checkInAt ? r.checkInAt.getTime() : Date.now()));
      const mins = Math.floor(elapsedMs / 60000);
      return {
        attendanceId: r.id,
        staffId: r.staff.id,
        employeeCode: r.staff.employeeCode,
        fullName: r.staff.fullName,
        profilePhotoUrl: r.staff.profilePhotoUrl,
        branch: r.branch,
        checkInAt: r.checkInAt,
        checkInMethod: r.checkInMethod,
        currentDurationMinutes: mins,
        currentDurationFormatted: `${Math.floor(mins / 60)}h ${mins % 60}m`,
        status: r.status,
      };
    });

    return {
      count: mapped.length,
      data: mapped,
    };
  }

  /**
   * Task 8.1 & Task 8.3: My Attendance Self-Service (Staff view)
   */
  async getMyAttendance(
    user: AuthenticatedUser,
    organizationId: string,
    query: QueryAttendanceDto,
  ) {
    const orgId = AttendanceAccessHelper.resolveOrgId(user, organizationId);
    const staff = await AttendanceAccessHelper.resolveStaffForUser(this.prisma, user, orgId);

    if (!staff) {
      throw new NotFoundException({
        code: 'STAFF_NOT_LINKED',
        message: 'No active employee profile linked to your user account.',
      });
    }

    const today = new Date();
    const todayMidnight = this.normalizeDate(today);

    // 1. Get today's attendance & scheduled shift
    const [todayRecord, todayShift] = await Promise.all([
      this.prisma.sms_staffAttendance.findUnique({
        where: {
          staffId_attendanceDate: {
            staffId: staff.id,
            attendanceDate: todayMidnight,
          },
        },
      }),
      this.resolveStaffShift(staff.id, today, staff.homeBranchId),
    ]);

    // 2. Fetch History with pagination
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const historyWhere: any = {
      staffId: staff.id,
    };

    if (query.startDate && query.endDate) {
      historyWhere.attendanceDate = {
        gte: this.normalizeDate(query.startDate),
        lte: this.normalizeDate(query.endDate),
      };
    }

    const [totalHistory, history] = await Promise.all([
      this.prisma.sms_staffAttendance.count({ where: historyWhere }),
      this.prisma.sms_staffAttendance.findMany({
        where: historyWhere,
        skip,
        take: limit,
        orderBy: { attendanceDate: 'desc' },
        include: {
          branch: { select: { id: true, name: true, code: true } },
          staffAttendanceCorrections: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
    ]);

    return {
      staff: {
        id: staff.id,
        fullName: staff.fullName,
        employeeCode: staff.employeeCode,
        homeBranchId: staff.homeBranchId,
      },
      today: {
        date: todayMidnight.toISOString().split('T')[0],
        attendance: todayRecord,
        scheduledShift: todayShift.shift,
        isOnLeave: todayShift.isOnLeave,
        isHoliday: todayShift.isHoliday,
        isCurrentlyIn: Boolean(todayRecord?.checkInAt && !todayRecord?.checkOutAt),
      },
      history: {
        total: totalHistory,
        page,
        limit,
        totalPages: Math.ceil(totalHistory / limit),
        data: history,
      },
    };
  }
}

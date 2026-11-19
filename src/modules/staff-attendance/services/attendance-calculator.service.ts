import { Injectable } from '@nestjs/common';
import { sms_staffAttendance_status } from '@prisma/client';

export interface ShiftInfo {
  startTime: string; // e.g. "09:00"
  endTime: string;   // e.g. "17:00"
  breakDurationMinutes?: number;
  isOvernight?: boolean;
}

export interface AttendanceCalculationResult {
  status: sms_staffAttendance_status;
  workedMinutes: number | null;
  overtimeMinutes: number;
  isLate: boolean;
  isEarlyExit: boolean;
  isHalfDay: boolean;
  lateMinutes: number;
  earlyExitMinutes: number;
  rawOvertimeMinutes: number;
}

export interface AttendancePolicyRules {
  lateGraceMinutes: number;
  earlyExitGraceMinutes: number;
  halfDayThresholdMinutes: number;
  overtimeThresholdMinutes: number;
  overtimeRequiresApproval: boolean;
  absentCutoffMinutes: number;
}

@Injectable()
export class AttendanceCalculatorService {
  /**
   * Helper to parse HH:mm into minutes from start of day
   */
  private parseTimeToMinutes(timeStr: string): number {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map((s) => parseInt(s, 10));
    return (h || 0) * 60 + (m || 0);
  }

  /**
   * Construct absolute Date object from date string/Date and "HH:mm" time in UTC
   */
  combineDateAndTime(baseDate: Date, timeStr: string, isNextDay = false): Date {
    const d = new Date(baseDate);
    const [hours, minutes] = (timeStr || '00:00').split(':').map(Number);
    d.setUTCHours(hours, minutes, 0, 0);
    if (isNextDay) {
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return d;
  }

  /**
   * Primary calculation engine for attendance status, worked minutes, and overtime
   */
  calculateDailyAttendance(
    checkInAt: Date | null,
    checkOutAt: Date | null,
    shift: ShiftInfo | null,
    policy: AttendancePolicyRules,
    isOnLeave: boolean = false,
    isHoliday: boolean = false,
    attendanceDate: Date = new Date(),
  ): AttendanceCalculationResult {
    // 1. Leave & Holiday have precedence if no punches exist
    if (!checkInAt && !checkOutAt) {
      if (isOnLeave) {
        return {
          status: 'on_leave',
          workedMinutes: null,
          overtimeMinutes: 0,
          isLate: false,
          isEarlyExit: false,
          isHalfDay: false,
          lateMinutes: 0,
          earlyExitMinutes: 0,
          rawOvertimeMinutes: 0,
        };
      }
      if (isHoliday) {
        return {
          status: 'holiday',
          workedMinutes: null,
          overtimeMinutes: 0,
          isLate: false,
          isEarlyExit: false,
          isHalfDay: false,
          lateMinutes: 0,
          earlyExitMinutes: 0,
          rawOvertimeMinutes: 0,
        };
      }

      // Check if current time has exceeded the absent cutoff relative to scheduled shift
      const now = new Date();
      if (shift?.startTime) {
        const scheduledStart = this.combineDateAndTime(attendanceDate, shift.startTime);
        const cutoffTime = new Date(
          scheduledStart.getTime() + policy.absentCutoffMinutes * 60000,
        );
        if (now > cutoffTime) {
          return {
            status: 'absent',
            workedMinutes: null,
            overtimeMinutes: 0,
            isLate: false,
            isEarlyExit: false,
            isHalfDay: false,
            lateMinutes: 0,
            earlyExitMinutes: 0,
            rawOvertimeMinutes: 0,
          };
        }
      }

      // Pre-shift or within cutoff before clock-in
      return {
        status: 'absent',
        workedMinutes: null,
        overtimeMinutes: 0,
        isLate: false,
        isEarlyExit: false,
        isHalfDay: false,
        lateMinutes: 0,
        earlyExitMinutes: 0,
        rawOvertimeMinutes: 0,
      };
    }

    // 2. We have at least a Check-In
    let isLate = false;
    let lateMinutes = 0;

    if (checkInAt && shift?.startTime) {
      const scheduledStart = this.combineDateAndTime(attendanceDate, shift.startTime);
      const diffMs = checkInAt.getTime() - scheduledStart.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins > policy.lateGraceMinutes) {
        isLate = true;
        lateMinutes = diffMins;
      }
    }

    // If checked in but not checked out yet:
    if (checkInAt && !checkOutAt) {
      return {
        status: isLate ? 'late' : 'present',
        workedMinutes: null,
        overtimeMinutes: 0,
        isLate,
        isEarlyExit: false,
        isHalfDay: false,
        lateMinutes,
        earlyExitMinutes: 0,
        rawOvertimeMinutes: 0,
      };
    }

    // 3. Both Check-In and Check-Out exist
    let workedMinutes = 0;
    let overtimeMinutes = 0;
    let isEarlyExit = false;
    let earlyExitMinutes = 0;
    let isHalfDay = false;
    let rawOvertimeMinutes = 0;

    if (checkInAt && checkOutAt) {
      const elapsedMs = Math.max(0, checkOutAt.getTime() - checkInAt.getTime());
      let elapsedMins = Math.floor(elapsedMs / 60000);

      // Subtract break minutes if recorded or if planned break applies on worked duration > 300 mins
      const breakMins = shift?.breakDurationMinutes || 0;
      if (elapsedMins > 300 && breakMins > 0) {
        elapsedMins = Math.max(0, elapsedMins - breakMins);
      }
      workedMinutes = elapsedMins;

      // Half-day check: If worked less than threshold (e.g. 240 mins)
      if (workedMinutes < policy.halfDayThresholdMinutes) {
        isHalfDay = true;
      }

      // Early-exit check against scheduled shift end
      if (shift?.endTime) {
        const isNextDay = (shift.isOvernight ?? false) ||
          this.parseTimeToMinutes(shift.endTime) < this.parseTimeToMinutes(shift.startTime);
        const scheduledEnd = this.combineDateAndTime(attendanceDate, shift.endTime, isNextDay);

        const diffEndMs = scheduledEnd.getTime() - checkOutAt.getTime();
        const diffEndMins = Math.floor(diffEndMs / 60000);

        if (diffEndMins > policy.earlyExitGraceMinutes) {
          isEarlyExit = true;
          earlyExitMinutes = diffEndMins;
        }

        // Overtime check beyond scheduled shift end
        const pastEndMs = checkOutAt.getTime() - scheduledEnd.getTime();
        const pastEndMins = Math.floor(pastEndMs / 60000);

        if (pastEndMins >= policy.overtimeThresholdMinutes) {
          rawOvertimeMinutes = pastEndMins;
          overtimeMinutes = pastEndMins;
        }
      }
    }

    // Determine primary daily status according to precedence:
    // Half Day > Late / Early Exit > Present
    let finalStatus: sms_staffAttendance_status = 'present';
    if (isHalfDay) {
      finalStatus = 'half_day';
    } else if (isLate) {
      finalStatus = 'late';
    } else if (isEarlyExit) {
      finalStatus = 'early_exit';
    } else {
      finalStatus = 'present';
    }

    return {
      status: finalStatus,
      workedMinutes,
      overtimeMinutes,
      isLate,
      isEarlyExit,
      isHalfDay,
      lateMinutes,
      earlyExitMinutes,
      rawOvertimeMinutes,
    };
  }
}

import { AttendanceCalculatorService } from './attendance-calculator.service';
import { calculateDistanceInMeters, validateGeofence } from '../utils/geofence.util';

describe('Module 08: Staff Attendance Unit Tests', () => {
  let calculator: AttendanceCalculatorService;

  beforeEach(() => {
    calculator = new AttendanceCalculatorService();
  });

  const defaultPolicy = {
    lateGraceMinutes: 10,
    earlyExitGraceMinutes: 10,
    halfDayThresholdMinutes: 240, // 4 hours
    overtimeThresholdMinutes: 15,
    overtimeRequiresApproval: true,
    absentCutoffMinutes: 120, // 2 hours
  };

  const shift9to5 = {
    startTime: '09:00',
    endTime: '17:00',
    breakDurationMinutes: 60,
    isOvernight: false,
  };

  describe('AttendanceCalculatorService', () => {
    it('should mark Present if employee arrives within late grace period (e.g. 09:08)', () => {
      const checkIn = new Date('2026-11-18T09:08:00.000Z');
      const checkOut = new Date('2026-11-18T17:00:00.000Z');
      const baseDate = new Date('2026-11-18T00:00:00.000Z');

      const result = calculator.calculateDailyAttendance(
        checkIn,
        checkOut,
        shift9to5,
        defaultPolicy,
        false,
        false,
        baseDate,
      );

      expect(result.isLate).toBe(false);
      expect(result.status).toBe('present');
      expect(result.workedMinutes).toBe(412); // 472m - 60m break = 412m
    });

    it('should mark Late if employee arrives past late grace period (e.g. 09:15)', () => {
      const checkIn = new Date('2026-11-18T09:15:00.000Z');
      const checkOut = new Date('2026-11-18T17:00:00.000Z');
      const baseDate = new Date('2026-11-18T00:00:00.000Z');

      const result = calculator.calculateDailyAttendance(
        checkIn,
        checkOut,
        shift9to5,
        defaultPolicy,
        false,
        false,
        baseDate,
      );

      expect(result.isLate).toBe(true);
      expect(result.lateMinutes).toBe(15);
      expect(result.status).toBe('late');
    });

    it('should mark Early Exit if employee leaves before early exit grace period', () => {
      const checkIn = new Date('2026-11-18T09:00:00.000Z');
      const checkOut = new Date('2026-11-18T16:30:00.000Z'); // 30 mins before 17:00 (grace is 10)
      const baseDate = new Date('2026-11-18T00:00:00.000Z');

      const result = calculator.calculateDailyAttendance(
        checkIn,
        checkOut,
        shift9to5,
        defaultPolicy,
        false,
        false,
        baseDate,
      );

      expect(result.isEarlyExit).toBe(true);
      expect(result.earlyExitMinutes).toBe(30);
      expect(result.status).toBe('early_exit');
    });

    it('should mark Half Day if total worked duration is below halfDayThresholdMinutes (e.g. 3 hours)', () => {
      const checkIn = new Date('2026-11-18T09:00:00.000Z');
      const checkOut = new Date('2026-11-18T12:00:00.000Z'); // 180 mins (< 240 threshold)
      const baseDate = new Date('2026-11-18T00:00:00.000Z');

      const result = calculator.calculateDailyAttendance(
        checkIn,
        checkOut,
        shift9to5,
        defaultPolicy,
        false,
        false,
        baseDate,
      );

      expect(result.isHalfDay).toBe(true);
      expect(result.status).toBe('half_day');
      expect(result.workedMinutes).toBe(180);
    });

    it('should calculate Overtime when worked past scheduled shift end exceeding threshold', () => {
      const checkIn = new Date('2026-11-18T09:00:00.000Z');
      const checkOut = new Date('2026-11-18T18:00:00.000Z'); // 60 mins past 17:00 (threshold is 15)
      const baseDate = new Date('2026-11-18T00:00:00.000Z');

      const result = calculator.calculateDailyAttendance(
        checkIn,
        checkOut,
        shift9to5,
        defaultPolicy,
        false,
        false,
        baseDate,
      );

      expect(result.overtimeMinutes).toBe(60);
      expect(result.status).toBe('present');
    });

    it('should respect On Leave and Holiday status when no punches exist', () => {
      const baseDate = new Date('2026-11-18T00:00:00.000Z');

      const leaveResult = calculator.calculateDailyAttendance(
        null,
        null,
        shift9to5,
        defaultPolicy,
        true, // isOnLeave
        false,
        baseDate,
      );
      expect(leaveResult.status).toBe('on_leave');

      const holidayResult = calculator.calculateDailyAttendance(
        null,
        null,
        shift9to5,
        defaultPolicy,
        false,
        true, // isHoliday
        baseDate,
      );
      expect(holidayResult.status).toBe('holiday');
    });

    it('should mark Absent when cutoff time is exceeded without punch', () => {
      const baseDate = new Date('2026-11-18T00:00:00.000Z');

      const result = calculator.calculateDailyAttendance(
        null,
        null,
        shift9to5,
        defaultPolicy,
        false,
        false,
        baseDate,
      );
      expect(result.status).toBe('absent');
      expect(result.workedMinutes).toBeNull();
    });

    it('should handle zero-break shifts accurately', () => {
      const zeroBreakShift = {
        startTime: '10:00',
        endTime: '14:00',
        breakDurationMinutes: 0,
        isOvernight: false,
      };
      const checkIn = new Date('2026-11-18T10:00:00.000Z');
      const checkOut = new Date('2026-11-18T14:00:00.000Z');
      const baseDate = new Date('2026-11-18T00:00:00.000Z');

      const result = calculator.calculateDailyAttendance(
        checkIn,
        checkOut,
        zeroBreakShift,
        defaultPolicy,
        false,
        false,
        baseDate,
      );

      expect(result.status).toBe('present');
      expect(result.workedMinutes).toBe(240); // 4h = 240m
    });
  });

  describe('Geofence Utilities (Haversine Formula)', () => {
    // Salon location: Connaught Place, New Delhi (28.6315, 77.2167)
    const branchLat = 28.6315;
    const branchLon = 77.2167;

    it('should pass check if employee is within 100 meters', () => {
      // 50 meters away
      const userLat = 28.6318;
      const userLon = 77.2170;

      const res = validateGeofence(userLat, userLon, branchLat, branchLon, 200);
      expect(res.isWithinGeofence).toBe(true);
      expect(res.distanceInMeters).toBeLessThan(200);
    });

    it('should reject check if employee is 500 meters outside branch perimeter', () => {
      // ~500 meters away
      const userLat = 28.6360;
      const userLon = 77.2200;

      const res = validateGeofence(userLat, userLon, branchLat, branchLon, 200);
      expect(res.isWithinGeofence).toBe(false);
      expect(res.distanceInMeters).toBeGreaterThan(200);
      expect(res.message).toContain('Geofence check failed');
    });
  });
});

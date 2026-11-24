import { PrismaService } from '../../../database/prisma.service';

export interface LeaveCalculationResult {
  totalRequestedDays: number;
  workingDays: number;
  holidayDays: number;
  weekendDays: number;
  datesList: { date: string; isWorkingDay: boolean; isHoliday: boolean; holidayName?: string }[];
}

export class LeaveCalculatorUtil {
  /**
   * Normalize any Date/String to midnight UTC Date
   */
  static normalizeDate(val: string | Date): Date {
    const d = new Date(val);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  }

  /**
   * Calculate leave duration excluding holidays and non-working days
   */
  static async calculateLeaveDuration(
    prisma: PrismaService,
    staffId: string,
    organizationId: string,
    branchId: string,
    startDate: Date,
    endDate: Date,
    isHalfDay: boolean = false,
  ): Promise<LeaveCalculationResult> {
    if (isHalfDay) {
      return {
        totalRequestedDays: 0.5,
        workingDays: 0.5,
        holidayDays: 0,
        weekendDays: 0,
        datesList: [
          {
            date: startDate.toISOString().split('T')[0],
            isWorkingDay: true,
            isHoliday: false,
          },
        ],
      };
    }

    // 1. Fetch staff weekly schedule
    const weeklySchedules = await prisma.sms_staffWeeklySchedules.findMany({
      where: {
        staffId,
        effectiveFrom: { lte: endDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: startDate } }],
      },
    });

    const weeklyWorkingMap = new Map<number, boolean>();
    for (const ws of weeklySchedules) {
      weeklyWorkingMap.set(ws.dayOfWeek, ws.isWorking);
    }

    // 2. Fetch Organization & Branch Holidays
    const holidays = await prisma.sms_holidays.findMany({
      where: {
        organizationId,
        status: 'active',
        OR: [{ branchId: null }, { branchId }],
        holidayDate: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const holidayDateMap = new Map<string, string>();
    for (const h of holidays) {
      const key = h.holidayDate.toISOString().split('T')[0];
      holidayDateMap.set(key, h.name);
    }

    // 3. Iterate each calendar day in date range
    const datesList: { date: string; isWorkingDay: boolean; isHoliday: boolean; holidayName?: string }[] = [];
    let workingDays = 0;
    let holidayDays = 0;
    let weekendDays = 0;

    const curr = new Date(startDate.getTime());
    while (curr <= endDate) {
      const dateKey = curr.toISOString().split('T')[0];
      const dayOfWeek = curr.getUTCDay(); // 0 = Sun, 1 = Mon ...

      // Default: Mon-Sat working if no weekly schedule defined
      const isWorkingDay = weeklyWorkingMap.has(dayOfWeek)
        ? Boolean(weeklyWorkingMap.get(dayOfWeek))
        : dayOfWeek !== 0; // Sunday off by default

      const holidayName = holidayDateMap.get(dateKey);
      const isHoliday = Boolean(holidayName);

      if (isHoliday) {
        holidayDays++;
      } else if (!isWorkingDay) {
        weekendDays++;
      } else {
        workingDays++;
      }

      datesList.push({
        date: dateKey,
        isWorkingDay,
        isHoliday,
        holidayName,
      });

      curr.setUTCDate(curr.getUTCDate() + 1);
    }

    const totalRequestedDays = Math.max(0, workingDays);

    return {
      totalRequestedDays,
      workingDays,
      holidayDays,
      weekendDays,
      datesList,
    };
  }

  /**
   * Deterministic pro-rata annual entitlement calculation for mid-year joiners
   */
  static calculateProRataEntitlement(
    joiningDate: Date,
    annualEntitlement: number,
    leaveYear: number = new Date().getFullYear(),
  ): number {
    const joinYear = joiningDate.getFullYear();
    if (joinYear > leaveYear) {
      return 0;
    }
    if (joinYear < leaveYear) {
      return annualEntitlement;
    }

    // Joined in the current leave year
    const joinMonth = joiningDate.getMonth(); // 0-based: 0 = Jan, 11 = Dec
    const remainingMonths = 12 - joinMonth;
    const proRata = (remainingMonths / 12) * annualEntitlement;
    return Math.round(proRata * 10) / 10;
  }
}

/**
 * Staff Scheduling Time Range Utilities
 */

export interface TimeInterval {
  start: string; // "HH:mm"
  end: string;   // "HH:mm"
  label?: string;
  source?: string;
  metadata?: any;
}

/**
 * Convert "HH:mm" or "HH:mm:ss" or Date to minutes from midnight (0..1439)
 */
export function timeToMinutes(time: string | Date | null | undefined): number {
  if (!time) return 0;
  if (time instanceof Date) {
    const hours = time.getUTCHours();
    const minutes = time.getUTCMinutes();
    return hours * 60 + minutes;
  }
  const parts = String(time).split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

/**
 * Convert minutes from midnight to "HH:mm"
 */
export function minutesToTime(minutes: number): string {
  const normalized = Math.max(0, Math.min(1439, Math.floor(minutes)));
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Format a Date object (stored as Prisma @db.Time or DateTime) to "HH:mm"
 */
export function formatTime(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{2}:\d{2}/.test(value)) {
    return value.substring(0, 5);
  }
  if (value instanceof Date) {
    const h = String(value.getUTCHours()).padStart(2, '0');
    const m = String(value.getUTCMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
  return null;
}

/**
 * Format a Date object (stored as Prisma @db.Date or DateTime) to "YYYY-MM-DD"
 */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.substring(0, 10);
  }
  const d = new Date(value);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Create a UTC Date for Prisma @db.Time from "HH:mm" string (using base 1970-01-01)
 */
export function parseTimeToDate(timeStr: string | null | undefined): Date | null {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map((v) => parseInt(v, 10) || 0);
  const d = new Date(Date.UTC(1970, 0, 1, h, m, 0, 0));
  return d;
}

/**
 * Create a UTC Date for Prisma @db.Date from "YYYY-MM-DD" string
 */
export function parseDateOnly(dateStr: string | Date): Date {
  if (dateStr instanceof Date) {
    return new Date(Date.UTC(dateStr.getFullYear(), dateStr.getMonth(), dateStr.getDate()));
  }
  const parts = dateStr.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  return new Date(Date.UTC(y, m, d));
}

/**
 * Validate that break is entirely within shift, and start < end
 */
export function validateShiftAndBreakTimes(
  startTimeStr: string,
  endTimeStr: string,
  breakStartTimeStr?: string | null,
  breakEndTimeStr?: string | null,
): { valid: boolean; error?: string } {
  const startMin = timeToMinutes(startTimeStr);
  const endMin = timeToMinutes(endTimeStr);

  if (endMin <= startMin) {
    return {
      valid: false,
      error: 'Shift end time must be after start time (overnight shifts not enabled)',
    };
  }

  if (breakStartTimeStr || breakEndTimeStr) {
    if (!breakStartTimeStr || !breakEndTimeStr) {
      return {
        valid: false,
        error: 'Both break start time and break end time must be specified',
      };
    }

    const bStartMin = timeToMinutes(breakStartTimeStr);
    const bEndMin = timeToMinutes(breakEndTimeStr);

    if (bEndMin <= bStartMin) {
      return {
        valid: false,
        error: 'Break end time must be after break start time',
      };
    }

    if (bStartMin < startMin || bEndMin > endMin) {
      return {
        valid: false,
        error: 'Break period must be inside the shift start and end times',
      };
    }
  }

  return { valid: true };
}

/**
 * Mathematical interval subtraction:
 * Given a base working interval [startMin, endMin], and a set of busy intervals,
 * subtract all busy intervals and return disjoint free intervals.
 */
export function subtractIntervals(
  baseStartMin: number,
  baseEndMin: number,
  busyIntervals: Array<{ startMin: number; endMin: number }>,
): Array<{ startMin: number; endMin: number }> {
  if (baseEndMin <= baseStartMin) return [];

  // Sort and clamp busy intervals to [baseStartMin, baseEndMin]
  const clampedBusy = busyIntervals
    .map((b) => ({
      startMin: Math.max(baseStartMin, Math.min(baseEndMin, b.startMin)),
      endMin: Math.max(baseStartMin, Math.min(baseEndMin, b.endMin)),
    }))
    .filter((b) => b.endMin > b.startMin)
    .sort((a, b) => a.startMin - b.startMin);

  // Merge overlapping busy intervals
  const mergedBusy: Array<{ startMin: number; endMin: number }> = [];
  for (const b of clampedBusy) {
    if (mergedBusy.length === 0) {
      mergedBusy.push({ ...b });
    } else {
      const last = mergedBusy[mergedBusy.length - 1];
      if (b.startMin <= last.endMin) {
        last.endMin = Math.max(last.endMin, b.endMin);
      } else {
        mergedBusy.push({ ...b });
      }
    }
  }

  // Subtract merged busy intervals from base interval
  const result: Array<{ startMin: number; endMin: number }> = [];
  let currentStart = baseStartMin;

  for (const busy of mergedBusy) {
    if (busy.startMin > currentStart) {
      result.push({ startMin: currentStart, endMin: busy.startMin });
    }
    currentStart = Math.max(currentStart, busy.endMin);
  }

  if (currentStart < baseEndMin) {
    result.push({ startMin: currentStart, endMin: baseEndMin });
  }

  return result;
}

/**
 * Generate discrete time slots inside available intervals
 */
export function generateSlots(
  availableIntervals: Array<{ startMin: number; endMin: number }>,
  slotDurationMinutes: number = 30,
  stepMinutes: number = 15,
): Array<{ start: string; end: string; durationMinutes: number }> {
  const slots: Array<{ start: string; end: string; durationMinutes: number }> = [];

  for (const interval of availableIntervals) {
    let slotStart = interval.startMin;
    while (slotStart + slotDurationMinutes <= interval.endMin) {
      const slotEnd = slotStart + slotDurationMinutes;
      slots.push({
        start: minutesToTime(slotStart),
        end: minutesToTime(slotEnd),
        durationMinutes: slotDurationMinutes,
      });
      slotStart += stepMinutes;
    }
  }

  return slots;
}


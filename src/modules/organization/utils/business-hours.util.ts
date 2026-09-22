export const TIME_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

/**
 * Validates 24-hour HH:mm time string
 */
export function isValidTimeString(time: string): boolean {
  if (typeof time !== 'string') return false;
  return TIME_REGEX.test(time.trim());
}

/**
 * Converts HH:mm time string into minutes from midnight (0 to 1439)
 */
export function timeToMinutes(time: string): number {
  if (!isValidTimeString(time)) return 0;
  const [hours, minutes] = time.trim().split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Checks if closing time occurs on the following calendar day (spans midnight)
 */
export function doesSpanMidnight(openTime: string, closeTime: string): boolean {
  if (!isValidTimeString(openTime) || !isValidTimeString(closeTime)) {
    return false;
  }
  return timeToMinutes(closeTime) < timeToMinutes(openTime);
}

/**
 * Validates break period within configured business shift bounds
 */
export function isValidBreakPeriod(
  openTime: string,
  closeTime: string,
  breakStart: string,
  breakEnd: string,
): boolean {
  if (
    !isValidTimeString(openTime) ||
    !isValidTimeString(closeTime) ||
    !isValidTimeString(breakStart) ||
    !isValidTimeString(breakEnd)
  ) {
    return false;
  }

  const openMin = timeToMinutes(openTime);
  const closeMin = timeToMinutes(closeTime);
  const bStartMin = timeToMinutes(breakStart);
  const bEndMin = timeToMinutes(breakEnd);

  // Non-midnight schedule (e.g. 09:00 -> 18:00)
  if (closeMin > openMin) {
    return bStartMin >= openMin && bEndMin <= closeMin && bStartMin < bEndMin;
  }

  // Overnight schedule spanning midnight (e.g. 18:00 -> 02:00)
  // Shift is [openMin .. 1439] U [0 .. closeMin]
  const isBStartInEvening = bStartMin >= openMin;
  const isBStartInMorning = bStartMin <= closeMin;

  if (!isBStartInEvening && !isBStartInMorning) {
    return false;
  }

  if (isBStartInEvening) {
    // Break starts in evening segment (>= openMin)
    if (bEndMin > bStartMin) {
      // Ends same evening (e.g. 19:00 -> 20:00)
      return true;
    }
    // Ends morning segment after midnight (e.g. 23:30 -> 00:30)
    return bEndMin <= closeMin;
  } else {
    // Break starts in morning segment after midnight (<= closeMin)
    return bEndMin > bStartMin && bEndMin <= closeMin;
  }
}

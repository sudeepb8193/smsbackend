export const SUPPORTED_CURRENCY_MAP: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'AED',
  CAD: 'CA$',
  AUD: 'A$',
  SGD: 'S$',
  JPY: '¥',
  CNY: '¥',
  BRL: 'R$',
  ZAR: 'R',
  SAR: 'SAR',
  QAR: 'QAR',
  KWD: 'KD',
  OMR: 'OMR',
  BHD: 'BD',
  NZD: 'NZ$',
  CHF: 'CHF',
  SEK: 'kr',
  NOK: 'kr',
  MXN: 'Mex$',
  THB: '฿',
  IDR: 'Rp',
  MYR: 'RM',
  PHP: '₱',
  VND: '₫',
  EGP: 'E£',
  ILS: '₪',
  KRW: '₩',
  TRY: '₺',
  RUB: '₽',
  PLN: 'zł',
};

export const ALLOWED_DATE_FORMATS = [
  'DD/MM/YYYY',
  'MM/DD/YYYY',
  'YYYY-MM-DD',
  'DD-MM-YYYY',
  'D/M/YYYY',
];

export const ALLOWED_TIME_FORMATS = ['12-hour', '24-hour'];

export const ALLOWED_LANGUAGE_CODES = [
  'en',
  'hi',
  'kn',
  'ta',
  'te',
  'mr',
  'bn',
  'gu',
  'es',
  'fr',
  'de',
  'ar',
  'pt',
  'ru',
  'zh',
  'ja',
  'ko',
];

/**
 * Validates ISO 4217 Currency Code
 */
export function isValidCurrencyCode(code: string): boolean {
  if (typeof code !== 'string') return false;
  const upper = code.trim().toUpperCase();
  return Boolean(SUPPORTED_CURRENCY_MAP[upper]);
}

/**
 * Get standard symbol for ISO 4217 currency code
 */
export function getCurrencySymbol(code: string): string {
  if (!code) return '$';
  const upper = code.trim().toUpperCase();
  return SUPPORTED_CURRENCY_MAP[upper] || upper;
}

/**
 * Validates IANA Timezone string
 */
export function isValidTimezone(timezone: string): boolean {
  if (typeof timezone !== 'string' || !timezone.trim()) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone.trim() });
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates date display format
 */
export function isValidDateFormat(format: string): boolean {
  return typeof format === 'string' && ALLOWED_DATE_FORMATS.includes(format);
}

/**
 * Validates time display format
 */
export function isValidTimeFormat(format: string): boolean {
  return typeof format === 'string' && ALLOWED_TIME_FORMATS.includes(format);
}

/**
 * Validates language code
 */
export function isValidLanguageCode(code: string): boolean {
  if (typeof code !== 'string') return false;
  const lower = code.trim().toLowerCase();
  return ALLOWED_LANGUAGE_CODES.includes(lower);
}

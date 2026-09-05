export enum OrganizationBusinessType {
  SALON = 'salon',
  SPA = 'spa',
  UNISEX_SALON = 'unisex_salon',
  BARBERSHOP = 'barbershop',
  WELLNESS_CENTER = 'wellness_center',
  OTHER = 'other',
}

export enum OrganizationStatus {
  ONBOARDING = 'onboarding',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  INACTIVE = 'inactive',
}

export enum ContactType {
  PRIMARY = 'primary',
  SUPPORT = 'support',
  BILLING = 'billing',
  EMERGENCY = 'emergency',
}

export enum AddressType {
  REGISTERED = 'registered',
  BILLING = 'billing',
}

export enum TaxIdentifierType {
  GSTIN = 'gstin',
  VAT = 'vat',
  EIN = 'ein',
  TIN = 'tin',
  PAN = 'pan',
  OTHER = 'other',
}

export enum VerificationStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

export enum CurrencySymbolPosition {
  PREFIX = 'prefix',
  SUFFIX = 'suffix',
}

export enum TimeFormat {
  TWELVE_HOUR = '12h',
  TWENTY_FOUR_HOUR = '24h',
}

export enum FirstDayOfWeek {
  SUNDAY = 'sunday',
  MONDAY = 'monday',
}

export enum DateFormat {
  DD_MM_YYYY = 'DD/MM/YYYY',
  MM_DD_YYYY = 'MM/DD/YYYY',
  YYYY_MM_DD = 'YYYY-MM-DD',
}

export enum HolidayStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
}

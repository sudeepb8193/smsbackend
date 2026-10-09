import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const BUSINESS_TYPES = [
  'salon',
  'spa',
  'unisex_salon',
  'barbershop',
  'wellness_center',
  'other',
];
const CONTACT_TYPES = ['primary', 'support', 'billing', 'emergency'];
const TAX_TYPES = ['gstin', 'vat', 'ein', 'tin', 'pan', 'other'];
const TAX_VERIFICATION_STATUSES = ['pending', 'verified', 'rejected'];

export class OrganisationSetupProfileDto {
  @IsString()
  @Length(2, 150)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(0, 150)
  legalName?: string | null;

  @IsString()
  @Length(1, 160)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @IsIn(BUSINESS_TYPES)
  businessType!: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  logoUrl?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  logoSquareUrl?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  logoWideUrl?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  faviconUrl?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  brandPrimaryColor?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  brandSecondaryColor?: string | null;

  @IsIn(['onboarding', 'active', 'suspended', 'inactive'])
  status!: string;

  @IsInt()
  @Min(0)
  @Max(7)
  onboardingStep!: number;
}

export class OrganisationSetupContactDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsIn(CONTACT_TYPES)
  contactType!: string;

  @IsOptional()
  @IsString()
  @Length(0, 150)
  contactName?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 10)
  phoneCountryCode?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 20)
  phoneNumber?: string | null;

  @IsOptional()
  @IsEmail()
  @Length(0, 255)
  email?: string | null;

  @IsBoolean()
  isDefaultPublic!: boolean;

  @IsOptional()
  @IsBoolean()
  sameAsPrimary?: boolean;
}

export class OrganisationSetupAddressDto {
  @IsIn(['registered', 'billing'])
  addressType!: string;

  @IsOptional()
  @IsString()
  @Length(0, 255)
  addressLine1?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 255)
  addressLine2?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 150)
  landmark?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  city?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  state?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 20)
  postalCode?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  country?: string | null;

  @IsOptional()
  @IsNumber()
  latitude?: number | null;

  @IsOptional()
  @IsNumber()
  longitude?: number | null;

  @IsBoolean()
  sameAsRegistered!: boolean;
}

export class OrganisationSetupTaxProfileDto {
  @IsIn(TAX_TYPES)
  taxIdentifierType!: string;

  @IsString()
  @Length(1, 40)
  taxIdentifierNumber!: string;

  @IsString()
  @Length(1, 150)
  registeredBusinessName!: string;

  @IsOptional()
  @IsDateString()
  taxRegistrationDate?: string | null;

  @IsBoolean()
  isTaxExempt!: boolean;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  documentUrl?: string | null;

  @IsOptional()
  @IsIn(TAX_VERIFICATION_STATUSES)
  verificationStatus?: string;

  @IsOptional()
  @IsString()
  @Length(0, 255)
  verificationNotes?: string | null;
}

export class OrganisationSetupSettingsDto {
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/)
  currencyCode!: string;

  @IsIn(['prefix', 'suffix'])
  currencySymbolPosition!: string;

  @IsInt()
  @Min(0)
  @Max(3)
  currencyDecimalPlaces!: number;

  @IsString()
  @Length(1, 100)
  timezone!: string;

  @IsIn(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'])
  dateFormat!: string;

  @IsIn(['h12', 'h24'])
  timeFormat!: string;

  @IsInt()
  @IsIn([0, 1])
  firstDayOfWeek!: number;

  @IsString()
  @Length(2, 10)
  languageCode!: string;

  @IsInt()
  @Min(1)
  @Max(12)
  fiscalYearStartMonth!: number;
}

export class OrganisationSetupBusinessHourDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsBoolean()
  isOpen!: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  openTime?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  closeTime?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  breakStartTime?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  breakEndTime?: string | null;

  @IsBoolean()
  spansMidnight!: boolean;
}

export class OrganisationSetupHolidayDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @IsString()
  @Length(1, 120)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(0, 255)
  description?: string | null;

  @IsDateString()
  holidayDate!: string;

  @IsBoolean()
  isRecurringAnnually!: boolean;

  @IsIn(['active', 'cancelled'])
  status!: string;
}

export class UpdateOrganisationSetupDto {
  @ValidateNested()
  @Type(() => OrganisationSetupProfileDto)
  profile!: OrganisationSetupProfileDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrganisationSetupContactDto)
  contacts!: OrganisationSetupContactDto[];

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => OrganisationSetupAddressDto)
  addresses!: OrganisationSetupAddressDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => OrganisationSetupTaxProfileDto)
  taxProfile?: OrganisationSetupTaxProfileDto | null;

  @ValidateNested()
  @Type(() => OrganisationSetupSettingsDto)
  settings!: OrganisationSetupSettingsDto;

  @IsArray()
  @ArrayMinSize(7)
  @ValidateNested({ each: true })
  @Type(() => OrganisationSetupBusinessHourDto)
  businessHours!: OrganisationSetupBusinessHourDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrganisationSetupHolidayDto)
  holidays!: OrganisationSetupHolidayDto[];
}

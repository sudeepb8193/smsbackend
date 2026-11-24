import {
  IsString,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import {
  sms_leaveTypes_accrualMethod,
  sms_leaveTypes_applicableGender,
  sms_activeInactive,
} from '@prisma/client';

export class UpdateLeaveTypeDto {
  @IsString()
  @IsOptional()
  @MaxLength(80)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  code?: string;

  @IsBoolean()
  @IsOptional()
  isPaid?: boolean;

  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'annual_grant' || lower === 'annual-grant') return sms_leaveTypes_accrualMethod.annual_grant;
      if (lower === 'monthly_accrual' || lower === 'monthly-accrual') return sms_leaveTypes_accrualMethod.monthly_accrual;
      if (lower === 'none') return sms_leaveTypes_accrualMethod.none;
    }
    return value;
  })
  @IsEnum(sms_leaveTypes_accrualMethod)
  @IsOptional()
  accrualMethod?: sms_leaveTypes_accrualMethod;

  @Transform(({ obj, value }) => {
    const val = value !== undefined ? value : obj.annualEntitlement;
    return val !== undefined && val !== null ? Number(val) : undefined;
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(365)
  @IsOptional()
  annualEntitlementDays?: number;

  @IsOptional()
  @Type(() => Number)
  annualEntitlement?: number;

  @Transform(({ obj, value }) => {
    const val = value !== undefined ? value : obj.monthlyAccrualRate;
    return val !== undefined && val !== null ? Number(val) : undefined;
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(31)
  @IsOptional()
  monthlyAccrualDays?: number;

  @IsOptional()
  @Type(() => Number)
  monthlyAccrualRate?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(365)
  @IsOptional()
  maxCarryForwardDays?: number;

  @Transform(({ obj, value }) => {
    if (value !== undefined && value !== null) return Number(value);
    if (obj.documentRequiredThreshold !== undefined && obj.documentRequiredThreshold !== null) {
      return Number(obj.documentRequiredThreshold);
    }
    return undefined;
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(365)
  @IsOptional()
  documentRequiredAfterDays?: number;

  @IsOptional()
  isDocumentRequired?: boolean;

  @IsOptional()
  @Type(() => Number)
  documentRequiredThreshold?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(365)
  @IsOptional()
  minNoticeDays?: number;

  @Transform(({ obj, value }) => {
    const raw = value || obj.genderApplicability;
    if (typeof raw === 'string') {
      const lower = raw.toLowerCase();
      if (lower === 'female' || lower === 'female_only') return sms_leaveTypes_applicableGender.female;
      if (lower === 'male' || lower === 'male_only') return sms_leaveTypes_applicableGender.male;
      return sms_leaveTypes_applicableGender.all;
    }
    return raw;
  })
  @IsEnum(sms_leaveTypes_applicableGender)
  @IsOptional()
  applicableGender?: sms_leaveTypes_applicableGender;

  @IsOptional()
  @IsString()
  genderApplicability?: string;

  @IsOptional()
  @IsString()
  colorCode?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  isActive?: boolean;

  @Transform(({ obj, value }) => {
    if (value) return value;
    if (obj.isActive !== undefined) return obj.isActive ? sms_activeInactive.active : sms_activeInactive.inactive;
    return undefined;
  })
  @IsEnum(sms_activeInactive)
  @IsOptional()
  status?: sms_activeInactive;
}

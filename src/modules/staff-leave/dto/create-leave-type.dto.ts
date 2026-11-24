import {
  IsString,
  IsNotEmpty,
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

export class CreateLeaveTypeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;

  @IsBoolean()
  @IsOptional()
  isPaid?: boolean = true;

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
  accrualMethod?: sms_leaveTypes_accrualMethod = sms_leaveTypes_accrualMethod.annual_grant;

  @Transform(({ obj, value }) => {
    const val = value !== undefined ? value : obj.annualEntitlement;
    return val !== undefined && val !== null ? Number(val) : 0;
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(365)
  annualEntitlementDays: number;

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
  maxCarryForwardDays?: number = 0;

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
  minNoticeDays?: number = 0;

  @Transform(({ obj, value }) => {
    const raw = value || obj.genderApplicability;
    if (typeof raw === 'string') {
      const lower = raw.toLowerCase();
      if (lower === 'female' || lower === 'female_only') return sms_leaveTypes_applicableGender.female;
      if (lower === 'male' || lower === 'male_only') return sms_leaveTypes_applicableGender.male;
      return sms_leaveTypes_applicableGender.all;
    }
    return raw || sms_leaveTypes_applicableGender.all;
  })
  @IsEnum(sms_leaveTypes_applicableGender)
  @IsOptional()
  applicableGender?: sms_leaveTypes_applicableGender = sms_leaveTypes_applicableGender.all;

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

  @IsOptional()
  @IsEnum(sms_activeInactive)
  status?: sms_activeInactive;
}

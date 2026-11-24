import {
  IsString,
  IsDateString,
  IsEnum,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { sms_leaveBlackoutPeriods_restrictionType } from '@prisma/client';

export class UpdateBlackoutPeriodDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  name?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsUUID()
  @IsOptional()
  branchId?: string;

  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'block_all' || lower === 'block-all') return sms_leaveBlackoutPeriods_restrictionType.block_all;
      if (lower === 'limit_percentage' || lower === 'limit-percentage') return sms_leaveBlackoutPeriods_restrictionType.limit_percentage;
    }
    return value;
  })
  @IsEnum(sms_leaveBlackoutPeriods_restrictionType)
  @IsOptional()
  restrictionType?: sms_leaveBlackoutPeriods_restrictionType;

  @Transform(({ obj, value }) => {
    const val = value !== undefined ? value : obj.maxAllowedLeavePercentage;
    return val !== undefined && val !== null ? Number(val) : undefined;
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  maxPercentageStaffOnLeave?: number;

  @IsOptional()
  @Type(() => Number)
  maxAllowedLeavePercentage?: number;

  @Transform(({ obj, value }) => {
    if (value) return value;
    if (Array.isArray(obj.exemptLeaveTypeIds)) return obj.exemptLeaveTypeIds.join(',');
    return undefined;
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  appliesToLeaveTypeIds?: string;

  @IsOptional()
  exemptLeaveTypeIds?: string[];

  @IsOptional()
  applicableBranchIds?: string[];

  @Transform(({ obj, value }) => {
    return value || obj.notes;
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  isActive?: boolean;
}

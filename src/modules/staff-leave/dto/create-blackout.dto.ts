import {
  IsString,
  IsNotEmpty,
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

export class CreateBlackoutPeriodDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @IsUUID()
  @IsOptional()
  branchId?: string; // Null applies to all branches in org

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
  restrictionType?: sms_leaveBlackoutPeriods_restrictionType = sms_leaveBlackoutPeriods_restrictionType.block_all;

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

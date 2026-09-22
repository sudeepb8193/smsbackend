import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsUUID,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { sms_holidays_status } from '@prisma/client';

export class QueryHolidayDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Year must be an integer' })
  year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Month must be an integer between 1 and 12' })
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @IsEnum(sms_holidays_status, {
    message: 'Status must be active or cancelled',
  })
  status?: sms_holidays_status;

  @IsOptional()
  @IsUUID('4', { message: 'branchId must be a valid UUID' })
  branchId?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeBranchHolidays?: boolean;
}

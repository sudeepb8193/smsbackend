import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsDateString,
  MinLength,
  MaxLength,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { HolidayStatus } from '../../organization.types';

export class CreateHolidayDto {
  @IsString()
  @MinLength(2, { message: 'Holiday name must be at least 2 characters.' })
  @MaxLength(150)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsDateString({}, { message: 'Invalid holiday date. Must be ISO 8601 YYYY-MM-DD format.' })
  holidayDate: string;

  @IsOptional()
  @IsInt()
  branchId?: number;

  @IsOptional()
  @IsBoolean()
  isRecurringAnnually?: boolean;

  @IsOptional()
  @IsEnum(HolidayStatus)
  status?: HolidayStatus;
}

export class UpdateHolidayDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsDateString()
  holidayDate?: string;

  @IsOptional()
  @IsInt()
  branchId?: number;

  @IsOptional()
  @IsBoolean()
  isRecurringAnnually?: boolean;

  @IsOptional()
  @IsEnum(HolidayStatus)
  status?: HolidayStatus;
}

export class OverrideYearHolidayDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @IsOptional()
  @IsBoolean()
  isCancelled?: boolean;
}

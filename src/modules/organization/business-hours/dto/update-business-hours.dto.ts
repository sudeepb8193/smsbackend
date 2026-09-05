import {
  IsInt,
  IsBoolean,
  IsOptional,
  IsString,
  Min,
  Max,
  Matches,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DayScheduleDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @IsBoolean()
  isOpen: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'openTime must be in HH:mm 24-hour format (e.g., 09:00).',
  })
  openTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'closeTime must be in HH:mm 24-hour format (e.g., 18:00).',
  })
  closeTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'breakStartTime must be in HH:mm 24-hour format.',
  })
  breakStartTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'breakEndTime must be in HH:mm 24-hour format.',
  })
  breakEndTime?: string;

  @IsOptional()
  @IsBoolean()
  spansMidnight?: boolean;
}

export class UpdateWeeklyHoursDto {
  @IsOptional()
  @IsInt()
  branchId?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DayScheduleDto)
  schedules: DayScheduleDto[];
}

export class CopyDayScheduleDto {
  @IsOptional()
  @IsInt()
  branchId?: number;

  @IsInt()
  @Min(0)
  @Max(6)
  sourceDayOfWeek: number;

  @IsArray()
  @IsInt({ each: true })
  targetDaysOfWeek: number[];
}

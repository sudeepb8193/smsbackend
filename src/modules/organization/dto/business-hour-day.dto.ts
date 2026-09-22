import {
  IsInt,
  IsBoolean,
  IsOptional,
  IsString,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { TIME_REGEX } from '../utils/business-hours.util';

export class BusinessHourDayDto {
  @IsInt({
    message: 'dayOfWeek must be an integer between 0 (Sunday) and 6 (Saturday)',
  })
  @Min(0, { message: 'dayOfWeek must be between 0 (Sunday) and 6 (Saturday)' })
  @Max(6, { message: 'dayOfWeek must be between 0 (Sunday) and 6 (Saturday)' })
  dayOfWeek: number;

  @IsBoolean({ message: 'isOpen must be a boolean' })
  isOpen: boolean;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(TIME_REGEX, {
    message:
      'openTime must be a valid 24-hour time in HH:mm format (e.g. 09:00)',
  })
  openTime?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(TIME_REGEX, {
    message:
      'closeTime must be a valid 24-hour time in HH:mm format (e.g. 18:00)',
  })
  closeTime?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(TIME_REGEX, {
    message:
      'breakStartTime must be a valid 24-hour time in HH:mm format (e.g. 13:00)',
  })
  breakStartTime?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(TIME_REGEX, {
    message:
      'breakEndTime must be a valid 24-hour time in HH:mm format (e.g. 14:00)',
  })
  breakEndTime?: string;
}

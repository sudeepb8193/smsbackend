import {
  IsOptional,
  IsString,
  IsBoolean,
  IsEnum,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { sms_holidays_status } from '@prisma/client';

export class UpdateHolidayDto {
  @IsOptional()
  @IsString({ message: 'Holiday name must be a string' })
  @MaxLength(120, { message: 'Holiday name cannot exceed 120 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^[^<>]*$/, { message: 'Holiday name cannot contain HTML tags' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @MaxLength(255, { message: 'Description cannot exceed 255 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^[^<>]*$/, { message: 'Description cannot contain HTML tags' })
  description?: string;

  @IsOptional()
  @IsString({ message: 'Holiday date must be a string' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Holiday date must be in YYYY-MM-DD format',
  })
  holidayDate?: string;

  @IsOptional()
  @IsBoolean({ message: 'isRecurring must be a boolean' })
  isRecurring?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'isRecurringAnnually must be a boolean' })
  isRecurringAnnually?: boolean;

  @IsOptional()
  @IsEnum(sms_holidays_status, {
    message: 'Status must be either active or cancelled',
  })
  status?: sms_holidays_status;
}

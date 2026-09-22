import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  Min,
  Max,
  MaxLength,
  Matches,
  IsIn,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  ALLOWED_DATE_FORMATS,
  ALLOWED_TIME_FORMATS,
} from '../utils/regional-settings.util';

export class UpdateOrganizationSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(3, { message: 'currencyCode must be a 3-letter ISO code' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z]{3}$/, {
    message: 'currencyCode must be a valid ISO 4217 3-letter uppercase code',
  })
  currencyCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'timezone cannot exceed 100 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  timezone?: string;

  @IsOptional()
  @IsString()
  @IsIn(ALLOWED_DATE_FORMATS, {
    message: `dateFormat must be one of: ${ALLOWED_DATE_FORMATS.join(', ')}`,
  })
  dateFormat?: string;

  @IsOptional()
  @IsString()
  @IsIn(ALLOWED_TIME_FORMATS, {
    message: `timeFormat must be one of: ${ALLOWED_TIME_FORMATS.join(', ')}`,
  })
  timeFormat?: string;

  @IsOptional()
  @IsInt({ message: 'firstDayOfWeek must be an integer' })
  @Min(0, {
    message: 'firstDayOfWeek must be between 0 (Sunday) and 6 (Saturday)',
  })
  @Max(6, {
    message: 'firstDayOfWeek must be between 0 (Sunday) and 6 (Saturday)',
  })
  firstDayOfWeek?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10, { message: 'languageCode cannot exceed 10 characters' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  languageCode?: string;

  @IsOptional()
  @IsInt({ message: 'fiscalYearStartMonth must be an integer' })
  @Min(1, {
    message:
      'fiscalYearStartMonth must be between 1 (January) and 12 (December)',
  })
  @Max(12, {
    message:
      'fiscalYearStartMonth must be between 1 (January) and 12 (December)',
  })
  fiscalYearStartMonth?: number;

  @IsOptional()
  @IsBoolean()
  confirmCurrencyChange?: boolean;
}

import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  MaxLength,
  IsBoolean,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  CurrencySymbolPosition,
  TimeFormat,
  FirstDayOfWeek,
  DateFormat,
} from '../../organization.types';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/, {
    message: 'Default currency code must be a valid 3-letter ISO 4217 code (e.g., USD, EUR, INR).',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  defaultCurrencyCode?: string;

  @IsOptional()
  @IsEnum(CurrencySymbolPosition)
  currencySymbolPosition?: CurrencySymbolPosition;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3)
  currencyDecimalPlaces?: number;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  timezone?: string;

  @IsOptional()
  @IsEnum(DateFormat)
  dateFormat?: DateFormat;

  @IsOptional()
  @IsEnum(TimeFormat)
  timeFormat?: TimeFormat;

  @IsOptional()
  @IsEnum(FirstDayOfWeek)
  firstDayOfWeek?: FirstDayOfWeek;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  languageCode?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  fiscalYearStartMonth?: number;

  @IsOptional()
  @IsBoolean()
  confirmCurrencyChange?: boolean;

  @IsOptional()
  @IsString()
  confirmCurrencyCode?: string;
}

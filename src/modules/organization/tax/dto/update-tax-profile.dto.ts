import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsDateString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { TaxIdentifierType } from '../../organization.types';

export class UpdateTaxProfileDto {
  @IsOptional()
  @IsEnum(TaxIdentifierType, { message: 'Invalid tax identifier type.' })
  taxIdentifierType?: TaxIdentifierType;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  taxIdentifierNumber?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  registeredBusinessName?: string;

  @IsOptional()
  @IsDateString()
  taxRegistrationDate?: string;

  @IsOptional()
  @IsBoolean()
  isTaxExempt?: boolean;

  @IsOptional()
  @IsString()
  documentUrl?: string;
}

export class RejectTaxProfileDto {
  @IsString()
  @MinLength(3, { message: 'Rejection notes must be provided.' })
  notes: string;
}

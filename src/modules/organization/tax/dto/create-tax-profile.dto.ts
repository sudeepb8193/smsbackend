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

export class CreateTaxProfileDto {
  @IsEnum(TaxIdentifierType, { message: 'Invalid tax identifier type.' })
  taxIdentifierType: TaxIdentifierType;

  @IsString()
  @MinLength(3, { message: 'Tax identifier number must be at least 3 characters.' })
  @MaxLength(50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  taxIdentifierNumber: string;

  @IsString()
  @MinLength(2, { message: 'Registered business name must be at least 2 characters.' })
  @MaxLength(150)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  registeredBusinessName: string;

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

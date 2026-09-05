import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { AddressType } from '../../organization.types';

export class CreateAddressDto {
  @IsEnum(AddressType, { message: 'Invalid address type. Must be registered or billing.' })
  addressType: AddressType;

  @IsOptional()
  @IsBoolean()
  sameAsRegistered?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Address line 1 must be at least 3 characters.' })
  @MaxLength(200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  addressLine1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  landmark?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  city?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  state?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  postalCode?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{2}$/, {
    message: 'Country code must be a valid 2-letter ISO 3166-1 alpha-2 code (e.g. US, IN, GB).',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  countryCode?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;
}

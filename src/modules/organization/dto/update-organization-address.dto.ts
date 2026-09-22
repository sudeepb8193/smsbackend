import {
  IsEnum,
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
  Max,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { sms_organizationAddresses_addressType } from '@prisma/client';

export class UpdateOrganizationAddressDto {
  @IsOptional()
  @IsEnum(sms_organizationAddresses_addressType, {
    message: 'addressType must be one of: registered, billing',
  })
  addressType?: sms_organizationAddresses_addressType;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'addressLine1 must be at least 2 characters' })
  @MaxLength(255, { message: 'addressLine1 cannot exceed 255 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^[^<>]*(?:(?!<script|<html|<\/script|<\/html).)*$/i, {
    message: 'addressLine1 cannot contain HTML tags or script injection',
  })
  addressLine1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'addressLine2 cannot exceed 255 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^[^<>]*(?:(?!<script|<html|<\/script|<\/html).)*$/i, {
    message: 'addressLine2 cannot contain HTML tags or script injection',
  })
  addressLine2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150, { message: 'Landmark cannot exceed 150 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^[^<>]*(?:(?!<script|<html|<\/script|<\/html).)*$/i, {
    message: 'Landmark cannot contain HTML tags or script injection',
  })
  landmark?: string;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'City must be at least 2 characters' })
  @MaxLength(100, { message: 'City cannot exceed 100 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^[^<>]*(?:(?!<script|<html|<\/script|<\/html).)*$/i, {
    message: 'City cannot contain HTML tags or script injection',
  })
  city?: string;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'State/Province must be at least 2 characters' })
  @MaxLength(100, { message: 'State/Province cannot exceed 100 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^[^<>]*(?:(?!<script|<html|<\/script|<\/html).)*$/i, {
    message: 'State/Province cannot contain HTML tags or script injection',
  })
  state?: string;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Postal code must be at least 2 characters' })
  @MaxLength(20, { message: 'Postal code cannot exceed 20 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^[A-Za-z0-9\s-]{2,20}$/, {
    message: 'Postal code contains invalid characters',
  })
  postalCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Country must be at least 2 characters' })
  @MaxLength(100, { message: 'Country cannot exceed 100 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^[^<>]*(?:(?!<script|<html|<\/script|<\/html).)*$/i, {
    message: 'Country cannot contain HTML tags or script injection',
  })
  country?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Latitude must be a number' })
  @Min(-90, { message: 'Latitude must be between -90 and 90 degrees' })
  @Max(90, { message: 'Latitude must be between -90 and 90 degrees' })
  latitude?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Longitude must be a number' })
  @Min(-180, { message: 'Longitude must be between -180 and 180 degrees' })
  @Max(180, { message: 'Longitude must be between -180 and 180 degrees' })
  longitude?: number;

  @IsOptional()
  @IsBoolean()
  sameAsRegistered?: boolean;
}

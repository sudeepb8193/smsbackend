import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsOptional,
  IsEnum,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { sms_organizations_businessType } from '@prisma/client';

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty({ message: 'Business name is required' })
  @MinLength(2, { message: 'Business name must be at least 2 characters' })
  @MaxLength(150, { message: 'Business name cannot exceed 150 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^[^<>]*(?:(?!<script|<html|<\/script|<\/html).)*$/i, {
    message: 'Business name cannot contain HTML tags or script injection',
  })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(150, { message: 'Legal name cannot exceed 150 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^[^<>]*(?:(?!<script|<html|<\/script|<\/html).)*$/i, {
    message: 'Legal name cannot contain HTML tags or script injection',
  })
  legalName?: string;

  @IsOptional()
  @IsEnum(sms_organizations_businessType, {
    message:
      'Business type must be one of: salon, spa, unisex_salon, barbershop, wellness_center, other',
  })
  businessType?: sms_organizations_businessType =
    sms_organizations_businessType.salon;

  @IsOptional()
  @IsString()
  @MaxLength(160, { message: 'Slug cannot exceed 160 characters' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'Slug must contain only lowercase letters, numbers, and single hyphens',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  faviconUrl?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#([A-Fa-f0-9]{6})$/, {
    message:
      'Primary brand color must be a valid 6-digit hex string (e.g. #8A4A52)',
  })
  brandPrimaryColor?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#([A-Fa-f0-9]{6})$/, {
    message:
      'Secondary brand color must be a valid 6-digit hex string (e.g. #F5E6E8)',
  })
  brandSecondaryColor?: string;
}

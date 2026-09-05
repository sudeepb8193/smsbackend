import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
  IsEnum,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { OrganizationBusinessType, OrganizationStatus } from '../organization.types';

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Business name must be at least 2 characters.' })
  @MaxLength(150, { message: 'Business name cannot exceed 150 characters.' })
  @Matches(/^[^<>]*$/, { message: 'Business name cannot contain HTML or script content.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  legalName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must contain only lowercase letters, numbers, and hyphens.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  slug?: string;

  @IsOptional()
  @IsEnum(OrganizationBusinessType, { message: 'Invalid business type specified.' })
  businessType?: OrganizationBusinessType;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  faviconUrl?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#([A-Fa-f0-9]{6})$/, {
    message: 'Brand primary color must be a valid 6-digit hex color code (e.g., #1E293B).',
  })
  brandPrimaryColor?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#([A-Fa-f0-9]{6})$/, {
    message: 'Brand secondary color must be a valid 6-digit hex color code (e.g., #0F172A).',
  })
  brandSecondaryColor?: string;

  @IsOptional()
  @IsEnum(OrganizationStatus)
  status?: OrganizationStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  onboardingStep?: number;
}

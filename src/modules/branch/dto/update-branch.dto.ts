import {
  IsString,
  IsOptional,
  IsEnum,
  MaxLength,
  MinLength,
  Matches,
  IsDateString,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { sms_branches_branchType, sms_branches_status } from '@prisma/client';

export class UpdateBranchDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Branch name must be at least 2 characters' })
  @MaxLength(150, { message: 'Branch name cannot exceed 150 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Branch code must be at least 2 characters' })
  @MaxLength(20, { message: 'Branch code cannot exceed 20 characters' })
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Branch code may only contain alphanumeric characters, hyphens, and underscores',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  code?: string;

  @IsOptional()
  @IsEnum(sms_branches_branchType, {
    message: 'Branch type must be flagship, standard, or kiosk',
  })
  branchType?: sms_branches_branchType;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Cover image URL cannot exceed 500 characters' })
  coverImageUrl?: string | null;

  @IsOptional()
  @IsEnum(sms_branches_status, {
    message:
      'Status must be draft, active, temporarily_closed, or permanently_closed',
  })
  status?: sms_branches_status;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null ? null : value))
  @ValidateIf((o) => o.launchedAt !== null && o.launchedAt !== undefined && o.launchedAt !== '')
  @IsDateString(
    {},
    { message: 'Launched at must be a valid ISO date string (YYYY-MM-DD)' },
  )
  launchedAt?: string | null;

  @IsOptional()
  @IsUUID('all', { message: 'Organization ID must be a valid UUID' })
  organizationId?: string;

  @IsOptional()
  @IsUUID('all', {
    message: 'Copy settings source branch ID must be a valid UUID',
  })
  copySettingsFromBranchId?: string;

  @IsOptional()
  address?: {
    addressLine1?: string;
    addressLine2?: string;
    landmark?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    countryCode?: string;
    latitude?: number | null;
    longitude?: number | null;
    mapsUrl?: string | null;
  };

  @IsOptional()
  contact?: {
    phoneCountryCode?: string;
    phoneNumber?: string;
    whatsappNumber?: string;
    email?: string;
  };

  @IsOptional()
  businessHours?: Array<{
    dayOfWeek: number;
    isOpen: boolean;
    openTime?: string;
    closeTime?: string;
  }>;
}


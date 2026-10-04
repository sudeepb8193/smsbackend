import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  IsDateString,
} from 'class-validator';
import { BusinessTypeEnum, OrganisationStatusEnum } from './create-organisation.dto';

export class UpdateOrganisationDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsEnum(BusinessTypeEnum)
  @IsOptional()
  businessType?: BusinessTypeEnum;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  website?: string;

  @IsString()
  @IsOptional()
  addressLine1?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  pincode?: string;

  @IsString()
  @IsOptional()
  gstNumber?: string;

  @IsString()
  @IsOptional()
  taxNumber?: string;

  @IsString()
  @IsOptional()
  registrationNumber?: string;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  timeZone?: string;

  @IsString()
  @IsOptional()
  subscriptionPlan?: string;

  @IsDateString()
  @IsOptional()
  subscriptionStartDate?: string;

  @IsDateString()
  @IsOptional()
  subscriptionEndDate?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxBranches?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxUsers?: number;

  @IsEnum(OrganisationStatusEnum)
  @IsOptional()
  status?: OrganisationStatusEnum;
}

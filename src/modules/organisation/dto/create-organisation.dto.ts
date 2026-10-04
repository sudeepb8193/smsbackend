import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  IsDateString,
} from 'class-validator';

export enum BusinessTypeEnum {
  SALON = 'salon',
  SPA = 'spa',
  UNISEX_SALON = 'unisex_salon',
  BARBERSHOP = 'barbershop',
  WELLNESS_CENTER = 'wellness_center',
  OTHER = 'other',
}

export enum OrganisationStatusEnum {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export class CreateOrganisationDto {
  @IsString()
  @IsNotEmpty({ message: 'Organisation Name is required' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Organisation Code is required' })
  code: string;

  @IsEnum(BusinessTypeEnum, { message: 'Invalid Business Type' })
  @IsNotEmpty({ message: 'Business Type is required' })
  businessType: BusinessTypeEnum;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEmail({}, { message: 'Please provide a valid Organisation Email' })
  @IsNotEmpty({ message: 'Organisation Email is required' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Organisation Phone number is required' })
  phone: string;

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

  // Business Information
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

  // Owner Information
  @IsString()
  @IsNotEmpty({ message: 'Owner Full Name is required' })
  ownerName: string;

  @IsEmail({}, { message: 'Please provide a valid Owner Email address' })
  @IsNotEmpty({ message: 'Owner Email is required' })
  ownerEmail: string;

  @IsString()
  @IsOptional()
  ownerPhone?: string;

  @IsString()
  @IsOptional()
  ownerUsername?: string;

  @IsString()
  @IsOptional()
  ownerPassword?: string; // Default Owner@123 if omitted

  // Subscription Information
  @IsString()
  @IsNotEmpty({ message: 'Subscription Plan is required' })
  subscriptionPlan: string;

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

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
  IsDateString,
  IsEmail,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  sms_staff_gender,
  sms_staff_employmentStatus,
  sms_staffContacts_maritalStatus,
  sms_staffEmploymentHistory_employmentType,
} from '@prisma/client';

export class CreateStaffDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  fullName: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  employeeCode?: string;

  @IsUUID()
  @IsNotEmpty()
  homeBranchId: string;

  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @IsEnum(sms_staff_gender)
  @IsOptional()
  gender?: sms_staff_gender;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  profilePhotoUrl?: string;

  @IsEnum(sms_staff_employmentStatus)
  @IsOptional()
  employmentStatus?: sms_staff_employmentStatus;

  @IsUUID()
  @IsOptional()
  userId?: string;

  // Optional Initial Employment Details
  @IsString()
  @IsOptional()
  @MaxLength(100)
  designation?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  department?: string;

  @IsEnum(sms_staffEmploymentHistory_employmentType)
  @IsOptional()
  employmentType?: sms_staffEmploymentHistory_employmentType;

  @IsDateString()
  @IsOptional()
  joiningDate?: string;

  @IsDateString()
  @IsOptional()
  confirmationDate?: string;

  // Optional Initial Contact Details
  @IsString()
  @IsOptional()
  @MaxLength(20)
  @Matches(/^\+?[0-9\s-]{7,20}$/, {
    message: 'personalPhone must be a valid phone number (7-20 digits, spaces, hyphens, and optional leading +)',
  })
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value?.trim()))
  personalPhone?: string;

  @IsEmail({}, { message: 'personalEmail must be a valid email address' })
  @IsOptional()
  @MaxLength(150)
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value?.trim().toLowerCase()))
  personalEmail?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  addressLine1?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  addressLine2?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  city?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  state?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  postalCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2)
  countryCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(5)
  bloodGroup?: string;

  @IsEnum(sms_staffContacts_maritalStatus)
  @IsOptional()
  maritalStatus?: sms_staffContacts_maritalStatus;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  nationalIdNumber?: string;
}


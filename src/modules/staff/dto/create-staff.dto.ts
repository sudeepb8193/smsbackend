import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
  IsDateString,
  MaxLength,
} from 'class-validator';
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
  personalPhone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(150)
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


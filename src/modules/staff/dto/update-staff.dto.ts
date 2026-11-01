import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsDateString,
  MaxLength,
} from 'class-validator';
import {
  sms_staff_gender,
  sms_staff_employmentStatus,
} from '@prisma/client';

export class UpdateStaffDto {
  @IsString()
  @IsOptional()
  @MaxLength(150)
  fullName?: string;

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
  homeBranchId?: string;
}


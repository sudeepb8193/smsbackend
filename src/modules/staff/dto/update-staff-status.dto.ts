import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { sms_staff_employmentStatus } from '@prisma/client';

export class UpdateStaffStatusDto {
  @IsEnum(sms_staff_employmentStatus)
  @IsNotEmpty()
  status: sms_staff_employmentStatus;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  reason?: string;
}


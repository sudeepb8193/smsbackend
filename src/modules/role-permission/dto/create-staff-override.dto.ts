import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  IsDateString,
} from 'class-validator';
import { sms_staffPermissionOverrides_overrideType } from '@prisma/client';

export class CreateStaffOverrideDto {
  @IsUUID('4', { message: 'staffId must be a valid UUID' })
  @IsNotEmpty({ message: 'staffId is required' })
  staffId: string;

  @IsString()
  @IsNotEmpty({ message: 'permissionKey is required' })
  permissionKey: string;

  @IsEnum(sms_staffPermissionOverrides_overrideType, {
    message: 'overrideType must be grant or revoke',
  })
  overrideType: sms_staffPermissionOverrides_overrideType;

  @IsUUID('4', { message: 'branchId must be a valid UUID' })
  @IsOptional()
  branchId?: string;

  @IsString()
  @IsNotEmpty({ message: 'A mandatory reason is required for every permission override' })
  @MinLength(3, { message: 'Reason must be at least 3 characters' })
  @MaxLength(255, { message: 'Reason must not exceed 255 characters' })
  reason: string;

  @IsDateString({}, { message: 'expiresAt must be a valid ISO date-time string' })
  @IsOptional()
  expiresAt?: string;
}

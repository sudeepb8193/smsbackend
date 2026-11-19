import {
  IsUUID,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsEnum,
  IsString,
} from 'class-validator';
import { sms_staffAttendance_status } from '@prisma/client';

export class ManualAttendanceEntryDto {
  @IsUUID()
  @IsNotEmpty()
  staffId: string;

  @IsUUID()
  @IsNotEmpty()
  branchId: string;

  @IsDateString()
  @IsNotEmpty()
  attendanceDate: string;

  @IsOptional()
  @IsDateString()
  checkInAt?: string;

  @IsOptional()
  @IsDateString()
  checkOutAt?: string;

  @IsOptional()
  @IsEnum(sms_staffAttendance_status)
  status?: sms_staffAttendance_status;

  @IsOptional()
  @IsString()
  reason?: string;
}

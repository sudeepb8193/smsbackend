import {
  IsUUID,
  IsNotEmpty,
  IsDateString,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { sms_staffLeaveRequests_halfDayPeriod } from '@prisma/client';

export class ApplyLeaveDto {
  @IsUUID()
  @IsOptional()
  staffId?: string; // Optional if submitted by self (resolved from JWT)

  @IsUUID()
  @IsNotEmpty()
  leaveTypeId: string;

  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @IsBoolean()
  @IsOptional()
  isHalfDay?: boolean = false;

  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'first_half' || lower === 'morning') return sms_staffLeaveRequests_halfDayPeriod.morning;
      if (lower === 'second_half' || lower === 'afternoon') return sms_staffLeaveRequests_halfDayPeriod.afternoon;
    }
    return value;
  })
  @IsEnum(sms_staffLeaveRequests_halfDayPeriod)
  @IsOptional()
  halfDayPeriod?: sms_staffLeaveRequests_halfDayPeriod;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(255)
  reason: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  supportingDocumentUrl?: string;

  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;

  @IsOptional()
  @IsString()
  coveringStaffId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

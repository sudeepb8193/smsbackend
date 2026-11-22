import {
  IsUUID,
  IsOptional,
  IsNotEmpty,
  IsDateString,
  IsString,
  MaxLength,
} from 'class-validator';

export class SubmitAttendanceCorrectionDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  attendanceId?: string;

  @IsOptional()
  @IsUUID()
  staffId?: string;

  @IsDateString()
  @IsNotEmpty()
  correctionDate: string;

  @IsOptional()
  @IsDateString()
  requestedCheckInAt?: string;

  @IsOptional()
  @IsDateString()
  requestedCheckOutAt?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  supportingDocumentUrl?: string;
}

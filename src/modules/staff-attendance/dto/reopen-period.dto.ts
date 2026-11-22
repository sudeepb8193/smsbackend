import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class ReopenAttendancePeriodDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  reason: string;
}

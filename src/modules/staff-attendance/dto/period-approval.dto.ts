import {
  IsUUID,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsArray,
} from 'class-validator';

export class ApproveAttendancePeriodDto {
  @IsUUID()
  @IsNotEmpty()
  branchId: string;

  @IsOptional()
  @IsUUID()
  staffId?: string;

  @IsOptional()
  @IsArray()
  staffIds?: string[];

  @IsDateString()
  @IsNotEmpty()
  periodStart: string;

  @IsDateString()
  @IsNotEmpty()
  periodEnd: string;
}

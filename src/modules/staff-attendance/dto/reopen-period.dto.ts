import {
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class ReopenAttendancePeriodDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  reason: string;
}

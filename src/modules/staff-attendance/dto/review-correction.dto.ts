import {
  IsOptional,
  IsString,
  MaxLength,
  IsUUID,
} from 'class-validator';

export class ReviewAttendanceCorrectionDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reviewNotes?: string;
}

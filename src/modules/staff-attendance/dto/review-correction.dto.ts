import {
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ReviewAttendanceCorrectionDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reviewNotes?: string;
}

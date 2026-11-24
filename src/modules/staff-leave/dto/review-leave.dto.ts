import { IsString, IsOptional, MaxLength } from 'class-validator';

export class ReviewLeaveDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  notes?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  rejectionReason?: string;

  @IsString()
  @IsOptional()
  action?: string;
}

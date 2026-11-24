import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CancelLeaveDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  reason?: string;
}

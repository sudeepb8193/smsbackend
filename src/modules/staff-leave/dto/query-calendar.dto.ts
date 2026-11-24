import { IsOptional, IsUUID, IsDateString, IsString } from 'class-validator';

export class QueryCalendarDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  staffId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  view?: 'month' | 'week' | 'day';
}

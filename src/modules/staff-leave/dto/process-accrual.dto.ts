import { IsOptional, IsInt, Min, Max, IsUUID, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class ProcessAccrualDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number = new Date().getMonth() + 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year?: number = new Date().getFullYear();

  @IsOptional()
  @IsUUID()
  staffId?: string;

  @IsOptional()
  @IsUUID()
  leaveTypeId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}

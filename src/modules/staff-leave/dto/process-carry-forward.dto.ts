import { IsInt, Min, Max, IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class ProcessCarryForwardDto {
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  fromYear: number;

  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  @IsOptional()
  toYear?: number;

  @IsOptional()
  @IsUUID()
  staffId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}

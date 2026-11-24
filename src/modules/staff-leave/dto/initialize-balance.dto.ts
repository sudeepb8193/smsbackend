import { IsUUID, IsNotEmpty, IsInt, Min, Max, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class InitializeBalanceDto {
  @IsUUID()
  @IsNotEmpty()
  staffId: string;

  @IsUUID()
  @IsOptional()
  leaveTypeId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  @IsOptional()
  balanceYear?: number = new Date().getFullYear();
}

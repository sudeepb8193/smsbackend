import {
  IsUUID,
  IsNotEmpty,
  IsNumber,
  IsString,
  MinLength,
  MaxLength,
  IsInt,
  Min,
  Max,
  IsOptional,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class AdjustBalanceDto {
  @IsUUID()
  @IsNotEmpty()
  staffId: string;

  @IsUUID()
  @IsNotEmpty()
  leaveTypeId: string;

  @Transform(({ obj, value }) => {
    const val = value !== undefined ? value : obj.year;
    return val !== undefined && val !== null ? Number(val) : new Date().getFullYear();
  })
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  @IsOptional()
  balanceYear?: number = new Date().getFullYear();

  @IsOptional()
  @Type(() => Number)
  year?: number;

  @Type(() => Number)
  @IsNumber()
  adjustmentDays: number; // Positive (credit) or negative (debit)

  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(255)
  reason: string; // Mandatory auditable reason
}

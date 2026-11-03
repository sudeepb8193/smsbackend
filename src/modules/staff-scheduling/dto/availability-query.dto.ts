import {
  IsNotEmpty,
  IsOptional,
  IsUUID,
  Matches,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class StaffAvailabilityQueryDto {
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
  date: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(480)
  slotDurationMinutes?: number;

  @IsOptional()
  organizationId?: string;
}

export class BranchAvailabilityQueryDto {
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
  date: string;

  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(480)
  slotDurationMinutes?: number;

  @IsOptional()
  organizationId?: string;
}


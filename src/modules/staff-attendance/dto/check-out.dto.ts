import {
  IsUUID,
  IsOptional,
  IsEnum,
  IsNumber,
  IsString,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { sms_checkinMethod } from '@prisma/client';

export class CheckOutDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  staffId?: string;

  @IsUUID()
  branchId: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsEnum(sms_checkinMethod)
  method: sms_checkinMethod;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

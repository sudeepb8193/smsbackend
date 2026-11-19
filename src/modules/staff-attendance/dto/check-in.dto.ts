import {
  IsUUID,
  IsOptional,
  IsEnum,
  IsNumber,
  IsString,
} from 'class-validator';
import { sms_checkinMethod } from '@prisma/client';

export class CheckInDto {
  @IsOptional()
  @IsUUID()
  staffId?: string;

  @IsUUID()
  branchId: string;

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

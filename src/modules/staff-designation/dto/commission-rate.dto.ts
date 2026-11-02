import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { sms_commission_type } from '@prisma/client';

export class SetCommissionEligibilityDto {
  @IsBoolean()
  @IsNotEmpty()
  isCommissionEligible: boolean;
}

export class CreateCommissionOverrideDto {
  @IsOptional()
  @IsUUID('all', { message: 'Service ID must be a valid UUID' })
  serviceId?: string | null;

  @IsEnum(sms_commission_type, {
    message: 'Commission type must be percentage or fixed',
  })
  @IsNotEmpty()
  commissionType: sms_commission_type;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Commission value must be a valid number with up to 2 decimal places' })
  @Min(0, { message: 'Commission value cannot be negative' })
  @Type(() => Number)
  commissionValue: number;

  @IsDateString({}, { message: 'Effective from must be a valid ISO date string' })
  @IsNotEmpty()
  effectiveFrom: string;

  @IsOptional()
  @IsDateString({}, { message: 'Effective to must be a valid ISO date string' })
  effectiveTo?: string | null;
}

export class UpdateCommissionOverrideDto {
  @IsOptional()
  @IsEnum(sms_commission_type)
  commissionType?: sms_commission_type;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  commissionValue?: number;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string | null;

  @IsOptional()
  @IsBoolean()
  isCommissionEligible?: boolean;
}


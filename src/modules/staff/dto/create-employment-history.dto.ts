import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
  MaxLength,
} from 'class-validator';
import {
  sms_staffEmploymentHistory_employmentType,
  sms_staffEmploymentHistory_changeReason,
} from '@prisma/client';

export class CreateEmploymentHistoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  designation: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  department: string;

  @IsEnum(sms_staffEmploymentHistory_employmentType)
  @IsNotEmpty()
  employmentType: sms_staffEmploymentHistory_employmentType;

  @IsDateString()
  @IsNotEmpty()
  joiningDate: string;

  @IsDateString()
  @IsNotEmpty()
  effectiveFrom: string;

  @IsDateString()
  @IsOptional()
  confirmationDate?: string;

  @IsEnum(sms_staffEmploymentHistory_changeReason)
  @IsOptional()
  changeReason?: sms_staffEmploymentHistory_changeReason =
    sms_staffEmploymentHistory_changeReason.promotion;
}


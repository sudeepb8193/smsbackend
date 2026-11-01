import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { sms_staffQualifications_recordType } from '@prisma/client';

export class CreateQualificationDto {
  @IsEnum(sms_staffQualifications_recordType)
  @IsNotEmpty()
  recordType: sms_staffQualifications_recordType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  issuingInstitution?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  certificateNumber?: string;

  @IsDateString()
  @IsOptional()
  issueDate?: string;

  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  documentUrl?: string;
}

export class UpdateQualificationDto {
  @IsString()
  @IsOptional()
  @MaxLength(150)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  issuingInstitution?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  certificateNumber?: string;

  @IsDateString()
  @IsOptional()
  issueDate?: string;

  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  documentUrl?: string;
}


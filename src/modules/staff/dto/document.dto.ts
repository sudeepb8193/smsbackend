import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  sms_staffDocuments_category,
  sms_staffDocuments_status,
} from '@prisma/client';

export class CreateDocumentDto {
  @IsEnum(sms_staffDocuments_category)
  @IsNotEmpty()
  category: sms_staffDocuments_category;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  fileUrl: string;

  @IsInt()
  @IsOptional()
  fileSizeBytes?: number;

  @IsEnum(sms_staffDocuments_status)
  @IsOptional()
  status?: sms_staffDocuments_status = sms_staffDocuments_status.active;

  @IsUUID()
  @IsOptional()
  supersedesDocumentId?: string;
}


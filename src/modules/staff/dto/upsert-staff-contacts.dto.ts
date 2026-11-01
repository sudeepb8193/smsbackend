import {
  IsString,
  IsOptional,
  IsEnum,
  IsEmail,
  MaxLength,
} from 'class-validator';
import { sms_staffContacts_maritalStatus } from '@prisma/client';

export class UpsertStaffContactsDto {
  @IsString()
  @IsOptional()
  @MaxLength(20)
  personalPhone?: string;

  @IsEmail()
  @IsOptional()
  @MaxLength(150)
  personalEmail?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  addressLine1?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  addressLine2?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  city?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  state?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  postalCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2)
  countryCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(5)
  bloodGroup?: string;

  @IsEnum(sms_staffContacts_maritalStatus)
  @IsOptional()
  maritalStatus?: sms_staffContacts_maritalStatus;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  nationalIdNumber?: string;
}


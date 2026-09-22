import {
  IsEnum,
  IsString,
  IsOptional,
  IsEmail,
  IsBoolean,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { sms_organizationContacts_contactType } from '@prisma/client';

export class UpdateOrganizationContactDto {
  @IsOptional()
  @IsEnum(sms_organizationContacts_contactType, {
    message: 'contactType must be one of: primary, support, billing, emergency',
  })
  contactType?: sms_organizationContacts_contactType;

  @IsOptional()
  @IsString()
  @MaxLength(150, { message: 'Contact name cannot exceed 150 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^[^<>]*(?:(?!<script|<html|<\/script|<\/html).)*$/i, {
    message: 'Contact name cannot contain HTML tags or script injection',
  })
  contactName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @MaxLength(255, { message: 'Email address cannot exceed 255 characters' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10, { message: 'Phone country code cannot exceed 10 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^\+?[1-9]\d{0,3}$/, {
    message: 'Phone country code must be a valid country code (e.g. +1, +91)',
  })
  phoneCountryCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'Phone number cannot exceed 20 characters' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/[\s-]/g, '') : value,
  )
  @Matches(/^\+?[1-9]\d{6,14}$/, {
    message:
      'Phone number must follow an E.164 compatible format (e.g. 9876543210 or +919876543210)',
  })
  phoneNumber?: string;

  @IsOptional()
  @IsBoolean()
  sameAsPrimary?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefaultPublic?: boolean;
}

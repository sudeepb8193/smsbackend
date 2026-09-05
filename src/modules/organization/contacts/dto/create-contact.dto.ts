import {
  IsString,
  IsOptional,
  IsEmail,
  IsEnum,
  IsBoolean,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ContactType } from '../../organization.types';

export class CreateContactDto {
  @IsEnum(ContactType, { message: 'Invalid contact type.' })
  contactType: ContactType;

  @IsOptional()
  @IsBoolean()
  sameAsPrimary?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Full name must be at least 2 characters.' })
  @MaxLength(150)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  designation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  @Matches(/^\+?[0-9]{1,4}$/, { message: 'Invalid phone country code format.' })
  phoneCountryCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^\+?[0-9\s-]{7,15}$/, { message: 'Invalid E.164 phone number format.' })
  phoneNumber?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Invalid email address format.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email?: string;

  @IsOptional()
  @IsBoolean()
  isDefaultPublic?: boolean;
}

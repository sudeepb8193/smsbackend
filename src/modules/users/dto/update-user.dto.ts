import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsArray,
  IsInt,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Role } from '@prisma/client';
import { Transform } from 'class-transformer';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Display name must be at least 2 characters.' })
  @MaxLength(120, { message: 'Display name cannot exceed 120 characters.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  displayName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Invalid email syntax.' })
  @MaxLength(150, { message: 'Email cannot exceed 150 characters.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  @Matches(/^\+?[0-9]{1,4}$/, { message: 'Invalid country code format.' })
  phoneCountryCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  phoneNumber?: string;

  @IsOptional()
  @IsEnum(Role, { message: 'Invalid role specified.' })
  role?: Role;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  branchIds?: number[];
}

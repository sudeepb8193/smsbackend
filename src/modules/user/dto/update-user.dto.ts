import {
  IsString,
  IsOptional,
  IsEmail,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString({ message: 'Display name must be a string' })
  @MinLength(2, { message: 'Display name must be at least 2 characters' })
  @MaxLength(120, { message: 'Display name cannot exceed 120 characters' })
  displayName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @MaxLength(150, { message: 'Email cannot exceed 150 characters' })
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5, { message: 'Country code cannot exceed 5 characters' })
  phoneCountryCode?: string;

  @IsOptional()
  @IsString({ message: 'Phone number must be a string' })
  @MaxLength(20, { message: 'Phone number cannot exceed 20 characters' })
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  profilePhotoUrl?: string;
}

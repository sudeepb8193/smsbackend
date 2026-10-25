import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateUserInviteDto {
  @IsNotEmpty({ message: 'Display name is required' })
  @IsString({ message: 'Display name must be a string' })
  @MinLength(2, { message: 'Display name must be at least 2 characters' })
  @MaxLength(120, { message: 'Display name cannot exceed 120 characters' })
  displayName: string;

  @ValidateIf((o) => !o.phoneNumber || o.email)
  @IsNotEmpty({ message: 'At least one contact identifier (email or phone) is required' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @MaxLength(150, { message: 'Email cannot exceed 150 characters' })
  @IsOptional()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5, { message: 'Country code cannot exceed 5 characters' })
  phoneCountryCode?: string;

  @ValidateIf((o) => !o.email || o.phoneNumber)
  @IsNotEmpty({ message: 'At least one contact identifier (email or phone) is required' })
  @IsString({ message: 'Phone number must be a string' })
  @MaxLength(20, { message: 'Phone number cannot exceed 20 characters' })
  @IsOptional()
  phoneNumber?: string;

  @IsNotEmpty({ message: 'A primary role must be assigned to the user' })
  @IsUUID('4', { message: 'Role ID must be a valid UUID' })
  roleId: string;

  @IsOptional()
  @IsUUID('4', { message: 'Branch ID must be a valid UUID' })
  branchId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Organization ID must be a valid UUID' })
  organizationId?: string;
}

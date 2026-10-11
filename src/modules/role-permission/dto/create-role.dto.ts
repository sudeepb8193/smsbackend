import { IsString, IsNotEmpty, IsOptional, MaxLength, MinLength, IsUUID } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty({ message: 'Role name is required' })
  @MinLength(2, { message: 'Role name must be at least 2 characters' })
  @MaxLength(80, { message: 'Role name must not exceed 80 characters' })
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(90, { message: 'Role slug must not exceed 90 characters' })
  slug?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255, { message: 'Description must not exceed 255 characters' })
  description?: string;

  @IsUUID('4', { message: 'clonedFromRoleId must be a valid UUID' })
  @IsOptional()
  clonedFromRoleId?: string;

  @IsUUID('4', { message: 'organizationId must be a valid UUID' })
  @IsOptional()
  organizationId?: string;
}

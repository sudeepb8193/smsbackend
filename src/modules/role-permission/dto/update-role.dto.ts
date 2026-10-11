import { IsString, IsOptional, MaxLength, MinLength, IsEnum } from 'class-validator';
import { sms_roles_status } from '@prisma/client';

export class UpdateRoleDto {
  @IsString()
  @IsOptional()
  @MinLength(2, { message: 'Role name must be at least 2 characters' })
  @MaxLength(80, { message: 'Role name must not exceed 80 characters' })
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255, { message: 'Description must not exceed 255 characters' })
  description?: string;

  @IsEnum(sms_roles_status, { message: 'Status must be active or inactive' })
  @IsOptional()
  status?: sms_roles_status;
}

import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { sms_roles_roleType, sms_roles_status } from '@prisma/client';

export class QueryRolesDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsEnum(sms_roles_roleType)
  @IsOptional()
  roleType?: sms_roles_roleType;

  @IsEnum(sms_roles_status)
  @IsOptional()
  status?: sms_roles_status;

  @IsUUID('4')
  @IsOptional()
  organizationId?: string;

  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsOptional()
  limit?: number = 20;
}

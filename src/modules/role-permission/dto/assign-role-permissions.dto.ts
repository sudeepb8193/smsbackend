import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { sms_rolePermissions_scope } from '@prisma/client';

export class RolePermissionAssignmentItemDto {
  @IsString()
  @IsNotEmpty({ message: 'permissionKey is required' })
  permissionKey: string;

  @IsEnum(sms_rolePermissions_scope, {
    message: 'Scope must be own_branch, restricted_branches, or all_branches',
  })
  scope: sms_rolePermissions_scope;

  @IsArray()
  @IsOptional()
  @IsUUID('4', { each: true, message: 'Each restrictedBranchId must be a valid UUID' })
  restrictedBranchIds?: string[];
}

export class AssignRolePermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RolePermissionAssignmentItemDto)
  permissions: RolePermissionAssignmentItemDto[];

  @IsOptional()
  @IsString()
  expectedUpdatedAt?: string;
}

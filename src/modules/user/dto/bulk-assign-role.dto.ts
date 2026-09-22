import { IsArray, IsUUID, IsBoolean, IsOptional } from 'class-validator';

export class BulkAssignRoleDto {
  @IsArray()
  @IsUUID('4', { each: true })
  userIds: string[];

  @IsUUID()
  roleId: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

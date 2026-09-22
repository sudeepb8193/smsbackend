import { IsUUID, IsBoolean, IsOptional } from 'class-validator';

export class AssignRoleDto {
  @IsUUID()
  roleId: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

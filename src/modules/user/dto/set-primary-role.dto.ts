import { IsUUID } from 'class-validator';

export class SetPrimaryRoleDto {
  @IsUUID()
  roleId: string;
}

import { IsInt, IsNotEmpty, IsOptional, IsBoolean, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AssignRoleDto {
  @IsNotEmpty({ message: 'roleId is required.' })
  @Type(() => Number)
  @IsInt({ message: 'roleId must be an integer.' })
  @Min(1, { message: 'roleId must be a valid positive integer.' })
  roleId: number;

  @IsOptional()
  @IsBoolean({ message: 'isPrimary must be a boolean.' })
  isPrimary?: boolean;
}

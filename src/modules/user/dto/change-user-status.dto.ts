import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ChangeUserStatusDto {
  @IsNotEmpty({ message: 'Target status is required' })
  @IsIn(['active', 'suspended', 'deactivated'], {
    message: 'Status must be one of: active, suspended, deactivated',
  })
  status: 'active' | 'suspended' | 'deactivated';

  @IsOptional()
  @IsString({ message: 'Reason must be a string' })
  @MaxLength(255, { message: 'Reason cannot exceed 255 characters' })
  reason?: string;
}

import { IsString, MinLength, MaxLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters long.' })
  @MaxLength(100, { message: 'New password cannot exceed 100 characters.' })
  newPassword: string;
}

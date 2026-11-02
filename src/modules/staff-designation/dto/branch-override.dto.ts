import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateBranchOverrideDto {
  @IsUUID('all', { message: 'Valid branch ID is required' })
  @IsNotEmpty()
  branchId: string;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class UpdateBranchOverrideDto {
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}


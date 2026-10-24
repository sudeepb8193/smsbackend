import {
  IsUUID,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class CopyBranchSettingsDto {
  @IsUUID('all', { message: 'Source branch ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Source branch ID is required' })
  sourceBranchId: string;

  @IsOptional()
  @IsBoolean()
  previewOnly?: boolean = false;

  @IsOptional()
  @IsBoolean()
  copyHours?: boolean = true;

  @IsOptional()
  @IsBoolean()
  copySettings?: boolean = true;
}

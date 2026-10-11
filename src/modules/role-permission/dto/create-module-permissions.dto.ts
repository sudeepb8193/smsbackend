import { IsString, IsNotEmpty, IsArray, IsOptional, ArrayNotEmpty, Matches } from 'class-validator';

export class CreateModulePermissionsDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9_-]+$/, { message: 'moduleCode must be lowercase alphanumeric with underscores or hyphens' })
  moduleCode: string;

  @IsString()
  @IsNotEmpty()
  moduleLabel: string;

  @IsArray()
  @ArrayNotEmpty()
  actions: ('create' | 'view' | 'edit' | 'delete' | 'approve' | 'export' | 'print')[];

  @IsString()
  @IsOptional()
  description?: string;
}

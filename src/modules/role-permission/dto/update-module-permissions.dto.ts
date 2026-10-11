import { IsString, IsNotEmpty, IsArray, IsOptional, ArrayNotEmpty } from 'class-validator';

export class UpdateModulePermissionsDto {
  @IsString()
  @IsNotEmpty()
  moduleLabel: string;

  @IsArray()
  @IsOptional()
  actions?: ('create' | 'view' | 'edit' | 'delete' | 'approve' | 'export' | 'print')[];

  @IsString()
  @IsOptional()
  description?: string;
}

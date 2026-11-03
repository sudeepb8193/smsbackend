import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  Matches,
  MaxLength,
  IsIn,
} from 'class-validator';

export const ALLOWED_COLOR_TAGS = [
  'default',
  'blue',
  'green',
  'amber',
  'purple',
  'rose',
  'teal',
  'indigo',
  'cyan',
  'emerald',
] as const;

export class CreateShiftTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, {
    message: 'startTime must be a valid time in HH:mm or HH:mm:ss format',
  })
  startTime: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, {
    message: 'endTime must be a valid time in HH:mm or HH:mm:ss format',
  })
  endTime: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, {
    message: 'breakStartTime must be a valid time in HH:mm or HH:mm:ss format',
  })
  breakStartTime?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, {
    message: 'breakEndTime must be a valid time in HH:mm or HH:mm:ss format',
  })
  breakEndTime?: string | null;

  @IsOptional()
  @IsString()
  @IsIn(ALLOWED_COLOR_TAGS)
  colorTag?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}

export class UpdateShiftTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, {
    message: 'startTime must be a valid time in HH:mm or HH:mm:ss format',
  })
  startTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, {
    message: 'endTime must be a valid time in HH:mm or HH:mm:ss format',
  })
  endTime?: string;

  @IsOptional()
  @IsString()
  breakStartTime?: string | null;

  @IsOptional()
  @IsString()
  breakEndTime?: string | null;

  @IsOptional()
  @IsString()
  @IsIn(ALLOWED_COLOR_TAGS)
  colorTag?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}

export class QueryShiftTemplateDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsIn(['active', 'inactive', 'all'])
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  organizationId?: string;
}


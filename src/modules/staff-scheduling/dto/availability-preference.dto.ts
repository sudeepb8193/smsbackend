import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  Max,
  IsIn,
} from 'class-validator';

export class CreateAvailabilityPreferenceDto {
  @IsOptional()
  @IsUUID()
  staffId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number | null;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, {
    message: 'endTime must be in HH:mm format',
  })
  endTime?: string | null;

  @IsNotEmpty()
  @IsIn(['preferred', 'avoid', 'unavailable'])
  preferenceType: 'preferred' | 'avoid' | 'unavailable';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string | null;
}

export class UpdateAvailabilityPreferenceDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number | null;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, {
    message: 'endTime must be in HH:mm format',
  })
  endTime?: string | null;

  @IsOptional()
  @IsIn(['preferred', 'avoid', 'unavailable'])
  preferenceType?: 'preferred' | 'avoid' | 'unavailable';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string | null;
}

export class QueryAvailabilityPreferenceDto {
  @IsOptional()
  @IsUUID()
  staffId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  organizationId?: string;
}


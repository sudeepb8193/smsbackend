import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AssignServiceDto {
  @IsUUID('all', { message: 'Valid service ID is required' })
  @IsNotEmpty()
  serviceId: string;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Duration override must be at least 1 minute' })
  @Max(720, { message: 'Duration override cannot exceed 720 minutes' })
  @Type(() => Number)
  durationOverrideMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class BulkAssignServicesDto {
  @IsArray()
  @IsUUID('all', { each: true, message: 'Each item must be a valid service ID' })
  @IsNotEmpty({ message: 'At least one service ID must be provided' })
  serviceIds: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  @Type(() => Number)
  defaultDurationOverrideMinutes?: number;
}

export class UpdateDurationOverrideDto {
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Duration override must be at least 1 minute' })
  @Max(720, { message: 'Duration override cannot exceed 720 minutes' })
  @Type(() => Number)
  durationOverrideMinutes?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}


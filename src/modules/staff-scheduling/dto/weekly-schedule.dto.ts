import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  Max,
  ValidateNested,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DayScheduleItemDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @IsBoolean()
  isWorking: boolean;

  @IsOptional()
  @IsUUID()
  shiftTemplateId?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, {
    message: 'customStartTime must be in HH:mm format',
  })
  customStartTime?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, {
    message: 'customEndTime must be in HH:mm format',
  })
  customEndTime?: string | null;

  @IsOptional()
  @IsString()
  customBreakStartTime?: string | null;

  @IsOptional()
  @IsString()
  customBreakEndTime?: string | null;
}

export class SaveWeeklyScheduleDto {
  @IsUUID()
  @IsNotEmpty()
  staffId: string;

  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'effectiveFrom must be in YYYY-MM-DD format',
  })
  effectiveFrom: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'effectiveTo must be in YYYY-MM-DD format',
  })
  effectiveTo?: string | null;

  @IsArray()
  @ArrayMinSize(7)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => DayScheduleItemDto)
  days: DayScheduleItemDto[];
}

export class CopyWeeklyScheduleDto {
  @IsUUID()
  @IsNotEmpty()
  sourceStaffId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  targetStaffIds: string[];

  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'effectiveFrom must be in YYYY-MM-DD format',
  })
  effectiveFrom: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'effectiveTo must be in YYYY-MM-DD format',
  })
  effectiveTo?: string | null;
}

export class QueryWeeklyScheduleDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  staffId?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'weekStartDate must be in YYYY-MM-DD format',
  })
  weekStartDate?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
  date?: string;

  @IsOptional()
  organizationId?: string;
}

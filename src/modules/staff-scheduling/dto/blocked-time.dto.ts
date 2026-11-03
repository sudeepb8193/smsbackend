import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  IsIn,
  IsArray,
  ArrayMinSize,
} from 'class-validator';

export class CreateBlockedTimeDto {
  @IsUUID()
  @IsNotEmpty()
  staffId: string;

  @IsUUID()
  @IsNotEmpty()
  branchId: string;

  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'blockDate must be in YYYY-MM-DD format',
  })
  blockDate: string;

  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime: string;

  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, {
    message: 'endTime must be in HH:mm format',
  })
  endTime: string;

  @IsOptional()
  @IsIn(['training', 'meeting', 'personal', 'other'])
  reasonCategory?: 'training' | 'meeting' | 'personal' | 'other';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string | null;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'recurrenceEndDate must be in YYYY-MM-DD format',
  })
  recurrenceEndDate?: string | null;

  @IsOptional()
  @IsBoolean()
  isBulk?: boolean;
}

export class BulkCreateBlockedTimeDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  staffIds: string[];

  @IsUUID()
  @IsNotEmpty()
  branchId: string;

  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'blockDate must be in YYYY-MM-DD format',
  })
  blockDate: string;

  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime: string;

  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, {
    message: 'endTime must be in HH:mm format',
  })
  endTime: string;

  @IsOptional()
  @IsIn(['training', 'meeting', 'personal', 'other'])
  reasonCategory?: 'training' | 'meeting' | 'personal' | 'other';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string | null;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'recurrenceEndDate must be in YYYY-MM-DD format',
  })
  recurrenceEndDate?: string | null;

  @IsOptional()
  @IsBoolean()
  isBulk?: boolean;
}

export class UpdateBlockedTimeDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'blockDate must be in YYYY-MM-DD format',
  })
  blockDate?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, {
    message: 'endTime must be in HH:mm format',
  })
  endTime?: string;

  @IsOptional()
  @IsIn(['training', 'meeting', 'personal', 'other'])
  reasonCategory?: 'training' | 'meeting' | 'personal' | 'other';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string | null;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'recurrenceEndDate must be in YYYY-MM-DD format',
  })
  recurrenceEndDate?: string | null;

  @IsOptional()
  @IsBoolean()
  isBulk?: boolean;
}

export class QueryBlockedTimeDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  staffId?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate must be in YYYY-MM-DD format',
  })
  startDate?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'endDate must be in YYYY-MM-DD format',
  })
  endDate?: string;

  @IsOptional()
  @IsIn(['training', 'meeting', 'personal', 'other'])
  reasonCategory?: 'training' | 'meeting' | 'personal' | 'other';

  @IsOptional()
  organizationId?: string;
}


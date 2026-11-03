import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  IsIn,
} from 'class-validator';

export class CreateScheduleOverrideDto {
  @IsUUID()
  @IsNotEmpty()
  staffId: string;

  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'overrideDate must be in YYYY-MM-DD format',
  })
  overrideDate: string;

  @IsNotEmpty()
  @IsIn(['extra_shift', 'shift_change', 'early_leave', 'late_arrival', 'day_off'])
  overrideType: 'extra_shift' | 'shift_change' | 'early_leave' | 'late_arrival' | 'day_off';

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
  @IsString()
  @MaxLength(255)
  reason: string;

  @IsOptional()
  @IsIn(['not_required', 'pending', 'approved', 'rejected'])
  approvalStatus?: 'not_required' | 'pending' | 'approved' | 'rejected';
}

export class UpdateScheduleOverrideDto {
  @IsOptional()
  @IsIn(['extra_shift', 'shift_change', 'early_leave', 'late_arrival', 'day_off'])
  overrideType?: 'extra_shift' | 'shift_change' | 'early_leave' | 'late_arrival' | 'day_off';

  @IsOptional()
  @IsString()
  startTime?: string | null;

  @IsOptional()
  @IsString()
  endTime?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;

  @IsOptional()
  @IsIn(['not_required', 'pending', 'approved', 'rejected'])
  approvalStatus?: 'not_required' | 'pending' | 'approved' | 'rejected';
}

export class CreateShiftSwapDto {
  @IsUUID()
  @IsNotEmpty()
  staffAId: string;

  @IsUUID()
  @IsNotEmpty()
  staffBId: string;

  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dateA must be in YYYY-MM-DD format',
  })
  dateA: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dateB must be in YYYY-MM-DD format',
  })
  dateB?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  reason: string;
}

export class ReviewOverrideDto {
  @IsNotEmpty()
  @IsIn(['approved', 'rejected'])
  status: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reviewNote?: string;
}

export class QueryScheduleOverrideDto {
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
  @IsIn(['not_required', 'pending', 'approved', 'rejected'])
  approvalStatus?: 'not_required' | 'pending' | 'approved' | 'rejected';

  @IsOptional()
  @IsIn(['extra_shift', 'shift_change', 'early_leave', 'late_arrival', 'day_off'])
  overrideType?: 'extra_shift' | 'shift_change' | 'early_leave' | 'late_arrival' | 'day_off';

  @IsOptional()
  organizationId?: string;
}


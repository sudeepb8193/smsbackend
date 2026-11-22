import {
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsString,
} from 'class-validator';

export class SaveAttendancePolicyDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsInt()
  @Min(0)
  @Max(120)
  lateGraceMinutes: number = 10;

  @IsInt()
  @Min(0)
  @Max(120)
  earlyExitGraceMinutes: number = 10;

  @IsInt()
  @Min(60)
  @Max(720)
  halfDayThresholdMinutes: number = 240;

  @IsInt()
  @Min(0)
  @Max(240)
  overtimeThresholdMinutes: number = 15;

  @IsBoolean()
  overtimeRequiresApproval: boolean = true;

  @IsInt()
  @Min(30)
  @Max(480)
  absentCutoffMinutes: number = 120;

  @IsString()
  allowedCheckinMethods: string = 'biometric,geofenced_app,manual,admin_entry';
}

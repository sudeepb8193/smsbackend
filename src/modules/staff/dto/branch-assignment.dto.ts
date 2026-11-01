import {
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsDateString,
  IsString,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { sms_staffBranchAssignments_assignmentType } from '@prisma/client';

export class CreateBranchAssignmentDto {
  @IsUUID()
  @IsNotEmpty()
  branchId: string;

  @IsEnum(sms_staffBranchAssignments_assignmentType)
  @IsOptional()
  assignmentType?: sms_staffBranchAssignments_assignmentType =
    sms_staffBranchAssignments_assignmentType.secondary;

  @IsDateString()
  @IsNotEmpty()
  effectiveFrom: string;

  @IsDateString()
  @IsOptional()
  effectiveTo?: string;
}

export class TransferHomeBranchDto {
  @IsUUID()
  @IsNotEmpty()
  newBranchId: string;

  @IsDateString()
  @IsOptional()
  effectiveFrom?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  reason?: string;
}


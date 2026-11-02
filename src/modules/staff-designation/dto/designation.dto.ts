import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  IsInt,
  Min,
  Max,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { sms_staffDesignations_designationType } from '@prisma/client';

export class CreateDesignationDto {
  @IsEnum(sms_staffDesignations_designationType, {
    message:
      'Designation type must be one of: stylist, beautician, makeup_artist, hairdresser, therapist, nail_technician, other',
  })
  @IsNotEmpty()
  designationType: sms_staffDesignations_designationType;

  @ValidateIf((o) => o.designationType === sms_staffDesignations_designationType.other)
  @IsNotEmpty({ message: 'Custom label is required when designation type is other' })
  @IsString()
  @MaxLength(100)
  customLabel?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0, { message: 'Years of experience cannot be negative' })
  @Max(60, { message: 'Years of experience must be 60 or less' })
  @Type(() => Number)
  yearsOfExperience?: number;
}

export class UpdateDesignationDto {
  @IsOptional()
  @IsEnum(sms_staffDesignations_designationType)
  designationType?: sms_staffDesignations_designationType;

  @ValidateIf((o) => o.designationType === sms_staffDesignations_designationType.other)
  @IsNotEmpty({ message: 'Custom label is required when designation type is other' })
  @IsString()
  @MaxLength(100)
  customLabel?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0, { message: 'Years of experience cannot be negative' })
  @Max(60, { message: 'Years of experience must be 60 or less' })
  @Type(() => Number)
  yearsOfExperience?: number;
}

export class SetPrimaryDesignationDto {
  @IsNotEmpty()
  @IsString()
  designationId: string;
}


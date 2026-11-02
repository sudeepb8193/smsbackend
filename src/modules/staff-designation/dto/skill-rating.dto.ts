import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  sms_staffSkillRatings_proficiencyLevel,
  sms_staffSkillRatings_verificationStatus,
} from '@prisma/client';

export class CreateSkillRatingDto {
  @IsNotEmpty({ message: 'Skill name is required' })
  @IsString()
  @MaxLength(100)
  skillName: string;

  @IsEnum(sms_staffSkillRatings_proficiencyLevel, {
    message: 'Proficiency level must be beginner, intermediate, expert, or master',
  })
  @IsNotEmpty()
  proficiencyLevel: sms_staffSkillRatings_proficiencyLevel;

  @IsOptional()
  @IsEnum(sms_staffSkillRatings_verificationStatus)
  verificationStatus?: sms_staffSkillRatings_verificationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  verificationNote?: string;
}

export class UpdateSkillRatingDto {
  @IsOptional()
  @IsEnum(sms_staffSkillRatings_proficiencyLevel)
  proficiencyLevel?: sms_staffSkillRatings_proficiencyLevel;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  skillName?: string;
}

export class VerifySkillRatingDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

export class RejectSkillRatingDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}


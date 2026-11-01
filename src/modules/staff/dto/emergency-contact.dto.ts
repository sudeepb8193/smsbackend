import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsIn,
} from 'class-validator';

export class CreateEmergencyContactDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  contactName: string;

  @IsString()
  @IsOptional()
  @MaxLength(60)
  relationship?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phoneNumber: string;

  @IsString()
  @IsOptional()
  @IsIn(['primary', 'secondary', 'assistant'])
  priority?: 'primary' | 'secondary' | 'assistant' = 'secondary';
}

export class UpdateEmergencyContactDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  contactName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(60)
  relationship?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  @IsIn(['primary', 'secondary', 'assistant'])
  priority?: 'primary' | 'secondary' | 'assistant';
}


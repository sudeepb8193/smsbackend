import {
  IsArray,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BusinessHourDayDto } from './business-hour-day.dto';

export class UpdateBusinessHoursDto {
  @IsArray({ message: 'days must be an array of day schedule objects' })
  @ArrayMinSize(1, { message: 'days array cannot be empty' })
  @ArrayMaxSize(7, { message: 'days array cannot exceed 7 days' })
  @ValidateNested({ each: true })
  @Type(() => BusinessHourDayDto)
  days: BusinessHourDayDto[];
}

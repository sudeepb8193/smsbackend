import {
  IsUUID,
  IsNotEmpty,
  IsString,
  Length,
} from 'class-validator';

export class KioskPunchDto {
  @IsUUID()
  @IsNotEmpty()
  branchId: string;

  @IsString()
  @IsNotEmpty()
  employeeCode: string;

  @IsString()
  @IsNotEmpty()
  @Length(4, 8)
  pin: string;
}

import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsNotEmpty({ message: 'Organization Name is required' })
  @IsString({ message: 'Organization Name must be a string' })
  @Length(2, 150, {
    message: 'Organization Name must be between 2 and 150 characters',
  })
  organizationName: string;

  @IsNotEmpty({ message: 'Full Name is required' })
  @IsString({ message: 'Full Name must be a string' })
  @Length(2, 120, { message: 'Full Name must be between 2 and 120 characters' })
  fullName: string;

  @IsNotEmpty({ message: 'Email address is required' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'Password must contain at least one letter and one number',
  })
  password: string;
}

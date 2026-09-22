import { IsString, IsNotEmpty, MaxLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class CheckSlugAvailabilityDto {
  @IsString()
  @IsNotEmpty({ message: 'Slug query parameter is required' })
  @MaxLength(160, { message: 'Slug cannot exceed 160 characters' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'Slug must contain only lowercase letters, numbers, and single hyphens',
  })
  slug: string;
}

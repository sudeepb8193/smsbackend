import { IsString, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class CheckSlugAvailabilityDto {
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must contain only lowercase letters, numbers, and hyphens.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  slug: string;
}

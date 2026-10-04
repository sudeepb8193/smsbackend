import { IsEnum, IsNotEmpty } from 'class-validator';
import { OrganisationStatusEnum } from './create-organisation.dto';

export class UpdateOrganisationStatusDto {
  @IsEnum(OrganisationStatusEnum, {
    message: 'Status must be active, inactive, or suspended',
  })
  @IsNotEmpty({ message: 'Status is required' })
  status: OrganisationStatusEnum;
}

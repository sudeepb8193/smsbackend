import { Module } from '@nestjs/common';
import { OrganisationController } from './organisation.controller';
import { ApiOrganisationController } from '../api-organisation.controller';
import { OrganisationService } from './organisation.service';
import { OrganisationRepository } from '../organisation.repository';
import { AddressAutocompleteService } from '../address/address-autocomplete.service';
import { AddressController } from '../address/address.controller';
import { OrganizationContactVerificationController } from '../organization-contact/organization-contact-verification.controller';
import { OrganizationContactVerificationService } from '../organization-contact/organization-contact-verification.service';
import { OwnerOrganisationController } from '../owner/owner-organisation.controller';
import { PrismaModule } from '../../../database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [
    OrganisationController,
    AddressController,
    ApiOrganisationController,
    OrganizationContactVerificationController,
    OwnerOrganisationController,
  ],
  providers: [
    OrganisationService,
    OrganisationRepository,
    AddressAutocompleteService,
    OrganizationContactVerificationService,
  ],
  exports: [OrganisationService, OrganisationRepository],
})
export class OrganisationModule {}

import { Module } from '@nestjs/common';
import { OrganisationController } from './organisation.controller';
import { ApiOrganisationController } from './api-organisation.controller';
import { OrganisationService } from './organisation.service';
import { OrganisationRepository } from './organisation.repository';
import { AddressAutocompleteService } from './address-autocomplete.service';
import { OrganizationContactVerificationController } from './organization-contact-verification.controller';
import { OrganizationContactVerificationService } from './organization-contact-verification.service';
import { OwnerOrganisationController } from './owner-organisation.controller';
import { PrismaModule } from '../../database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [
    OrganisationController,
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

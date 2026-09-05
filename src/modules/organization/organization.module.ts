import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';

import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';

import { OrganizationContactController } from './contacts/organizationContact.controller';
import { OrganizationContactService } from './contacts/organizationContact.service';

import { OrganizationAddressController } from './addresses/organizationAddress.controller';
import { OrganizationAddressService } from './addresses/organizationAddress.service';

import { OrganizationTaxController } from './tax/organizationTax.controller';
import { OrganizationTaxService } from './tax/organizationTax.service';

import { OrganizationSettingsController } from './settings/organizationSettings.controller';
import { OrganizationSettingsService } from './settings/organizationSettings.service';

import { BusinessHoursController } from './business-hours/businessHours.controller';
import { BusinessHoursService } from './business-hours/businessHours.service';

import { HolidayController } from './holidays/holiday.controller';
import { HolidayService } from './holidays/holiday.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    OrganizationController,
    OrganizationContactController,
    OrganizationAddressController,
    OrganizationTaxController,
    OrganizationSettingsController,
    BusinessHoursController,
    HolidayController,
  ],
  providers: [
    OrganizationService,
    OrganizationContactService,
    OrganizationAddressService,
    OrganizationTaxService,
    OrganizationSettingsService,
    BusinessHoursService,
    HolidayService,
  ],
  exports: [
    OrganizationService,
    OrganizationContactService,
    OrganizationAddressService,
    OrganizationTaxService,
    OrganizationSettingsService,
    BusinessHoursService,
    HolidayService,
  ],
})
export class OrganizationModule {}

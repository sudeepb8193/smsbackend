import { Module } from '@nestjs/common';
import { OrganizationController } from './controllers/organization.controller';
import { OrganizationContactController } from './controllers/organization-contact.controller';
import { OrganizationAddressController } from './controllers/organization-address.controller';
import { OrganizationBusinessHoursController } from './controllers/organization-business-hours.controller';
import { OrganizationHolidayController } from './controllers/organization-holiday.controller';
import { OrganizationService } from './services/organization.service';
import { OrganizationSlugService } from './services/organization-slug.service';
import { OrganizationLifecycleService } from './services/organization-lifecycle.service';
import { OrganizationContactService } from './services/organization-contact.service';
import { OrganizationAddressService } from './services/organization-address.service';
import { OrganizationBusinessHoursService } from './services/organization-business-hours.service';
import { OrganizationHolidayService } from './services/organization-holiday.service';
import { FileStorageService } from './services/file-storage.service';
import { OrganizationProfileActivationValidator } from './validators/organization-activation.validator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PrismaModule } from '../../database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [
    OrganizationController,
    OrganizationContactController,
    OrganizationAddressController,
    OrganizationBusinessHoursController,
    OrganizationHolidayController,
  ],
  providers: [
    OrganizationService,
    OrganizationSlugService,
    OrganizationLifecycleService,
    OrganizationContactService,
    OrganizationAddressService,
    OrganizationBusinessHoursService,
    OrganizationHolidayService,
    FileStorageService,
    OrganizationProfileActivationValidator,
    RolesGuard,
  ],
  exports: [
    OrganizationService,
    OrganizationSlugService,
    OrganizationLifecycleService,
    OrganizationContactService,
    OrganizationAddressService,
    OrganizationBusinessHoursService,
    OrganizationHolidayService,
    FileStorageService,
  ],
})
export class OrganizationModule {}

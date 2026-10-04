import { Module } from '@nestjs/common';
import { OrganisationController } from './organisation.controller';
import { ApiOrganisationController } from './api-organisation.controller';
import { OrganisationService } from './organisation.service';
import { OrganisationRepository } from './organisation.repository';
import { PrismaModule } from '../../database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [OrganisationController, ApiOrganisationController],
  providers: [OrganisationService, OrganisationRepository],
  exports: [OrganisationService, OrganisationRepository],
})
export class OrganisationModule {}

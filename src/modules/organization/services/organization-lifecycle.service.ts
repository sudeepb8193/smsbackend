import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { OrganizationProfileActivationValidator } from '../validators/organization-activation.validator';
import { sms_organizations_status, sms_organizations } from '@prisma/client';

@Injectable()
export class OrganizationLifecycleService {
  constructor(
    private prisma: PrismaService,
    private activationValidator: OrganizationProfileActivationValidator,
  ) {}

  /**
   * Activate an organization after validating all activation requirements
   */
  async activateOrganization(
    organizationId: string,
  ): Promise<sms_organizations> {
    const org = await this.prisma.sms_organizations.findFirst({
      where: { id: organizationId, deletedAt: null },
    });

    if (!org) {
      throw new NotFoundException({
        code: 'ORGANIZATION_NOT_FOUND',
        message: 'Organization profile not found',
      });
    }

    const validationResult = await this.activationValidator.validate(org);
    if (!validationResult.isValid) {
      throw new BadRequestException({
        code: 'ACTIVATION_VALIDATION_FAILED',
        message:
          'Organization cannot be activated until all setup requirements are completed',
        details: validationResult.errors,
      });
    }

    const updatedOrg = await this.prisma.sms_organizations.update({
      where: { id: organizationId },
      data: {
        status: sms_organizations_status.active,
        onboardingStep: Math.max(org.onboardingStep, 1),
      },
    });

    return updatedOrg;
  }

  /**
   * Controlled status transition boundary for internal administrative use
   */
  async transitionStatus(
    organizationId: string,
    targetStatus: sms_organizations_status,
  ): Promise<sms_organizations> {
    const org = await this.prisma.sms_organizations.findFirst({
      where: { id: organizationId, deletedAt: null },
    });

    if (!org) {
      throw new NotFoundException({
        code: 'ORGANIZATION_NOT_FOUND',
        message: 'Organization profile not found',
      });
    }

    if (targetStatus === sms_organizations_status.active) {
      return this.activateOrganization(organizationId);
    }

    const updatedOrg = await this.prisma.sms_organizations.update({
      where: { id: organizationId },
      data: {
        status: targetStatus,
      },
    });

    return updatedOrg;
  }
}

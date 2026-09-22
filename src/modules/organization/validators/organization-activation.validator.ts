import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { sms_organizations } from '@prisma/client';
import { OrganizationContactService } from '../services/organization-contact.service';
import { OrganizationAddressService } from '../services/organization-address.service';
import { OrganizationBusinessHoursService } from '../services/organization-business-hours.service';

export interface ActivationValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface OrganizationActivationValidatorInterface {
  validate(
    organization: sms_organizations,
  ): Promise<ActivationValidationResult>;
}

@Injectable()
export class OrganizationProfileActivationValidator implements OrganizationActivationValidatorInterface {
  constructor(
    @Inject(forwardRef(() => OrganizationContactService))
    private contactService: OrganizationContactService,
    @Inject(forwardRef(() => OrganizationAddressService))
    private addressService: OrganizationAddressService,
    @Inject(forwardRef(() => OrganizationBusinessHoursService))
    private businessHoursService: OrganizationBusinessHoursService,
  ) {}

  async validate(
    organization: sms_organizations,
  ): Promise<ActivationValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Task 1.1 Validations
    if (!organization.name || organization.name.trim().length < 2) {
      errors.push(
        'Organization must have a valid business name (at least 2 characters)',
      );
    }

    if (organization.name && organization.name.length > 150) {
      errors.push('Business name cannot exceed 150 characters');
    }

    if (!organization.slug || organization.slug.trim().length === 0) {
      errors.push('Organization must have a valid, unique URL slug');
    }

    if (!organization.businessType) {
      errors.push('Organization must have a valid business type selected');
    }

    if (organization.status === 'active') {
      warnings.push('Organization is already active');
    }

    if (organization.status === 'suspended') {
      errors.push(
        'Suspended organizations cannot be activated directly through onboarding',
      );
    }

    // Task 1.2: Check primary contact requirement
    if (organization.id && this.contactService) {
      const contactCheck =
        await this.contactService.validatePrimaryContactRequirement(
          organization.id,
        );
      if (!contactCheck.isValid) {
        errors.push(...contactCheck.errors);
      }
    }

    // Task 1.3: Check registered address requirement
    if (organization.id && this.addressService) {
      const addressCheck =
        await this.addressService.validateRegisteredAddressRequirement(
          organization.id,
        );
      if (!addressCheck.isValid) {
        errors.push(...addressCheck.errors);
      }
    }

    // Task 1.6: Check business hours requirement
    if (organization.id && this.businessHoursService) {
      const hoursCheck =
        await this.businessHoursService.validateBusinessHoursRequirement(
          organization.id,
        );
      if (!hoursCheck.isValid) {
        errors.push(...hoursCheck.errors);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

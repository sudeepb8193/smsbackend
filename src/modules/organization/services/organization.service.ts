import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateOrganizationDto } from '../dto/create-organization.dto';
import { UpdateOrganizationDto } from '../dto/update-organization.dto';
import {
  OrganizationSlugService,
  SlugAvailabilityResult,
} from './organization-slug.service';
import {
  checkColorContrast,
  ColorContrastCheckResult,
} from '../validators/color-contrast.validator';
import { sms_organizations, sms_organizations_status } from '@prisma/client';

export interface FormattedOrganizationResponse extends sms_organizations {
  colorContrastWarnings?: {
    primaryColor?: ColorContrastCheckResult;
    secondaryColor?: ColorContrastCheckResult;
  };
}

@Injectable()
export class OrganizationService {
  constructor(
    private prisma: PrismaService,
    private slugService: OrganizationSlugService,
  ) {}

  /**
   * Create a new Organization (Super Admin / Authorized User)
   */
  async createOrganization(
    dto: CreateOrganizationDto,
    createdById: string,
  ): Promise<FormattedOrganizationResponse> {
    const name = dto.name.trim();
    const legalName = dto.legalName ? dto.legalName.trim() : null;

    // Handle slug generation or custom slug validation
    const slugInput = dto.slug || name;
    const slug = await this.slugService.ensureUniqueSlug(slugInput);

    // Validate brand colors if provided
    const primaryColorCheck = dto.brandPrimaryColor
      ? checkColorContrast(dto.brandPrimaryColor)
      : undefined;
    const secondaryColorCheck = dto.brandSecondaryColor
      ? checkColorContrast(dto.brandSecondaryColor)
      : undefined;

    // Create organization in DB
    const organization = await this.prisma.sms_organizations.create({
      data: {
        name,
        legalName,
        businessType: dto.businessType || 'salon',
        slug,
        logoUrl: dto.logoUrl || null,
        faviconUrl: dto.faviconUrl || null,
        brandPrimaryColor:
          primaryColorCheck?.hex || dto.brandPrimaryColor || null,
        brandSecondaryColor:
          secondaryColorCheck?.hex || dto.brandSecondaryColor || null,
        status: sms_organizations_status.onboarding,
        onboardingStep: 0,
        createdById,
      },
    });

    // Link user to new organization if user is currently unlinked
    if (createdById) {
      await this.prisma.sms_users.update({
        where: { id: createdById },
        data: { organizationId: organization.id },
      });
    }

    return this.formatOrganizationResponse(organization);
  }

  /**
   * Get Current Organization Profile for Authenticated Tenant
   */
  async getOrganization(
    organizationId: string,
  ): Promise<FormattedOrganizationResponse> {
    const organization = await this.prisma.sms_organizations.findFirst({
      where: {
        id: organizationId,
        deletedAt: null,
      },
    });

    if (!organization) {
      throw new NotFoundException({
        code: 'ORGANIZATION_NOT_FOUND',
        message: 'Organization profile not found or has been deactivated',
      });
    }

    return this.formatOrganizationResponse(organization);
  }

  /**
   * Update Current Organization Identity & Branding
   */
  async updateOrganization(
    organizationId: string,
    dto: UpdateOrganizationDto,
  ): Promise<FormattedOrganizationResponse> {
    const existingOrg = await this.prisma.sms_organizations.findFirst({
      where: {
        id: organizationId,
        deletedAt: null,
      },
    });

    if (!existingOrg) {
      throw new NotFoundException({
        code: 'ORGANIZATION_NOT_FOUND',
        message: 'Organization profile not found or has been deactivated',
      });
    }

    const updateData: Partial<sms_organizations> = {};

    if (dto.name !== undefined) {
      updateData.name = dto.name.trim();
    }

    if (dto.legalName !== undefined) {
      updateData.legalName = dto.legalName ? dto.legalName.trim() : null;
    }

    if (dto.businessType !== undefined) {
      updateData.businessType = dto.businessType;
    }

    // Handle slug update:
    // If client explicitly sent a slug, validate and ensure uniqueness
    if (dto.slug !== undefined) {
      const uniqueSlug = await this.slugService.ensureUniqueSlug(
        dto.slug,
        organizationId,
      );
      updateData.slug = uniqueSlug;
    }
    // Note: If name changed and slug was NOT explicitly sent in dto, preserve the existing slug!

    if (dto.logoUrl !== undefined) {
      updateData.logoUrl = dto.logoUrl;
    }

    if (dto.faviconUrl !== undefined) {
      updateData.faviconUrl = dto.faviconUrl;
    }

    if (dto.brandPrimaryColor !== undefined) {
      const check = checkColorContrast(dto.brandPrimaryColor);
      updateData.brandPrimaryColor = check.hex;
    }

    if (dto.brandSecondaryColor !== undefined) {
      const check = checkColorContrast(dto.brandSecondaryColor);
      updateData.brandSecondaryColor = check.hex;
    }

    const updatedOrg = await this.prisma.sms_organizations.update({
      where: { id: organizationId },
      data: updateData,
    });

    return this.formatOrganizationResponse(updatedOrg);
  }

  /**
   * Check slug availability (debounced API endpoint helper)
   */
  async checkSlugAvailability(
    slug: string,
    currentOrganizationId?: string,
  ): Promise<SlugAvailabilityResult> {
    return this.slugService.checkSlugAvailability(slug, currentOrganizationId);
  }

  /**
   * Soft delete organization record
   */
  async softDeleteOrganization(
    organizationId: string,
  ): Promise<sms_organizations> {
    const existing = await this.prisma.sms_organizations.findFirst({
      where: { id: organizationId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'ORGANIZATION_NOT_FOUND',
        message: 'Organization not found',
      });
    }

    return this.prisma.sms_organizations.update({
      where: { id: organizationId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Helper to append color contrast warnings to response payload
   */
  private formatOrganizationResponse(
    organization: sms_organizations,
  ): FormattedOrganizationResponse {
    let colorContrastWarnings: FormattedOrganizationResponse['colorContrastWarnings'] =
      undefined;

    if (organization.brandPrimaryColor) {
      const primaryCheck = checkColorContrast(organization.brandPrimaryColor);
      if (primaryCheck.contrastWarning) {
        colorContrastWarnings = colorContrastWarnings || {};
        colorContrastWarnings.primaryColor = primaryCheck;
      }
    }

    if (organization.brandSecondaryColor) {
      const secondaryCheck = checkColorContrast(
        organization.brandSecondaryColor,
      );
      if (secondaryCheck.contrastWarning) {
        colorContrastWarnings = colorContrastWarnings || {};
        colorContrastWarnings.secondaryColor = secondaryCheck;
      }
    }

    return {
      ...organization,
      ...(colorContrastWarnings ? { colorContrastWarnings } : {}),
    };
  }
}

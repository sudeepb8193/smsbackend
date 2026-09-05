import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationStatus, OrganizationBusinessType } from './organization.types';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  public generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  public calculateLuminance(hex: string): number {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

    const transform = (val: number) =>
      val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);

    return 0.2126 * transform(r) + 0.7152 * transform(g) + 0.0722 * transform(b);
  }

  public calculateContrastRatio(hex1: string, hex2: string): number {
    const l1 = this.calculateLuminance(hex1);
    const l2 = this.calculateLuminance(hex2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  public validateColorContrast(color: string): { warnings: string[] } {
    const warnings: string[] = [];
    if (!color) return { warnings };

    const contrastAgainstWhite = this.calculateContrastRatio(color, '#FFFFFF');
    const contrastAgainstBlack = this.calculateContrastRatio(color, '#000000');
    const maxContrast = Math.max(contrastAgainstWhite, contrastAgainstBlack);

    if (maxContrast < 4.5) {
      warnings.push(
        `Brand color ${color} does not achieve WCAG AA contrast ratio (4.5:1) against white or black text (max contrast: ${maxContrast.toFixed(2)}:1).`,
      );
    } else if (contrastAgainstWhite < 4.5) {
      warnings.push(
        `Brand color ${color} has low contrast against white text (${contrastAgainstWhite.toFixed(2)}:1). Use black text for WCAG AA compliance.`,
      );
    }

    return { warnings };
  }

  async checkSlugAvailability(slug: string, currentOrgId?: number) {
    const normalizedSlug = slug.toLowerCase().trim();
    const existing = await this.prisma.smsOrganization.findUnique({
      where: { slug: normalizedSlug },
    });

    if (!existing || (currentOrgId && existing.id === currentOrgId)) {
      return { available: true, slug: normalizedSlug, alternatives: [] };
    }

    // Generate 3 available alternatives
    const candidates = [
      `${normalizedSlug}-1`,
      `${normalizedSlug}-2`,
      `${normalizedSlug}-${new Date().getFullYear()}`,
      `${normalizedSlug}-salon`,
    ];

    const taken = await this.prisma.smsOrganization.findMany({
      where: { slug: { in: candidates } },
      select: { slug: true },
    });
    const takenSlugs = new Set(taken.map((t) => t.slug));

    const alternatives = candidates.filter((c) => !takenSlugs.has(c)).slice(0, 3);

    return {
      available: false,
      slug: normalizedSlug,
      alternatives,
    };
  }

  async create(dto: CreateOrganizationDto, userId?: number) {
    if (dto.name && (dto.name.includes('<') || dto.name.includes('>'))) {
      throw new BadRequestException('Business name cannot contain HTML or script content.');
    }

    let targetSlug = dto.slug ? dto.slug.toLowerCase().trim() : this.generateSlug(dto.name);
    if (!targetSlug) {
      targetSlug = `org-${Date.now()}`;
    }

    const availability = await this.checkSlugAvailability(targetSlug);
    if (!availability.available) {
      throw new ConflictException({
        message: `Slug '${targetSlug}' is already taken.`,
        alternatives: availability.alternatives,
      });
    }

    const warnings: string[] = [];
    if (dto.brandPrimaryColor) {
      const colorCheck = this.validateColorContrast(dto.brandPrimaryColor);
      warnings.push(...colorCheck.warnings);
    }
    if (dto.brandSecondaryColor) {
      const colorCheck = this.validateColorContrast(dto.brandSecondaryColor);
      warnings.push(...colorCheck.warnings);
    }

    const organization = await this.prisma.smsOrganization.create({
      data: {
        name: dto.name,
        legalName: dto.legalName,
        slug: targetSlug,
        businessType: dto.businessType || 'salon',
        logoUrl: dto.logoUrl,
        faviconUrl: dto.faviconUrl,
        brandPrimaryColor: dto.brandPrimaryColor,
        brandSecondaryColor: dto.brandSecondaryColor,
        status: dto.status || OrganizationStatus.ONBOARDING,
        onboardingStep: dto.onboardingStep || 1,
        createdBy: userId || null,
        settings: {
          create: {
            defaultCurrencyCode: 'USD',
            currencySymbolPosition: 'prefix',
            currencyDecimalPlaces: 2,
            timezone: 'UTC',
            dateFormat: 'YYYY-MM-DD',
            timeFormat: '12h',
            firstDayOfWeek: 'monday',
            languageCode: 'en',
            fiscalYearStartMonth: 1,
          },
        },
      },
      include: {
        settings: true,
      },
    });

    return {
      ...organization,
      warnings,
    };
  }

  async findById(id: number) {
    let organization = await this.prisma.smsOrganization.findFirst({
      where: { id, deletedAt: null },
      include: {
        contacts: true,
        addresses: true,
        taxProfiles: true,
        settings: true,
      },
    });

    if (!organization && id === 1) {
      // Auto-initialize default root organization if database is unseeded
      const created = await this.create({
        name: 'Main Salon & Spa',
        slug: 'main-salon',
        legalName: 'Main Salon & Spa LLC',
        businessType: OrganizationBusinessType.SALON,
        status: OrganizationStatus.ONBOARDING,
      });

      organization = await this.prisma.smsOrganization.findFirst({
        where: { id: created.id },
        include: {
          contacts: true,
          addresses: true,
          taxProfiles: true,
          settings: true,
        },
      });
    }

    if (!organization) {
      throw new NotFoundException(`Organization with ID ${id} not found.`);
    }

    return organization;
  }

  async update(id: number, dto: UpdateOrganizationDto) {
    const existing = await this.findById(id);

    if (dto.name && (dto.name.includes('<') || dto.name.includes('>'))) {
      throw new BadRequestException('Business name cannot contain HTML or script content.');
    }

    if (dto.slug && dto.slug !== existing.slug) {
      const availability = await this.checkSlugAvailability(dto.slug, id);
      if (!availability.available) {
        throw new ConflictException({
          message: `Slug '${dto.slug}' is already taken.`,
          alternatives: availability.alternatives,
        });
      }
    }

    if (dto.status === OrganizationStatus.ACTIVE && existing.status !== OrganizationStatus.ACTIVE) {
      await this.validateActivationPrerequisites(id);
    }

    const warnings: string[] = [];
    if (dto.brandPrimaryColor) {
      const colorCheck = this.validateColorContrast(dto.brandPrimaryColor);
      warnings.push(...colorCheck.warnings);
    }
    if (dto.brandSecondaryColor) {
      const colorCheck = this.validateColorContrast(dto.brandSecondaryColor);
      warnings.push(...colorCheck.warnings);
    }

    const updated = await this.prisma.smsOrganization.update({
      where: { id },
      data: {
        name: dto.name,
        legalName: dto.legalName,
        slug: dto.slug ? dto.slug.toLowerCase().trim() : undefined,
        businessType: dto.businessType,
        logoUrl: dto.logoUrl,
        faviconUrl: dto.faviconUrl,
        brandPrimaryColor: dto.brandPrimaryColor,
        brandSecondaryColor: dto.brandSecondaryColor,
        status: dto.status,
        onboardingStep: dto.onboardingStep,
      },
      include: {
        contacts: true,
        addresses: true,
        taxProfiles: true,
        settings: true,
      },
    });

    return {
      ...updated,
      warnings,
    };
  }

  async validateActivationPrerequisites(organizationId: number) {
    const primaryContact = await this.prisma.smsOrganizationContact.findFirst({
      where: { organizationId, contactType: 'primary' },
    });

    if (!primaryContact || !primaryContact.phoneNumber || !primaryContact.email) {
      throw new BadRequestException(
        'Organization activation requires a Primary contact containing both a phone number and an email address.',
      );
    }

    const registeredAddress = await this.prisma.smsOrganizationAddress.findFirst({
      where: { organizationId, addressType: 'registered' },
    });

    if (!registeredAddress) {
      throw new BadRequestException(
        'Organization activation requires a Registered Office address.',
      );
    }
  }
}

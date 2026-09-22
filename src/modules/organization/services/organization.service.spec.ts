import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationService } from './organization.service';
import { OrganizationSlugService } from './organization-slug.service';
import { PrismaService } from '../../../database/prisma.service';
import { NotFoundException } from '@nestjs/common';
import {
  sms_organizations_status,
  sms_organizations_businessType,
} from '@prisma/client';

describe('OrganizationService', () => {
  let service: OrganizationService;
  let prismaService: any;
  let slugService: any;

  const mockOrg = {
    id: 'org-uuid-1',
    name: 'Glow Beauty Salon',
    legalName: 'Glow Beauty Services Pvt Ltd',
    slug: 'glow-beauty-salon',
    businessType: sms_organizations_businessType.salon,
    logoUrl: '/uploads/logo.png',
    faviconUrl: '/uploads/favicon.ico',
    brandPrimaryColor: '#8A4A52',
    brandSecondaryColor: '#F5E6E8',
    status: sms_organizations_status.onboarding,
    onboardingStep: 0,
    createdById: 'user-uuid-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    prismaService = {
      sms_organizations: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      sms_users: {
        update: jest.fn(),
      },
    };

    slugService = {
      ensureUniqueSlug: jest.fn(),
      checkSlugAvailability: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        { provide: PrismaService, useValue: prismaService },
        { provide: OrganizationSlugService, useValue: slugService },
      ],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createOrganization', () => {
    it('should create an organization with validated slug and assigned createdById', async () => {
      slugService.ensureUniqueSlug.mockResolvedValue('glow-beauty-salon');
      prismaService.sms_organizations.create.mockResolvedValue(mockOrg);
      prismaService.sms_users.update.mockResolvedValue({});

      const dto = {
        name: 'Glow Beauty Salon',
        legalName: 'Glow Beauty Services Pvt Ltd',
        businessType: sms_organizations_businessType.salon,
        brandPrimaryColor: '#8A4A52',
      };

      const result = await service.createOrganization(dto, 'user-uuid-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('org-uuid-1');
      expect(result.name).toBe('Glow Beauty Salon');
      expect(prismaService.sms_organizations.create).toHaveBeenCalled();
      expect(prismaService.sms_users.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
        data: { organizationId: 'org-uuid-1' },
      });
    });
  });

  describe('getOrganization', () => {
    it('should return current organization for tenant', async () => {
      prismaService.sms_organizations.findFirst.mockResolvedValue(mockOrg);

      const result = await service.getOrganization('org-uuid-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('org-uuid-1');
    });

    it('should throw NotFoundException if organization is soft-deleted or does not exist', async () => {
      prismaService.sms_organizations.findFirst.mockResolvedValue(null);

      await expect(service.getOrganization('invalid-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateOrganization', () => {
    it('should update allowable fields and preserve custom slug when name changes', async () => {
      prismaService.sms_organizations.findFirst.mockResolvedValue(mockOrg);
      prismaService.sms_organizations.update.mockResolvedValue({
        ...mockOrg,
        name: 'Glow Luxury Salon',
      });

      const dto = {
        name: 'Glow Luxury Salon',
      };

      const result = await service.updateOrganization('org-uuid-1', dto);

      expect(result.name).toBe('Glow Luxury Salon');
      // Verify slugService.ensureUniqueSlug was NOT called because slug was not sent in DTO
      expect(slugService.ensureUniqueSlug).not.toHaveBeenCalled();
    });

    it('should update slug when client explicitly submits a new slug', async () => {
      prismaService.sms_organizations.findFirst.mockResolvedValue(mockOrg);
      slugService.ensureUniqueSlug.mockResolvedValue('glow-luxury-custom-slug');
      prismaService.sms_organizations.update.mockResolvedValue({
        ...mockOrg,
        slug: 'glow-luxury-custom-slug',
      });

      const dto = {
        slug: 'glow-luxury-custom-slug',
      };

      const result = await service.updateOrganization('org-uuid-1', dto);

      expect(result.slug).toBe('glow-luxury-custom-slug');
      expect(slugService.ensureUniqueSlug).toHaveBeenCalledWith(
        'glow-luxury-custom-slug',
        'org-uuid-1',
      );
    });
  });

  describe('softDeleteOrganization', () => {
    it('should set deletedAt timestamp', async () => {
      prismaService.sms_organizations.findFirst.mockResolvedValue(mockOrg);
      prismaService.sms_organizations.update.mockResolvedValue({
        ...mockOrg,
        deletedAt: new Date(),
      });

      const result = await service.softDeleteOrganization('org-uuid-1');

      expect(result.deletedAt).toBeDefined();
    });
  });
});

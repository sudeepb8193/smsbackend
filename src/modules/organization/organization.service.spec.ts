import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationService } from './organization.service';
import { PrismaService } from '../../database/prisma.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { OrganizationStatus } from './organization.types';

describe('OrganizationService (Task 1.1)', () => {
  let service: OrganizationService;
  let prisma: any;

  const mockPrisma = {
    smsOrganization: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    smsOrganizationContact: {
      findFirst: jest.fn(),
    },
    smsOrganizationAddress: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('slug generation & availability', () => {
    it('should generate a valid slug from business name', () => {
      const slug = service.generateSlug('Glamour & Style Salon');
      expect(slug).toBe('glamour-style-salon');
    });

    it('should return available: true when slug is free', async () => {
      mockPrisma.smsOrganization.findUnique.mockResolvedValue(null);
      const res = await service.checkSlugAvailability('unique-salon');
      expect(res.available).toBe(true);
      expect(res.slug).toBe('unique-salon');
      expect(res.alternatives).toEqual([]);
    });

    it('should generate 3 alternatives when slug is taken', async () => {
      mockPrisma.smsOrganization.findUnique.mockResolvedValue({ id: 1, slug: 'taken-salon' });
      mockPrisma.smsOrganization.findMany.mockResolvedValue([]); // candidates are free

      const res = await service.checkSlugAvailability('taken-salon');
      expect(res.available).toBe(false);
      expect(res.alternatives.length).toBe(3);
      expect(res.alternatives[0]).toBe('taken-salon-1');
    });
  });

  describe('WCAG AA color contrast check', () => {
    it('should calculate contrast and warn if WCAG AA is not met', () => {
      const check = service.validateColorContrast('#FFFF00'); // yellow on white is low contrast
      expect(check.warnings.length).toBeGreaterThan(0);
    });

    it('should pass without warnings for high contrast colors', () => {
      const check = service.validateColorContrast('#000000'); // black text on white
      expect(check.warnings.length).toBe(0);
    });
  });

  describe('organization creation', () => {
    it('should reject creation if business name contains HTML/script tags', async () => {
      await expect(
        service.create({ name: 'Salon <script>alert(1)</script>' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create organization with auto-generated slug and settings', async () => {
      mockPrisma.smsOrganization.findUnique.mockResolvedValue(null);
      mockPrisma.smsOrganization.create.mockResolvedValue({
        id: 10,
        name: 'Royal Spa',
        slug: 'royal-spa',
        status: OrganizationStatus.ONBOARDING,
      });

      const res = await service.create({ name: 'Royal Spa' });
      expect(res.name).toBe('Royal Spa');
      expect(res.slug).toBe('royal-spa');
      expect(mockPrisma.smsOrganization.create).toHaveBeenCalled();
    });

    it('should throw ConflictException with alternatives if slug is taken', async () => {
      mockPrisma.smsOrganization.findUnique.mockResolvedValue({ id: 1, slug: 'royal-spa' });
      mockPrisma.smsOrganization.findMany.mockResolvedValue([]);

      await expect(
        service.create({ name: 'Royal Spa', slug: 'royal-spa' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('activation prerequisites validation', () => {
    it('should block activation if Primary contact is missing or incomplete', async () => {
      mockPrisma.smsOrganization.findFirst.mockResolvedValueOnce({ id: 1, name: 'Org' });
      mockPrisma.smsOrganizationContact.findFirst.mockResolvedValueOnce(null); // No primary contact

      await expect(
        service.update(1, { status: OrganizationStatus.ACTIVE }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should block activation if Registered Office address is missing', async () => {
      mockPrisma.smsOrganization.findFirst.mockResolvedValueOnce({ id: 1, name: 'Org', status: 'onboarding' });
      mockPrisma.smsOrganizationContact.findFirst.mockResolvedValueOnce({
        id: 2,
        contactType: 'primary',
        phoneNumber: '+1234567890',
        email: 'owner@salon.com',
      });
      mockPrisma.smsOrganizationAddress.findFirst.mockResolvedValueOnce(null); // No registered address

      await expect(
        service.update(1, { status: OrganizationStatus.ACTIVE }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

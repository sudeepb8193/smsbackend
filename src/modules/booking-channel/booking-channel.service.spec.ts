import { Test, TestingModule } from '@nestjs/testing';
import { BookingChannelService } from './booking-channel.service';
import { PrismaService } from '../../database/prisma.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { NotFoundException } from '@nestjs/common';

describe('BookingChannelService', () => {
  let service: BookingChannelService;
  let prisma: any;
  let platformSettingsService: any;

  beforeEach(async () => {
    prisma = {
      sms_organizations: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    platformSettingsService = {
      isMarketplaceEnabled: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingChannelService,
        { provide: PrismaService, useValue: prisma },
        { provide: PlatformSettingsService, useValue: platformSettingsService },
      ],
    }).compile();

    service = module.get<BookingChannelService>(BookingChannelService);
  });

  describe('validateBookingChannel', () => {
    it('should throw NotFoundException if organisation does not exist', async () => {
      prisma.sms_organizations.findUnique.mockResolvedValue(null);

      await expect(
        service.validateBookingChannel({
          organizationId: 'non-existent-org',
          channel: 'direct_website',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject bookings if organisation is inactive', async () => {
      prisma.sms_organizations.findUnique.mockResolvedValue({
        id: 'org-1',
        name: 'Inactive Salon',
        status: 'inactive',
        operatingMode: 'INDIVIDUAL_WEBSITE',
        marketplaceListingStatus: 'published',
      });

      await expect(
        service.validateBookingChannel({
          organizationId: 'org-1',
          channel: 'direct_website',
        }),
      ).rejects.toThrow();
    });

    it('should allow direct_website booking for INDIVIDUAL_WEBSITE mode', async () => {
      prisma.sms_organizations.findUnique.mockResolvedValue({
        id: 'org-individual',
        name: 'Boutique Hair',
        status: 'active',
        operatingMode: 'INDIVIDUAL_WEBSITE',
        marketplaceListingStatus: 'draft',
      });

      const result = await service.validateBookingChannel({
        organizationId: 'org-individual',
        channel: 'direct_website',
      });
      expect(result.allowed).toBe(true);
      expect(result.channel).toBe('direct_website');
      expect(result.organization.operatingMode).toBe('INDIVIDUAL_WEBSITE');
    });

    it('should allow direct_website booking for CENTRAL_MARKETPLACE mode regardless of marketplace global toggle', async () => {
      prisma.sms_organizations.findUnique.mockResolvedValue({
        id: 'org-marketplace',
        name: 'Urban Glow Studio',
        status: 'active',
        operatingMode: 'CENTRAL_MARKETPLACE',
        marketplaceListingStatus: 'draft',
      });
      platformSettingsService.isMarketplaceEnabled.mockResolvedValue(false);

      const result = await service.validateBookingChannel({
        organizationId: 'org-marketplace',
        channel: 'direct_website',
      });
      expect(result.allowed).toBe(true);
      expect(result.channel).toBe('direct_website');
      expect(result.organization.operatingMode).toBe('CENTRAL_MARKETPLACE');
    });

    it('should REJECT marketplace booking for INDIVIDUAL_WEBSITE organisation', async () => {
      prisma.sms_organizations.findUnique.mockResolvedValue({
        id: 'org-individual',
        name: 'Private Salon Studio',
        status: 'active',
        operatingMode: 'INDIVIDUAL_WEBSITE',
        marketplaceListingStatus: 'draft',
      });
      platformSettingsService.isMarketplaceEnabled.mockResolvedValue(true);

      await expect(
        service.validateBookingChannel({
          organizationId: 'org-individual',
          channel: 'marketplace',
        }),
      ).rejects.toThrow('Individual Website mode');
    });

    it('should REJECT marketplace booking when global marketplace switch is disabled', async () => {
      prisma.sms_organizations.findUnique.mockResolvedValue({
        id: 'org-marketplace',
        name: 'Elite Barbers',
        status: 'active',
        operatingMode: 'CENTRAL_MARKETPLACE',
        marketplaceListingStatus: 'published',
      });
      platformSettingsService.isMarketplaceEnabled.mockResolvedValue(false);

      await expect(
        service.validateBookingChannel({
          organizationId: 'org-marketplace',
          channel: 'marketplace',
        }),
      ).rejects.toThrow('temporarily disabled');
    });

    it('should REJECT marketplace booking when organisation listing is in draft or unpublished status', async () => {
      prisma.sms_organizations.findUnique.mockResolvedValue({
        id: 'org-marketplace',
        name: 'Elite Barbers',
        status: 'active',
        operatingMode: 'CENTRAL_MARKETPLACE',
        marketplaceListingStatus: 'draft',
      });
      platformSettingsService.isMarketplaceEnabled.mockResolvedValue(true);

      await expect(
        service.validateBookingChannel({
          organizationId: 'org-marketplace',
          channel: 'marketplace',
        }),
      ).rejects.toThrow('not currently published');
    });

    it('should ALLOW marketplace booking when CENTRAL_MARKETPLACE, global switch is ON, and listing is published', async () => {
      prisma.sms_organizations.findUnique.mockResolvedValue({
        id: 'org-marketplace',
        name: 'Elite Barbers',
        status: 'active',
        operatingMode: 'CENTRAL_MARKETPLACE',
        marketplaceListingStatus: 'published',
      });
      platformSettingsService.isMarketplaceEnabled.mockResolvedValue(true);

      const result = await service.validateBookingChannel({
        organizationId: 'org-marketplace',
        channel: 'marketplace',
      });
      expect(result.allowed).toBe(true);
      expect(result.channel).toBe('marketplace');
      expect(result.organization.operatingMode).toBe('CENTRAL_MARKETPLACE');
      expect(result.organization.marketplaceListingStatus).toBe('published');
    });
  });

  describe('getMarketplaceSalons', () => {
    it('should return empty salons list when global marketplace is disabled', async () => {
      platformSettingsService.isMarketplaceEnabled.mockResolvedValue(false);

      const result = await service.getMarketplaceSalons({});
      expect(result.marketplaceEnabled).toBe(false);
      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });

    it('should query only active, CENTRAL_MARKETPLACE, published organisations when enabled', async () => {
      platformSettingsService.isMarketplaceEnabled.mockResolvedValue(true);
      prisma.sms_organizations.findMany.mockResolvedValue([
        {
          id: 'org-1',
          name: 'Marketplace Salon A',
          code: 'MSA',
          logoUrl: null,
          bannerUrl: null,
          operatingMode: 'CENTRAL_MARKETPLACE',
          marketplaceListingStatus: 'published',
          branches: [],
        },
      ]);
      prisma.sms_organizations.count.mockResolvedValue(1);

      const result = await service.getMarketplaceSalons({ page: 1, limit: 10 });
      expect(result.marketplaceEnabled).toBe(true);
      expect(result.data.length).toBe(1);
      expect(result.meta.total).toBe(1);
      expect(prisma.sms_organizations.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            operatingMode: 'CENTRAL_MARKETPLACE',
            marketplaceListingStatus: 'published',
            status: 'active',
          }),
        }),
      );
    });
  });
});

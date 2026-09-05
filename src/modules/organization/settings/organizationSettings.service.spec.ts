import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationSettingsService } from './organizationSettings.service';
import { PrismaService } from '../../../database/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('OrganizationSettingsService (Task 1.5)', () => {
  let service: OrganizationSettingsService;
  let prisma: any;

  const mockPrisma = {
    smsOrganizationSettings: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationSettingsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<OrganizationSettingsService>(OrganizationSettingsService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('validations', () => {
    it('should pass valid ISO currency codes', () => {
      expect(() => service.validateCurrencyCode('USD')).not.toThrow();
      expect(() => service.validateCurrencyCode('EUR')).not.toThrow();
      expect(() => service.validateCurrencyCode('INR')).not.toThrow();
    });

    it('should throw BadRequestException for invalid currency code', () => {
      expect(() => service.validateCurrencyCode('XYZ')).toThrow(BadRequestException);
    });

    it('should pass valid IANA timezone', () => {
      expect(() => service.validateTimezone('America/New_York')).not.toThrow();
      expect(() => service.validateTimezone('Asia/Kolkata')).not.toThrow();
    });

    it('should throw BadRequestException for invalid timezone', () => {
      expect(() => service.validateTimezone('Invalid/Timezone_Name')).toThrow(BadRequestException);
    });
  });

  describe('currency change protection', () => {
    it('should allow currency update without confirmation if no financial transactions exist', async () => {
      mockPrisma.smsOrganizationSettings.findUnique.mockResolvedValue({
        organizationId: 10,
        defaultCurrencyCode: 'USD',
      });
      mockPrisma.smsOrganizationSettings.update.mockResolvedValue({
        organizationId: 10,
        defaultCurrencyCode: 'EUR',
      });

      const res = await service.updateSettings(10, { defaultCurrencyCode: 'EUR' }, false);
      expect(res.defaultCurrencyCode).toBe('EUR');
    });

    it('should block currency update if financial transactions exist and confirmation is missing', async () => {
      mockPrisma.smsOrganizationSettings.findUnique.mockResolvedValue({
        organizationId: 10,
        defaultCurrencyCode: 'USD',
      });

      await expect(
        service.updateSettings(10, { defaultCurrencyCode: 'EUR' }, true),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow currency update if financial transactions exist and confirmation is provided', async () => {
      mockPrisma.smsOrganizationSettings.findUnique.mockResolvedValue({
        organizationId: 10,
        defaultCurrencyCode: 'USD',
      });
      mockPrisma.smsOrganizationSettings.update.mockResolvedValue({
        organizationId: 10,
        defaultCurrencyCode: 'EUR',
      });

      const res = await service.updateSettings(
        10,
        {
          defaultCurrencyCode: 'EUR',
          confirmCurrencyChange: true,
          confirmCurrencyCode: 'EUR',
        },
        true,
      );

      expect(res.defaultCurrencyCode).toBe('EUR');
    });
  });
});

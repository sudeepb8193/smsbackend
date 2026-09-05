import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationTaxService } from './organizationTax.service';
import { PrismaService } from '../../../database/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TaxIdentifierType } from '../organization.types';

describe('OrganizationTaxService (Task 1.4)', () => {
  let service: OrganizationTaxService;
  let prisma: any;

  const mockPrisma = {
    smsOrganizationTaxProfile: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationTaxService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<OrganizationTaxService>(OrganizationTaxService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('tax identifier format validation', () => {
    it('should validate correct GSTIN format', () => {
      expect(() =>
        service.validateTaxIdentifierFormat('gstin', '22AAAAA0000A1Z5'),
      ).not.toThrow();
    });

    it('should reject invalid GSTIN format', () => {
      expect(() =>
        service.validateTaxIdentifierFormat('gstin', 'INVALID123'),
      ).toThrow(BadRequestException);
    });

    it('should validate correct PAN format', () => {
      expect(() =>
        service.validateTaxIdentifierFormat('pan', 'ABCDE1234F'),
      ).not.toThrow();
    });

    it('should reject invalid PAN format', () => {
      expect(() =>
        service.validateTaxIdentifierFormat('pan', '12345ABCDE'),
      ).toThrow(BadRequestException);
    });
  });

  describe('tax profile management & verification workflow', () => {
    it('should create tax profile with pending verification status', async () => {
      mockPrisma.smsOrganizationTaxProfile.create.mockResolvedValue({
        id: 1,
        organizationId: 10,
        taxIdentifierType: 'gstin',
        taxIdentifierNumber: '22AAAAA0000A1Z5',
        verificationStatus: 'pending',
      });

      const res = await service.createTaxProfile(10, {
        taxIdentifierType: TaxIdentifierType.GSTIN,
        taxIdentifierNumber: '22AAAAA0000A1Z5',
        registeredBusinessName: 'Test Corp',
      });

      expect(res.verificationStatus).toBe('pending');
      expect(mockPrisma.smsOrganizationTaxProfile.create).toHaveBeenCalled();
    });

    it('should block verification submission if documentUrl is missing', async () => {
      mockPrisma.smsOrganizationTaxProfile.findUnique.mockResolvedValue({
        id: 1,
        documentUrl: null,
      });

      await expect(service.submitVerification(1)).rejects.toThrow(BadRequestException);
    });

    it('should verify tax profile via privileged action', async () => {
      mockPrisma.smsOrganizationTaxProfile.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.smsOrganizationTaxProfile.update.mockResolvedValue({
        id: 1,
        verificationStatus: 'verified',
        verifiedAt: new Date(),
      });

      const res = await service.verifyTaxProfile(1);
      expect(res.verificationStatus).toBe('verified');
      expect(res.verifiedAt).toBeDefined();
    });

    it('should reject tax profile with notes', async () => {
      mockPrisma.smsOrganizationTaxProfile.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.smsOrganizationTaxProfile.update.mockResolvedValue({
        id: 1,
        verificationStatus: 'rejected',
        verificationNotes: 'Document illegible',
      });

      const res = await service.rejectTaxProfile(1, 'Document illegible');
      expect(res.verificationStatus).toBe('rejected');
      expect(res.verificationNotes).toBe('Document illegible');
    });
  });
});

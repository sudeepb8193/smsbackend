import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationAddressService } from './organizationAddress.service';
import { PrismaService } from '../../../database/prisma.service';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { AddressType } from '../organization.types';

describe('OrganizationAddressService (Task 1.3)', () => {
  let service: OrganizationAddressService;
  let prisma: any;

  const mockPrisma = {
    smsOrganizationAddress: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    smsOrganization: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationAddressService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<OrganizationAddressService>(OrganizationAddressService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('address creation', () => {
    it('should create a registered address with valid ISO country code', async () => {
      mockPrisma.smsOrganizationAddress.findFirst.mockResolvedValue(null);
      mockPrisma.smsOrganizationAddress.create.mockResolvedValue({
        id: 1,
        organizationId: 10,
        addressType: 'registered',
        addressLine1: '123 Main St',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        countryCode: 'US',
      });

      const res = await service.createAddress(10, {
        addressType: AddressType.REGISTERED,
        addressLine1: '123 Main St',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        countryCode: 'US',
      });

      expect(res.countryCode).toBe('US');
      expect(mockPrisma.smsOrganizationAddress.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if duplicate addressType is created for same org', async () => {
      mockPrisma.smsOrganizationAddress.findFirst.mockResolvedValue({
        id: 1,
        addressType: 'registered',
      });

      await expect(
        service.createAddress(10, {
          addressType: AddressType.REGISTERED,
          addressLine1: '456 Wall St',
          city: 'New York',
          state: 'NY',
          postalCode: '10005',
          countryCode: 'US',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should support sameAsRegistered for billing address', async () => {
      mockPrisma.smsOrganizationAddress.findFirst
        .mockResolvedValueOnce(null) // no duplicate billing address
        .mockResolvedValueOnce({
          id: 1,
          addressLine1: '123 Main St',
          city: 'New York',
          state: 'NY',
          postalCode: '10001',
          countryCode: 'US',
        }); // registered address

      mockPrisma.smsOrganizationAddress.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 2, ...data }),
      );

      const res = await service.createAddress(10, {
        addressType: AddressType.BILLING,
        sameAsRegistered: true,
      });

      expect(res.addressLine1).toBe('123 Main St');
      expect(res.countryCode).toBe('US');
    });
  });

  describe('address deletion protection', () => {
    it('should block deletion of registered office address when organization is active', async () => {
      mockPrisma.smsOrganizationAddress.findUnique.mockResolvedValue({
        id: 1,
        organizationId: 10,
        addressType: 'registered',
      });
      mockPrisma.smsOrganization.findUnique.mockResolvedValue({ id: 10, status: 'active' });

      await expect(service.deleteAddress(1)).rejects.toThrow(BadRequestException);
    });
  });
});

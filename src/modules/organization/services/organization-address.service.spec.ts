jest.mock('@nestjs/passport', () => ({
  AuthGuard: jest.fn().mockImplementation(
    () =>
      class MockGuard {
        canActivate() {
          return true;
        }
      },
  ),
  PassportModule: { register: jest.fn().mockReturnValue({}) },
}));

jest.mock('../../../auth/guards/jwt-auth.guard', () => ({
  JwtAuthGuard: class MockJwtAuthGuard {
    canActivate() {
      return true;
    }
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationAddressService } from './organization-address.service';
import { PrismaService } from '../../../database/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { sms_organizationAddresses_addressType } from '@prisma/client';

describe('OrganizationAddressService', () => {
  let service: OrganizationAddressService;
  let prismaService: any;

  const mockRegisteredAddress = {
    id: 'address-uuid-registered',
    organizationId: 'org-uuid-1',
    addressType: sms_organizationAddresses_addressType.registered,
    addressLine1: '123 Main Street',
    addressLine2: 'Suite 400',
    landmark: 'Near City Park',
    city: 'Metropolis',
    state: 'NY',
    postalCode: '10001',
    country: 'USA',
    latitude: 40.7128,
    longitude: -74.006,
    sameAsRegistered: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockBillingAddressSameAsRegistered = {
    id: 'address-uuid-billing',
    organizationId: 'org-uuid-1',
    addressType: sms_organizationAddresses_addressType.billing,
    addressLine1: '',
    addressLine2: null,
    landmark: null,
    city: '',
    state: '',
    postalCode: '',
    country: '',
    latitude: null,
    longitude: null,
    sameAsRegistered: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    prismaService = {
      sms_organizationAddresses: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(prismaService)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationAddressService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<OrganizationAddressService>(
      OrganizationAddressService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createAddress', () => {
    it('should create a registered address when all required fields are provided', async () => {
      prismaService.sms_organizationAddresses.create.mockResolvedValue(
        mockRegisteredAddress,
      );

      const dto = {
        addressType: sms_organizationAddresses_addressType.registered,
        addressLine1: '123 Main Street',
        addressLine2: 'Suite 400',
        landmark: 'Near City Park',
        city: 'Metropolis',
        state: 'NY',
        postalCode: '10001',
        country: 'USA',
        latitude: 40.7128,
        longitude: -74.006,
      };

      const res = await service.createAddress('org-uuid-1', dto);

      expect(res).toBeDefined();
      expect(res.id).toBe('address-uuid-registered');
      expect(res.resolvedCity).toBe('Metropolis');
    });

    it('should throw BadRequestException if registered address sets sameAsRegistered = true', async () => {
      const dto = {
        addressType: sms_organizationAddresses_addressType.registered,
        sameAsRegistered: true,
      };

      await expect(
        service.createAddress('org-uuid-1', dto as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if latitude is provided without longitude', async () => {
      const dto = {
        addressType: sms_organizationAddresses_addressType.registered,
        addressLine1: '123 Main Street',
        city: 'Metropolis',
        state: 'NY',
        postalCode: '10001',
        country: 'USA',
        latitude: 40.7128,
      };

      await expect(
        service.createAddress('org-uuid-1', dto as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow billing address with sameAsRegistered = true when registered address exists', async () => {
      prismaService.sms_organizationAddresses.findFirst.mockResolvedValue(
        mockRegisteredAddress,
      );
      prismaService.sms_organizationAddresses.create.mockResolvedValue(
        mockBillingAddressSameAsRegistered,
      );

      const dto = {
        addressType: sms_organizationAddresses_addressType.billing,
        sameAsRegistered: true,
      };

      const res = await service.createAddress('org-uuid-1', dto);

      expect(res).toBeDefined();
      expect(res.resolvedAddressLine1).toBe('123 Main Street');
      expect(res.resolvedCity).toBe('Metropolis');
    });
  });

  describe('getAddresses', () => {
    it('should return list of tenant addresses and resolve sameAsRegistered details', async () => {
      prismaService.sms_organizationAddresses.findMany.mockResolvedValue([
        mockRegisteredAddress,
        mockBillingAddressSameAsRegistered,
      ]);

      const result = await service.getAddresses('org-uuid-1');

      expect(result).toHaveLength(2);
      expect(result[1].resolvedAddressLine1).toBe('123 Main Street');
    });
  });

  describe('deleteAddress', () => {
    it('should soft-delete billing address', async () => {
      prismaService.sms_organizationAddresses.findFirst.mockResolvedValue(
        mockBillingAddressSameAsRegistered,
      );
      prismaService.sms_organizationAddresses.update.mockResolvedValue({
        ...mockBillingAddressSameAsRegistered,
        deletedAt: new Date(),
      });

      const res = await service.deleteAddress(
        'org-uuid-1',
        'address-uuid-billing',
      );

      expect(res.deletedAt).toBeDefined();
    });

    it('should throw BadRequestException when trying to delete the only active registered address', async () => {
      prismaService.sms_organizationAddresses.findFirst.mockResolvedValue(
        mockRegisteredAddress,
      );
      prismaService.sms_organizationAddresses.count.mockResolvedValue(1);

      await expect(
        service.deleteAddress('org-uuid-1', 'address-uuid-registered'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateRegisteredAddressRequirement', () => {
    it('should return isValid = true if active registered address has all required fields', async () => {
      prismaService.sms_organizationAddresses.findFirst.mockResolvedValue(
        mockRegisteredAddress,
      );

      const res =
        await service.validateRegisteredAddressRequirement('org-uuid-1');
      expect(res.isValid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('should return isValid = false if no active registered address exists', async () => {
      prismaService.sms_organizationAddresses.findFirst.mockResolvedValue(null);

      const res =
        await service.validateRegisteredAddressRequirement('org-uuid-1');
      expect(res.isValid).toBe(false);
      expect(res.errors).toContain(
        'Organization must have a Registered Address before activation',
      );
    });
  });
});

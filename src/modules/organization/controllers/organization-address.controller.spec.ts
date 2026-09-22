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
import { OrganizationAddressController } from './organization-address.controller';
import { OrganizationAddressService } from '../services/organization-address.service';
import { PrismaService } from '../../../database/prisma.service';
import { Reflector } from '@nestjs/core';
import { sms_organizationAddresses_addressType } from '@prisma/client';

describe('OrganizationAddressController', () => {
  let controller: OrganizationAddressController;
  let service: any;

  const mockUser: any = {
    userId: 'user-uuid-1',
    organizationId: 'org-uuid-1',
    role: 'SUPER_ADMIN',
  };

  const mockAddress = {
    id: 'address-uuid-1',
    organizationId: 'org-uuid-1',
    addressType: sms_organizationAddresses_addressType.registered,
    addressLine1: '123 Main Street',
    city: 'Metropolis',
    state: 'NY',
    postalCode: '10001',
    country: 'USA',
  };

  beforeEach(async () => {
    service = {
      createAddress: jest.fn(),
      getAddresses: jest.fn(),
      getAddressById: jest.fn(),
      updateAddress: jest.fn(),
      deleteAddress: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationAddressController],
      providers: [
        { provide: OrganizationAddressService, useValue: service },
        { provide: PrismaService, useValue: {} },
        Reflector,
      ],
    }).compile();

    controller = module.get<OrganizationAddressController>(
      OrganizationAddressController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createAddress', () => {
    it('should delegate to addressService.createAddress', async () => {
      service.createAddress.mockResolvedValue(mockAddress);
      const dto = {
        addressType: sms_organizationAddresses_addressType.registered,
        addressLine1: '123 Main Street',
        city: 'Metropolis',
        state: 'NY',
        postalCode: '10001',
        country: 'USA',
      };

      const res = await controller.createAddress(dto, mockUser);

      expect(service.createAddress).toHaveBeenCalledWith('org-uuid-1', dto);
      expect(res).toBe(mockAddress);
    });
  });

  describe('getAddresses', () => {
    it('should delegate to addressService.getAddresses and return data', async () => {
      service.getAddresses.mockResolvedValue([mockAddress]);

      const res = await controller.getAddresses(mockUser);

      expect(service.getAddresses).toHaveBeenCalledWith('org-uuid-1');
      expect(res).toEqual([mockAddress]);
    });
  });

  describe('getAddressById', () => {
    it('should delegate to addressService.getAddressById and return data', async () => {
      service.getAddressById.mockResolvedValue(mockAddress);

      const res = await controller.getAddressById('address-uuid-1', mockUser);

      expect(service.getAddressById).toHaveBeenCalledWith(
        'org-uuid-1',
        'address-uuid-1',
      );
      expect(res).toBe(mockAddress);
    });
  });

  describe('updateAddress', () => {
    it('should delegate to addressService.updateAddress and return updated data', async () => {
      service.updateAddress.mockResolvedValue(mockAddress);
      const dto = { addressLine1: '456 Updated St' };

      const res = await controller.updateAddress(
        'address-uuid-1',
        dto,
        mockUser,
      );

      expect(service.updateAddress).toHaveBeenCalledWith(
        'org-uuid-1',
        'address-uuid-1',
        dto,
      );
      expect(res).toBe(mockAddress);
    });
  });

  describe('deleteAddress', () => {
    it('should delegate to addressService.deleteAddress', async () => {
      service.deleteAddress.mockResolvedValue(mockAddress);

      const res = await controller.deleteAddress('address-uuid-1', mockUser);

      expect(service.deleteAddress).toHaveBeenCalledWith(
        'org-uuid-1',
        'address-uuid-1',
      );
      expect(res).toBe(mockAddress);
    });
  });
});

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
import { OrganizationContactController } from './organization-contact.controller';
import { OrganizationContactService } from '../services/organization-contact.service';
import { PrismaService } from '../../../database/prisma.service';
import { Reflector } from '@nestjs/core';

describe('OrganizationContactController', () => {
  let controller: OrganizationContactController;
  let contactService: any;

  const mockUser = {
    id: 'user-uuid-1',
    email: 'admin@salon.com',
    displayName: 'Super Admin',
    organizationId: 'org-uuid-1',
    status: 'active',
  };

  const mockContact = {
    id: 'contact-uuid-1',
    organizationId: 'org-uuid-1',
    contactType: 'primary',
    email: 'support@salon.com',
    phoneCountryCode: '+91',
    phoneNumber: '9876543210',
    isDefaultPublic: true,
  };

  beforeEach(async () => {
    contactService = {
      createContact: jest.fn().mockResolvedValue(mockContact),
      getContacts: jest.fn().mockResolvedValue([mockContact]),
      getContactById: jest.fn().mockResolvedValue(mockContact),
      updateContact: jest
        .fn()
        .mockResolvedValue({ ...mockContact, contactName: 'Updated Name' }),
      setDefaultPublicContact: jest
        .fn()
        .mockResolvedValue({ ...mockContact, isDefaultPublic: true }),
      deleteContact: jest
        .fn()
        .mockResolvedValue({ ...mockContact, deletedAt: new Date() }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationContactController],
      providers: [
        { provide: OrganizationContactService, useValue: contactService },
        { provide: PrismaService, useValue: {} },
        Reflector,
      ],
    }).compile();

    controller = module.get<OrganizationContactController>(
      OrganizationContactController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createContact', () => {
    it('should create contact and return result directly', async () => {
      const dto = {
        contactType: 'primary' as any,
        email: 'support@salon.com',
      };

      const res = await controller.createContact(dto, mockUser);

      expect(res).toEqual(mockContact);
      expect(contactService.createContact).toHaveBeenCalledWith(
        'org-uuid-1',
        dto,
      );
    });
  });

  describe('getContacts', () => {
    it('should list all active organization contacts', async () => {
      const res = await controller.getContacts(mockUser);

      expect(res).toEqual([mockContact]);
      expect(contactService.getContacts).toHaveBeenCalledWith('org-uuid-1');
    });
  });

  describe('setDefaultPublicContact', () => {
    it('should set default public contact', async () => {
      const res = await controller.setDefaultPublicContact(
        'contact-uuid-1',
        mockUser,
      );

      expect(res.isDefaultPublic).toBe(true);
      expect(contactService.setDefaultPublicContact).toHaveBeenCalledWith(
        'org-uuid-1',
        'contact-uuid-1',
      );
    });
  });

  describe('deleteContact', () => {
    it('should soft-delete contact', async () => {
      const res = await controller.deleteContact('contact-uuid-1', mockUser);

      expect(res.deletedAt).toBeDefined();
      expect(contactService.deleteContact).toHaveBeenCalledWith(
        'org-uuid-1',
        'contact-uuid-1',
      );
    });
  });
});

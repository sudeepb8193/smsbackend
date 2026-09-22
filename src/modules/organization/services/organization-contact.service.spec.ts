import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationContactService } from './organization-contact.service';
import { PrismaService } from '../../../database/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { sms_organizationContacts_contactType } from '@prisma/client';

describe('OrganizationContactService', () => {
  let service: OrganizationContactService;
  let prismaService: any;

  const mockPrimaryContact = {
    id: 'contact-uuid-primary',
    organizationId: 'org-uuid-1',
    contactType: sms_organizationContacts_contactType.primary,
    contactName: 'Main Reception',
    email: 'primary@salon.com',
    emailVerified: false,
    phoneCountryCode: '+91',
    phoneNumber: '9876543210',
    isDefaultPublic: true,
    sameAsPrimary: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockSupportContact = {
    id: 'contact-uuid-support',
    organizationId: 'org-uuid-1',
    contactType: sms_organizationContacts_contactType.support,
    contactName: 'Help Desk',
    email: null,
    emailVerified: false,
    phoneCountryCode: null,
    phoneNumber: null,
    isDefaultPublic: false,
    sameAsPrimary: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    prismaService = {
      sms_organizationContacts: {
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
        OrganizationContactService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<OrganizationContactService>(
      OrganizationContactService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createContact', () => {
    it('should create a primary contact when valid email and phone are provided', async () => {
      prismaService.sms_organizationContacts.create.mockResolvedValue(
        mockPrimaryContact,
      );

      const dto = {
        contactType: sms_organizationContacts_contactType.primary,
        contactName: 'Main Reception',
        email: 'primary@salon.com',
        phoneCountryCode: '+91',
        phoneNumber: '9876543210',
        isDefaultPublic: true,
      };

      const res = await service.createContact('org-uuid-1', dto);

      expect(res).toBeDefined();
      expect(res.id).toBe('contact-uuid-primary');
      expect(res.emailVerified).toBe(false);
    });

    it('should throw BadRequestException if primary contact tries to set sameAsPrimary = true', async () => {
      const dto = {
        contactType: sms_organizationContacts_contactType.primary,
        sameAsPrimary: true,
      };

      await expect(service.createContact('org-uuid-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if contact provides neither email nor phone number', async () => {
      const dto = {
        contactType: sms_organizationContacts_contactType.support,
        contactName: 'Help Desk',
        sameAsPrimary: false,
      };

      await expect(service.createContact('org-uuid-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow support contact with sameAsPrimary = true when primary contact exists', async () => {
      prismaService.sms_organizationContacts.findFirst.mockResolvedValue(
        mockPrimaryContact,
      );
      prismaService.sms_organizationContacts.create.mockResolvedValue(
        mockSupportContact,
      );

      const dto = {
        contactType: sms_organizationContacts_contactType.support,
        sameAsPrimary: true,
      };

      const res = await service.createContact('org-uuid-1', dto);

      expect(res).toBeDefined();
      expect(res.resolvedEmail).toBe('primary@salon.com');
    });
  });

  describe('getContacts', () => {
    it('should return list of tenant contacts and resolve sameAsPrimary details', async () => {
      prismaService.sms_organizationContacts.findMany.mockResolvedValue([
        mockPrimaryContact,
        mockSupportContact,
      ]);

      const result = await service.getContacts('org-uuid-1');

      expect(result).toHaveLength(2);
      expect(result[1].resolvedEmail).toBe('primary@salon.com');
    });
  });

  describe('setDefaultPublicContact', () => {
    it('should unset existing default public contacts and set target contact atomically', async () => {
      prismaService.sms_organizationContacts.findFirst.mockResolvedValue(
        mockSupportContact,
      );
      prismaService.sms_organizationContacts.updateMany.mockResolvedValue({
        count: 1,
      });
      prismaService.sms_organizationContacts.update.mockResolvedValue({
        ...mockSupportContact,
        isDefaultPublic: true,
      });

      const res = await service.setDefaultPublicContact(
        'org-uuid-1',
        'contact-uuid-support',
      );

      expect(res.isDefaultPublic).toBe(true);
      expect(
        prismaService.sms_organizationContacts.updateMany,
      ).toHaveBeenCalledWith({
        where: { organizationId: 'org-uuid-1', deletedAt: null },
        data: { isDefaultPublic: false },
      });
    });
  });

  describe('deleteContact', () => {
    it('should soft-delete support contact', async () => {
      prismaService.sms_organizationContacts.findFirst.mockResolvedValue(
        mockSupportContact,
      );
      prismaService.sms_organizationContacts.update.mockResolvedValue({
        ...mockSupportContact,
        deletedAt: new Date(),
      });

      const res = await service.deleteContact(
        'org-uuid-1',
        'contact-uuid-support',
      );

      expect(res.deletedAt).toBeDefined();
    });

    it('should throw BadRequestException when trying to delete the only active primary contact', async () => {
      prismaService.sms_organizationContacts.findFirst.mockResolvedValue(
        mockPrimaryContact,
      );
      prismaService.sms_organizationContacts.count.mockResolvedValue(1);

      await expect(
        service.deleteContact('org-uuid-1', 'contact-uuid-primary'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

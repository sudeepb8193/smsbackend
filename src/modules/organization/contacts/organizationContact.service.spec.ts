import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationContactService } from './organizationContact.service';
import { PrismaService } from '../../../database/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ContactType } from '../organization.types';

describe('OrganizationContactService (Task 1.2)', () => {
  let service: OrganizationContactService;
  let prisma: any;

  const mockPrisma = {
    smsOrganizationContact: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationContactService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<OrganizationContactService>(OrganizationContactService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('contact creation', () => {
    it('should create a contact successfully', async () => {
      mockPrisma.smsOrganizationContact.create.mockResolvedValue({
        id: 1,
        organizationId: 10,
        contactType: 'primary',
        fullName: 'Jane Doe',
        email: 'jane@salon.com',
      });

      const res = await service.createContact(10, {
        contactType: ContactType.PRIMARY,
        fullName: 'Jane Doe',
        email: 'jane@salon.com',
      });

      expect(res.fullName).toBe('Jane Doe');
      expect(mockPrisma.smsOrganizationContact.create).toHaveBeenCalled();
    });

    it('should support sameAsPrimary by inheriting primary contact details', async () => {
      mockPrisma.smsOrganizationContact.findFirst.mockResolvedValue({
        id: 1,
        fullName: 'Primary Manager',
        designation: 'Owner',
        phoneCountryCode: '+1',
        phoneNumber: '5551234567',
        email: 'primary@salon.com',
      });

      mockPrisma.smsOrganizationContact.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 2, ...data }),
      );

      const res = await service.createContact(10, {
        contactType: ContactType.SUPPORT,
        sameAsPrimary: true,
      });

      expect(res.fullName).toBe('Primary Manager');
      expect(res.email).toBe('primary@salon.com');
    });

    it('should throw BadRequestException if sameAsPrimary requested but no primary exists', async () => {
      mockPrisma.smsOrganizationContact.findFirst.mockResolvedValue(null);

      await expect(
        service.createContact(10, {
          contactType: ContactType.SUPPORT,
          sameAsPrimary: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('verification workflow', () => {
    it('should generate a hashed token and expiration on requestVerification', async () => {
      mockPrisma.smsOrganizationContact.findUnique.mockResolvedValue({
        id: 1,
        email: 'jane@salon.com',
      });
      mockPrisma.smsOrganizationContact.update.mockResolvedValue({});

      const res = await service.requestVerification(1, 'email');
      expect(res.token).toBeDefined();
      expect(res.expiresAt).toBeInstanceOf(Date);
      expect(mockPrisma.smsOrganizationContact.update).toHaveBeenCalled();
    });

    it('should verify email successfully with valid token', async () => {
      const rawToken = 'sampletoken123';
      const crypto = require('crypto');
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

      mockPrisma.smsOrganizationContact.findUnique.mockResolvedValue({
        id: 1,
        email: 'jane@salon.com',
        verificationToken: hashedToken,
        verificationExpiresAt: new Date(Date.now() + 100000),
      });
      mockPrisma.smsOrganizationContact.update.mockResolvedValue({
        id: 1,
        emailVerifiedAt: new Date(),
      });

      const res = await service.verifyContact(1, 'email', rawToken);
      expect(res.emailVerifiedAt).toBeDefined();
    });
  });

  describe('contact deletion', () => {
    it('should block deleting the final primary contact', async () => {
      mockPrisma.smsOrganizationContact.findUnique.mockResolvedValue({
        id: 1,
        organizationId: 10,
        contactType: 'primary',
      });
      mockPrisma.smsOrganizationContact.count.mockResolvedValue(1);

      await expect(service.deleteContact(1)).rejects.toThrow(BadRequestException);
    });
  });
});

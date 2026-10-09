import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { OrganizationContactVerificationService } from './organization-contact-verification.service';

describe('OrganizationContactVerificationService', () => {
  let service: OrganizationContactVerificationService;
  let prisma: {
    sms_organizationContacts: {
      findFirst: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let transaction: {
    sms_organizationContacts: {
      findFirst: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    transaction = {
      sms_organizationContacts: {
        findFirst: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    prisma = {
      sms_organizationContacts: {
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(transaction)),
    };
    const module = await Test.createTestingModule({
      providers: [
        OrganizationContactVerificationService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();
    service = module.get(OrganizationContactVerificationService);
  });

  it('clears a one-time token when SMTP is not configured', async () => {
    prisma.sms_organizationContacts.findFirst.mockResolvedValue({
      id: 'contact-id',
      email: 'contact@example.com',
      contactName: 'Contact',
      emailVerified: false,
    });

    await expect(
      service.sendVerification('organization-id', 'contact-id'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(prisma.sms_organizationContacts.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          emailVerificationTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }),
    );
    expect(prisma.sms_organizationContacts.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          emailVerificationTokenHash: null,
          emailVerificationExpiresAt: null,
        },
      }),
    );
  });

  it('marks a valid token verified and consumes it', async () => {
    transaction.sms_organizationContacts.findFirst.mockResolvedValue({
      id: 'contact-id',
    });
    transaction.sms_organizationContacts.updateMany.mockResolvedValue({
      count: 1,
    });

    await expect(service.verify('a'.repeat(64))).resolves.toEqual({
      message: 'Contact email verified successfully.',
    });
    expect(
      transaction.sms_organizationContacts.updateMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          emailVerified: true,
          emailVerificationTokenHash: null,
          emailVerificationExpiresAt: null,
        },
      }),
    );
  });

  it('rejects invalid and expired verification tokens', async () => {
    await expect(service.verify('invalid-token')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    transaction.sms_organizationContacts.findFirst.mockResolvedValue(null);
    await expect(service.verify('b'.repeat(64))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

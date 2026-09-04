import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { Role } from '@prisma/client';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: any;

  const mockUserStore: any[] = [];
  let userAutoIncrement = 1;

  beforeEach(async () => {
    mockUserStore.length = 0;
    userAutoIncrement = 1;

    const mockPrismaService = {
      user: {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          return mockUserStore.find((u) => {
            if (where.organizationId && u.organizationId !== where.organizationId) {
              return false;
            }
            if (where.id && u.id !== where.id) {
              return false;
            }
            if (where.inviteToken && u.inviteToken !== where.inviteToken) {
              return false;
            }
            if (where.email?.equals) {
              if (!u.email || u.email.toLowerCase() !== where.email.equals.toLowerCase()) {
                return false;
              }
            }
            if (where.phoneNumber && u.phoneNumber !== where.phoneNumber) {
              return false;
            }
            return true;
          }) || null;
        }),
        create: jest.fn().mockImplementation(({ data }) => {
          const newUser = {
            id: userAutoIncrement++,
            uuid: `uuid-${userAutoIncrement}`,
            organizationId: data.organizationId,
            displayName: data.displayName,
            email: data.email || null,
            phoneCountryCode: data.phoneCountryCode || null,
            phoneNumber: data.phoneNumber || null,
            passwordHash: data.passwordHash || null,
            inviteToken: data.inviteToken || null,
            inviteExpiresAt: data.inviteExpiresAt || null,
            inviteAcceptedAt: data.inviteAcceptedAt || null,
            role: data.role || Role.FRONT_DESK,
            createdBy: data.createdBy || null,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
            userBranches: [],
          };
          mockUserStore.push(newUser);
          return newUser;
        }),
        findMany: jest.fn().mockImplementation(({ where }) => {
          return mockUserStore.filter((u) => u.organizationId === where.organizationId);
        }),
        count: jest.fn().mockImplementation(({ where }) => {
          return mockUserStore.filter((u) => u.organizationId === where.organizationId).length;
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const u = mockUserStore.find((item) => item.id === where.id);
          if (!u) throw new Error('Not found');
          Object.assign(u, data);
          u.updatedAt = new Date();
          return u;
        }),
      },
      userBranch: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const mockAuditService = {
      logEvent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('User Creation & Identifier Validation', () => {
    const adminCtx = { id: 1, organizationId: 100, role: Role.SUPER_ADMIN };

    it('should create user with email only', async () => {
      const result = await service.createUser(
        { displayName: 'Alice', email: 'alice@example.com', role: Role.FRONT_DESK },
        adminCtx,
      );

      expect(result.displayName).toBe('Alice');
      expect(result.email).toBe('alice@example.com');
      expect(result.status).toBe('pending');
      expect(result.invitationUrl).toBeDefined();
    });

    it('should create user with phone only', async () => {
      const result = await service.createUser(
        {
          displayName: 'Bob',
          phoneCountryCode: '+91',
          phoneNumber: '9876543210',
          role: Role.SERVICE_STAFF,
        },
        adminCtx,
      );

      expect(result.displayName).toBe('Bob');
      expect(result.phoneNumber).toBe('9876543210');
      expect(result.status).toBe('pending');
    });

    it('should create user with email and phone', async () => {
      const result = await service.createUser(
        {
          displayName: 'Charlie',
          email: 'charlie@example.com',
          phoneCountryCode: '+91',
          phoneNumber: '9999999999',
          role: Role.FRONT_DESK,
        },
        adminCtx,
      );

      expect(result.email).toBe('charlie@example.com');
      expect(result.phoneNumber).toBe('9999999999');
    });

    it('should reject creation without email and phone', async () => {
      await expect(
        service.createUser({ displayName: 'NoIdentifier', role: Role.FRONT_DESK }, adminCtx),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Duplicate Email & Phone Protections', () => {
    const org1Ctx = { id: 1, organizationId: 100, role: Role.SUPER_ADMIN };
    const org2Ctx = { id: 2, organizationId: 200, role: Role.SUPER_ADMIN };

    beforeEach(async () => {
      await service.createUser(
        { displayName: 'User 1', email: 'unique@example.com', phoneNumber: '9876543210', role: Role.FRONT_DESK },
        org1Ctx,
      );
    });

    it('should block duplicate email in same organization', async () => {
      await expect(
        service.createUser(
          { displayName: 'User 2', email: 'UNIQUE@example.com', role: Role.FRONT_DESK },
          org1Ctx,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should block duplicate phone in same organization', async () => {
      await expect(
        service.createUser(
          { displayName: 'User 3', phoneNumber: '9876543210', role: Role.FRONT_DESK },
          org1Ctx,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow same email in different organization', async () => {
      const result = await service.createUser(
        { displayName: 'Cross Tenant User', email: 'unique@example.com', role: Role.FRONT_DESK },
        org2Ctx,
      );
      expect(result.email).toBe('unique@example.com');
    });

    it('should allow same phone in different organization', async () => {
      const result = await service.createUser(
        { displayName: 'Cross Tenant User Phone', phoneNumber: '9876543210', role: Role.FRONT_DESK },
        org2Ctx,
      );
      expect(result.phoneNumber).toBe('9876543210');
    });
  });

  describe('Branch Manager Restrictions', () => {
    const branchMgrCtx = { id: 10, organizationId: 100, role: Role.BRANCH_MANAGER };

    it('should allow Branch Manager to create Front Desk user', async () => {
      const result = await service.createUser(
        { displayName: 'Staff 1', email: 'staff1@example.com', role: Role.FRONT_DESK },
        branchMgrCtx,
      );
      expect(result.role).toBe(Role.FRONT_DESK);
    });

    it('should allow Branch Manager to create Service Staff user', async () => {
      const result = await service.createUser(
        { displayName: 'Staff 2', email: 'staff2@example.com', role: Role.SERVICE_STAFF },
        branchMgrCtx,
      );
      expect(result.role).toBe(Role.SERVICE_STAFF);
    });

    it('should reject Branch Manager creating Super Admin', async () => {
      await expect(
        service.createUser(
          { displayName: 'Elevated Admin', email: 'hacker@example.com', role: Role.SUPER_ADMIN },
          branchMgrCtx,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject Branch Manager creating another Branch Manager', async () => {
      await expect(
        service.createUser(
          { displayName: 'New Manager', email: 'mgr2@example.com', role: Role.BRANCH_MANAGER },
          branchMgrCtx,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Invitation Acceptance & Security', () => {
    const adminCtx = { id: 1, organizationId: 100, role: Role.SUPER_ADMIN };

    it('should accept valid invitation and set password', async () => {
      const created = await service.createUser(
        { displayName: 'Invited User', email: 'invited@example.com', role: Role.FRONT_DESK },
        adminCtx,
      );

      const token = mockUserStore[0].inviteToken;

      const acceptRes = await service.acceptInvitation({
        token,
        password: 'SecurePassword123!',
      });

      expect(acceptRes.message).toContain('successfully');
      expect(mockUserStore[0].inviteAcceptedAt).toBeDefined();
      expect(mockUserStore[0].inviteToken).toBeNull();
      expect(mockUserStore[0].passwordHash).toBeDefined();
    });

    it('should reject token reuse after acceptance', async () => {
      const created = await service.createUser(
        { displayName: 'Invited User', email: 'invited2@example.com', role: Role.FRONT_DESK },
        adminCtx,
      );

      const token = mockUserStore[0].inviteToken;

      await service.acceptInvitation({ token, password: 'SecurePassword123!' });

      await expect(
        service.acceptInvitation({ token, password: 'AnotherPassword123!' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject expired invitation', async () => {
      await service.createUser(
        { displayName: 'Expired User', email: 'expired@example.com', role: Role.FRONT_DESK },
        adminCtx,
      );

      // Artificially expire token
      mockUserStore[0].inviteExpiresAt = new Date(Date.now() - 10000);
      const token = mockUserStore[0].inviteToken;

      await expect(
        service.acceptInvitation({ token, password: 'SecurePassword123!' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should resend invitation with new token', async () => {
      const created = await service.createUser(
        { displayName: 'Resend User', email: 'resend@example.com', role: Role.FRONT_DESK },
        adminCtx,
      );

      const oldToken = mockUserStore[0].inviteToken;

      const resendResult = await service.resendInvitation(created.id, adminCtx);

      expect(resendResult.invitationUrl).toBeDefined();
      expect(mockUserStore[0].inviteToken).not.toBe(oldToken);
    });
  });

  describe('Deactivation & Soft Delete Safety', () => {
    const adminCtx = { id: 99, organizationId: 100, role: Role.SUPER_ADMIN };

    it('should deactivate user and set deletedAt', async () => {
      const created = await service.createUser(
        { displayName: 'Deactivate Target', email: 'target@example.com', role: Role.FRONT_DESK },
        adminCtx,
      );

      const deactivated = await service.deactivateUser(created.id, adminCtx);

      expect(deactivated.status).toBe('deactivated');
      expect(mockUserStore[0].deletedAt).toBeDefined();
    });

    it('should block user from deactivating their own account', async () => {
      const selfCtx = { id: 1, organizationId: 100, role: Role.SUPER_ADMIN };
      const created = await service.createUser(
        { displayName: 'Self User', email: 'self@example.com', role: Role.SUPER_ADMIN },
        selfCtx,
      );

      await expect(
        service.deactivateUser(created.id, { id: created.id, organizationId: 100 }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

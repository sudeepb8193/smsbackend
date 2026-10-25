import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from '../../../database/prisma.service';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('UserService', () => {
  let service: UserService;
  let prisma: any;

  const mockActor: any = {
    id: 'admin-uuid-1',
    organizationId: 'org-uuid-1',
    displayName: 'Admin User',
    email: 'admin@salon.com',
    status: 'active',
  };

  const mockBranchManagerActor: any = {
    id: 'bm-uuid-1',
    organizationId: 'org-uuid-1',
    displayName: 'Branch Manager',
    email: 'bm@salon.com',
    status: 'active',
  };

  const mockActiveRole = {
    id: 'role-uuid-1',
    name: 'Front Desk',
    slug: 'front-desk',
    status: 'active',
    organizationId: 'org-uuid-1',
  };

  const mockOwnerRole = {
    id: 'role-owner-uuid',
    name: 'Owner',
    slug: 'owner',
    status: 'active',
    organizationId: 'org-uuid-1',
  };

  const mockBranch = {
    id: 'branch-uuid-1',
    organizationId: 'org-uuid-1',
    name: 'Downtown Salon',
    code: 'DT-01',
    status: 'active',
  };

  beforeEach(async () => {
    prisma = {
      sms_users: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      sms_roles: {
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      sms_branches: {
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      sms_userRoles: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      sms_userBranchAssignments: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
      sms_userStatusLogs: {
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      sms_auditLogs: {
        count: jest.fn().mockResolvedValue(0),
      },
      sms_staff: {
        count: jest.fn().mockResolvedValue(0),
      },
      sms_services: {
        count: jest.fn().mockResolvedValue(0),
      },
      sms_customers: {
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  describe('inviteUser', () => {
    it('should throw BadRequestException if neither email nor phone is provided', async () => {
      await expect(
        service.inviteUser('org-uuid-1', mockActor, {
          displayName: 'John Doe',
          roleId: 'role-uuid-1',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if duplicate email exists in same organization', async () => {
      prisma.sms_users.findFirst.mockResolvedValueOnce({
        id: 'existing-user-uuid',
        email: 'john@salon.com',
      });

      await expect(
        service.inviteUser('org-uuid-1', mockActor, {
          displayName: 'John Doe',
          email: 'john@salon.com',
          roleId: 'role-uuid-1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if duplicate phone exists in same organization', async () => {
      prisma.sms_users.findFirst.mockResolvedValueOnce({
        id: 'existing-phone-uuid',
        phoneNumber: '9876543210',
      });

      await expect(
        service.inviteUser('org-uuid-1', mockActor, {
          displayName: 'Jane Doe',
          phoneNumber: '9876543210',
          roleId: 'role-uuid-1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if role does not exist in organization', async () => {
      prisma.sms_users.findFirst.mockResolvedValue(null);
      prisma.sms_roles.findFirst.mockResolvedValue(null);

      await expect(
        service.inviteUser('org-uuid-1', mockActor, {
          displayName: 'John Doe',
          email: 'new@salon.com',
          roleId: 'non-existent-role',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if role is inactive', async () => {
      prisma.sms_users.findFirst.mockResolvedValue(null);
      prisma.sms_roles.findFirst.mockResolvedValue({
        id: 'inactive-role',
        name: 'Old Role',
        status: 'inactive',
      });

      await expect(
        service.inviteUser('org-uuid-1', mockActor, {
          displayName: 'John Doe',
          email: 'new@salon.com',
          roleId: 'inactive-role',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should block privilege escalation if Branch Manager attempts to assign Owner role', async () => {
      prisma.sms_users.findFirst.mockResolvedValue(null);
      prisma.sms_roles.findFirst.mockResolvedValue(mockOwnerRole);
      prisma.sms_userRoles.findMany.mockResolvedValue([
        { role: { name: 'Branch Manager', slug: 'branch-manager' } },
      ]);

      await expect(
        service.inviteUser('org-uuid-1', mockBranchManagerActor, {
          displayName: 'Sub Admin',
          email: 'sub@salon.com',
          roleId: 'role-owner-uuid',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if assigned branch does not exist in organization', async () => {
      prisma.sms_users.findFirst.mockResolvedValue(null);
      prisma.sms_roles.findFirst.mockResolvedValue(mockActiveRole);
      prisma.sms_userRoles.findMany.mockResolvedValue([
        { role: { name: 'Owner', slug: 'owner' } },
      ]);
      prisma.sms_branches.findFirst.mockResolvedValue(null);

      await expect(
        service.inviteUser('org-uuid-1', mockActor, {
          displayName: 'John Doe',
          email: 'john@salon.com',
          roleId: 'role-uuid-1',
          branchId: 'invalid-branch',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should successfully invite user and return single-use inviteToken with 7-day expiry', async () => {
      prisma.sms_users.findFirst.mockResolvedValue(null);
      prisma.sms_roles.findFirst.mockResolvedValue(mockActiveRole);
      prisma.sms_userRoles.findMany.mockResolvedValue([
        { role: { name: 'Owner', slug: 'owner' } },
      ]);
      prisma.sms_branches.findFirst.mockResolvedValue(mockBranch);

      const createdUserMock = {
        id: 'new-user-123',
        displayName: 'John Doe',
        email: 'john@salon.com',
        phoneCountryCode: '+91',
        phoneNumber: '9876543210',
        status: 'pending_invite',
        inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };
      prisma.sms_users.create.mockResolvedValue(createdUserMock);

      const res = await service.inviteUser('org-uuid-1', mockActor, {
        displayName: 'John Doe',
        email: 'john@salon.com',
        phoneNumber: '9876543210',
        phoneCountryCode: '+91',
        roleId: 'role-uuid-1',
        branchId: 'branch-uuid-1',
      });

      expect(res.id).toBe('new-user-123');
      expect(res.status).toBe('pending_invite');
      expect(res.inviteToken).toBeDefined();
      expect(res.inviteToken.length).toBe(64); // 32 bytes hex
      expect(res.inviteUrl).toContain('/accept-invite?token=');
      expect(prisma.sms_userRoles.create).toHaveBeenCalled();
      expect(prisma.sms_userBranchAssignments.create).toHaveBeenCalled();
      expect(prisma.sms_userStatusLogs.create).toHaveBeenCalled();
    });
  });

  describe('resendInvite', () => {
    it('should throw NotFoundException if user does not exist in organization', async () => {
      prisma.sms_users.findFirst.mockResolvedValue(null);

      await expect(
        service.resendInvite('unknown-id', 'org-uuid-1', mockActor),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if user is already active', async () => {
      prisma.sms_users.findFirst.mockResolvedValue({
        id: 'user-active-1',
        status: 'active',
      });

      await expect(
        service.resendInvite('user-active-1', 'org-uuid-1', mockActor),
      ).rejects.toThrow(BadRequestException);
    });

    it('should regenerate single-use token and renew 7-day expiry', async () => {
      prisma.sms_users.findFirst.mockResolvedValue({
        id: 'user-pending-1',
        status: 'pending_invite',
        displayName: 'Bob Stylist',
        email: 'bob@salon.com',
      });
      prisma.sms_users.update.mockResolvedValue({ id: 'user-pending-1' });

      const res = await service.resendInvite('user-pending-1', 'org-uuid-1', mockActor);

      expect(res.success).toBe(true);
      expect(res.inviteToken).toBeDefined();
      expect(res.inviteToken.length).toBe(64);
      expect(prisma.sms_users.update).toHaveBeenCalled();
    });
  });

  describe('verifyInviteToken', () => {
    it('should throw NotFoundException for non-existent or accepted token', async () => {
      prisma.sms_users.findFirst.mockResolvedValue(null);

      await expect(service.verifyInviteToken('invalid-token')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return expired: true if token is past 7 days', async () => {
      const pastDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
      prisma.sms_users.findFirst.mockResolvedValue({
        id: 'user-expired',
        inviteExpiresAt: pastDate,
        inviteAcceptedAt: null,
      });

      const res = await service.verifyInviteToken('expired-token');
      expect(res.valid).toBe(false);
      expect(res.expired).toBe(true);
    });

    it('should return valid: true with organization and user info if token is valid', async () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 5);
      prisma.sms_users.findFirst.mockResolvedValue({
        id: 'user-valid',
        displayName: 'Alice Hair',
        email: 'alice@salon.com',
        phoneNumber: null,
        inviteExpiresAt: futureDate,
        inviteAcceptedAt: null,
        organization: { name: 'Glow Salon', slug: 'glow-salon' },
      });

      const res = await service.verifyInviteToken('valid-token');
      expect(res.valid).toBe(true);
      expect(res.expired).toBe(false);
      expect(res.user.displayName).toBe('Alice Hair');
      expect(res.user.organization.name).toBe('Glow Salon');
    });
  });

  describe('acceptInvite', () => {
    it('should throw BadRequestException if token is invalid or consumed', async () => {
      prisma.sms_users.findFirst.mockResolvedValue(null);

      await expect(
        service.acceptInvite({
          token: 'consumed-token',
          password: 'Password123!',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if token is expired', async () => {
      prisma.sms_users.findFirst.mockResolvedValue({
        id: 'u-1',
        inviteExpiresAt: new Date(Date.now() - 10000),
        inviteAcceptedAt: null,
      });

      await expect(
        service.acceptInvite({
          token: 'expired-token',
          password: 'Password123!',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should hash password, update user status to active, clear single-use token, and log status transition', async () => {
      const userMock = {
        id: 'u-1',
        status: 'pending_invite',
        inviteExpiresAt: new Date(Date.now() + 100000),
        inviteAcceptedAt: null,
      };
      prisma.sms_users.findFirst.mockResolvedValue(userMock);
      prisma.sms_users.update.mockResolvedValue({ id: 'u-1', status: 'active' });

      const res = await service.acceptInvite({
        token: 'valid-token',
        password: 'Password123!',
      });

      expect(res.success).toBe(true);
      expect(res.userId).toBe('u-1');
      expect(prisma.sms_users.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u-1' },
          data: expect.objectContaining({
            status: 'active',
            inviteToken: null,
          }),
        }),
      );
      expect(prisma.sms_userStatusLogs.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'u-1',
            fromStatus: 'pending_invite',
            toStatus: 'active',
          }),
        }),
      );
    });
  });

  describe('deleteUser', () => {
    it('should throw BadRequestException when attempting self-deletion', async () => {
      prisma.sms_users.findFirst.mockResolvedValue({
        id: mockActor.id,
        userRolesAssignedToMe: [],
      });

      await expect(
        service.deleteUser(mockActor.id, 'org-uuid-1', mockActor),
      ).rejects.toThrow(BadRequestException);
    });

    it('should block deletion of the last remaining active Owner', async () => {
      prisma.sms_users.findFirst.mockResolvedValue({
        id: 'target-owner-id',
        userRolesAssignedToMe: [{ role: { name: 'Owner', slug: 'owner' } }],
      });
      prisma.sms_userRoles.count.mockResolvedValue(0); // 0 other active owners

      await expect(
        service.deleteUser('target-owner-id', 'org-uuid-1', mockActor),
      ).rejects.toThrow(BadRequestException);
    });

    it('should block deletion if user has historical dependencies attached', async () => {
      prisma.sms_users.findFirst.mockResolvedValue({
        id: 'target-stylist-id',
        userRolesAssignedToMe: [{ role: { name: 'Stylist', slug: 'stylist' } }],
      });
      prisma.sms_auditLogs.count.mockResolvedValue(5); // 5 audit logs performed

      await expect(
        service.deleteUser('target-stylist-id', 'org-uuid-1', mockActor),
      ).rejects.toThrow(ConflictException);
    });

    it('should soft-delete user when no historical blockers exist', async () => {
      prisma.sms_users.findFirst.mockResolvedValue({
        id: 'target-clean-id',
        status: 'pending_invite',
        userRolesAssignedToMe: [{ role: { name: 'Front Desk', slug: 'front-desk' } }],
      });
      // All counts 0
      prisma.sms_auditLogs.count.mockResolvedValue(0);
      prisma.sms_branches.count.mockResolvedValue(0);
      prisma.sms_roles.count.mockResolvedValue(0);
      prisma.sms_userStatusLogs.count.mockResolvedValue(0);
      prisma.sms_staff.count.mockResolvedValue(0);
      prisma.sms_services.count.mockResolvedValue(0);
      prisma.sms_customers.count.mockResolvedValue(0);

      const res = await service.deleteUser('target-clean-id', 'org-uuid-1', mockActor);

      expect(res.success).toBe(true);
      expect(prisma.sms_users.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'target-clean-id' },
          data: expect.objectContaining({
            status: 'deactivated',
            deletedAt: expect.any(Date),
          }),
        }),
      );
      expect(prisma.sms_userRoles.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'target-clean-id', removedAt: null },
          data: expect.objectContaining({
            removedAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('Role-Based Access Control & Branch Scoping', () => {
    it('should throw ForbiddenException if Owner attempts to invite someone with Super Admin role', async () => {
      prisma.sms_users.findFirst.mockResolvedValue(null);
      prisma.sms_roles.findFirst.mockResolvedValue({
        id: 'role-sa',
        slug: 'super-admin',
        name: 'Super Admin',
        status: 'active',
      });
      prisma.sms_userRoles.findMany.mockResolvedValue([
        { id: 'ur-1', userId: mockActor.id, role: { slug: 'owner', name: 'Owner' }, removedAt: null },
      ]);

      await expect(
        service.inviteUser('org-uuid-1', mockActor, {
          displayName: 'New Admin',
          email: 'newadmin@platform.com',
          roleId: 'role-sa',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if Branch Manager attempts to assign an unauthorized branch', async () => {
      prisma.sms_users.findFirst.mockResolvedValue(null);
      prisma.sms_roles.findFirst.mockResolvedValue({
        id: 'role-fd',
        slug: 'front-desk',
        name: 'Front Desk',
        status: 'active',
      });
      prisma.sms_userRoles.findMany.mockResolvedValue([
        { id: 'ur-bm', userId: mockBranchManagerActor.id, role: { slug: 'branch-manager', name: 'Branch Manager' }, removedAt: null },
      ]);
      prisma.sms_branches.findFirst.mockResolvedValue({ id: 'unauthorized-branch', status: 'active' });
      prisma.sms_userBranchAssignments.findFirst.mockResolvedValue(null); // Not assigned to this branch

      await expect(
        service.inviteUser('org-uuid-1', mockBranchManagerActor, {
          displayName: 'New Desk',
          email: 'desk@salon.com',
          roleId: 'role-fd',
          branchId: 'unauthorized-branch',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if Branch Manager attempts to update an Owner account', async () => {
      prisma.sms_users.findFirst.mockResolvedValue({
        id: 'owner-id',
        organizationId: 'org-uuid-1',
        userRolesAssignedToMe: [{ role: { slug: 'owner', name: 'Owner' } }],
        userBranchAssignmentsForMe: [{ branchId: 'branch-uuid-1' }],
      });
      prisma.sms_userRoles.findMany.mockImplementation((args: any) => {
        if (args?.where?.userId === mockBranchManagerActor.id) {
          return Promise.resolve([
            { id: 'ur-bm', userId: mockBranchManagerActor.id, role: { slug: 'branch-manager', name: 'Branch Manager' }, removedAt: null },
          ]);
        }
        return Promise.resolve([]);
      });
      prisma.sms_userBranchAssignments.findMany.mockResolvedValue([{ branchId: 'branch-uuid-1' }]);

      await expect(
        service.updateUser('owner-id', 'org-uuid-1', mockBranchManagerActor, { displayName: 'Hacked Owner' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should scope findAll queries to Branch Manager assigned branches', async () => {
      prisma.sms_userRoles.findMany.mockImplementation((args: any) => {
        if (args?.where?.userId === mockBranchManagerActor.id) {
          return Promise.resolve([
            { id: 'ur-bm', userId: mockBranchManagerActor.id, role: { slug: 'branch-manager', name: 'Branch Manager' }, removedAt: null },
          ]);
        }
        return Promise.resolve([]);
      });
      prisma.sms_userBranchAssignments.findMany.mockResolvedValue([{ branchId: 'branch-101' }]);
      prisma.sms_users.count.mockResolvedValue(1);
      prisma.sms_users.findMany.mockResolvedValue([]);

      await service.findAll('org-uuid-1', {}, mockBranchManagerActor);

      expect(prisma.sms_users.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userBranchAssignmentsForMe: {
              some: {
                branchId: { in: ['branch-101'] },
              },
            },
          }),
        }),
      );
    });
  });

  describe('changeUserStatus', () => {
    const targetUserId = 'target-user-uuid';

    it('should throw NotFoundException if user is not found in organization', async () => {
      prisma.sms_users.findFirst.mockResolvedValue(null);

      await expect(
        service.changeUserStatus(targetUserId, 'org-uuid-1', mockActor, {
          status: 'deactivated',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if actor attempts to deactivate or suspend their own account', async () => {
      prisma.sms_users.findFirst.mockResolvedValue({
        id: mockActor.id,
        organizationId: 'org-uuid-1',
        status: 'active',
        userRolesAssignedToMe: [],
        userBranchAssignmentsForMe: [],
      });

      await expect(
        service.changeUserStatus(mockActor.id, 'org-uuid-1', mockActor, {
          status: 'deactivated',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if Branch Manager tries to deactivate an Owner account', async () => {
      prisma.sms_users.findFirst.mockResolvedValue({
        id: targetUserId,
        organizationId: 'org-uuid-1',
        status: 'active',
        userRolesAssignedToMe: [
          { role: { slug: 'owner', name: 'Owner' } },
        ],
        userBranchAssignmentsForMe: [{ branchId: 'branch-uuid-1' }],
      });
      prisma.sms_userRoles.findMany.mockImplementation((args: any) => {
        if (args?.where?.userId === mockBranchManagerActor.id) {
          return Promise.resolve([
            { id: 'ur-bm', userId: mockBranchManagerActor.id, role: { slug: 'branch-manager', name: 'Branch Manager' }, removedAt: null },
          ]);
        }
        return Promise.resolve([]);
      });
      prisma.sms_userBranchAssignments.findMany.mockResolvedValue([{ branchId: 'branch-uuid-1' }]);

      await expect(
        service.changeUserStatus(targetUserId, 'org-uuid-1', mockBranchManagerActor, {
          status: 'deactivated',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if Branch Manager tries to deactivate user outside their branch', async () => {
      prisma.sms_users.findFirst.mockResolvedValue({
        id: targetUserId,
        organizationId: 'org-uuid-1',
        status: 'active',
        userRolesAssignedToMe: [
          { role: { slug: 'front-desk', name: 'Front Desk' } },
        ],
        userBranchAssignmentsForMe: [{ branchId: 'other-branch-uuid' }],
      });
      prisma.sms_userRoles.findMany.mockImplementation((args: any) => {
        if (args?.where?.userId === mockBranchManagerActor.id) {
          return Promise.resolve([
            { id: 'ur-bm', userId: mockBranchManagerActor.id, role: { slug: 'branch-manager', name: 'Branch Manager' }, removedAt: null },
          ]);
        }
        return Promise.resolve([]);
      });
      prisma.sms_userBranchAssignments.findMany.mockResolvedValue([{ branchId: 'branch-uuid-1' }]);

      await expect(
        service.changeUserStatus(targetUserId, 'org-uuid-1', mockBranchManagerActor, {
          status: 'deactivated',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if trying to deactivate the last active Owner', async () => {
      prisma.sms_users.findFirst.mockResolvedValue({
        id: targetUserId,
        organizationId: 'org-uuid-1',
        status: 'active',
        userRolesAssignedToMe: [
          { role: { slug: 'owner', name: 'Owner' } },
        ],
        userBranchAssignmentsForMe: [],
      });
      prisma.sms_userRoles.findMany.mockImplementation((args: any) => {
        if (args?.where?.userId === mockActor.id) {
          return Promise.resolve([
            { id: 'ur-sa', userId: mockActor.id, role: { slug: 'super-admin', name: 'Super Admin' }, removedAt: null },
          ]);
        }
        return Promise.resolve([]);
      });
      // 0 other active owners
      prisma.sms_userRoles.count.mockResolvedValue(0);

      await expect(
        service.changeUserStatus(targetUserId, 'org-uuid-1', mockActor, {
          status: 'deactivated',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return early if user is already in desired status', async () => {
      prisma.sms_users.findFirst.mockResolvedValue({
        id: targetUserId,
        displayName: 'Already Deactivated',
        email: 'deact@salon.com',
        organizationId: 'org-uuid-1',
        status: 'deactivated',
        userRolesAssignedToMe: [],
        userBranchAssignmentsForMe: [],
      });
      prisma.sms_userRoles.findMany.mockResolvedValue([
        { id: 'ur-sa', userId: mockActor.id, role: { slug: 'super-admin', name: 'Super Admin' }, removedAt: null },
      ]);

      const result = await service.changeUserStatus(targetUserId, 'org-uuid-1', mockActor, {
        status: 'deactivated',
      });

      expect(result.message).toContain('already deactivated');
      expect(prisma.sms_users.update).not.toHaveBeenCalled();
    });

    it('should successfully deactivate an active user and write audit log', async () => {
      prisma.sms_users.findFirst.mockResolvedValue({
        id: targetUserId,
        displayName: 'Jane Doe',
        email: 'jane@salon.com',
        organizationId: 'org-uuid-1',
        status: 'active',
        userRolesAssignedToMe: [
          { role: { slug: 'stylist', name: 'Senior Stylist' } },
        ],
        userBranchAssignmentsForMe: [{ branchId: 'branch-uuid-1' }],
      });
      prisma.sms_userRoles.findMany.mockResolvedValue([
        { id: 'ur-owner', userId: mockActor.id, role: { slug: 'owner', name: 'Owner' }, removedAt: null },
      ]);
      prisma.sms_users.update.mockResolvedValue({
        id: targetUserId,
        displayName: 'Jane Doe',
        email: 'jane@salon.com',
        status: 'deactivated',
        updatedAt: new Date(),
      });
      prisma.sms_userStatusLogs.create.mockResolvedValue({ id: 'log-1' });

      const result = await service.changeUserStatus(targetUserId, 'org-uuid-1', mockActor, {
        status: 'deactivated',
        reason: 'Staff resigned',
      });

      expect(result.status).toBe('deactivated');
      expect(result.previousStatus).toBe('active');
      expect(prisma.sms_users.update).toHaveBeenCalledWith({
        where: { id: targetUserId },
        data: { status: 'deactivated' },
      });
      expect(prisma.sms_userStatusLogs.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: targetUserId,
            fromStatus: 'active',
            toStatus: 'deactivated',
            reason: 'Staff resigned',
            changedById: mockActor.id,
          }),
        }),
      );
    });

    it('should successfully reactivate a deactivated user back to active', async () => {
      prisma.sms_users.findFirst.mockResolvedValue({
        id: targetUserId,
        displayName: 'Jane Doe',
        email: 'jane@salon.com',
        organizationId: 'org-uuid-1',
        status: 'deactivated',
        userRolesAssignedToMe: [
          { role: { slug: 'stylist', name: 'Senior Stylist' } },
        ],
        userBranchAssignmentsForMe: [{ branchId: 'branch-uuid-1' }],
      });
      prisma.sms_userRoles.findMany.mockResolvedValue([
        { id: 'ur-owner', userId: mockActor.id, role: { slug: 'owner', name: 'Owner' }, removedAt: null },
      ]);
      prisma.sms_users.update.mockResolvedValue({
        id: targetUserId,
        displayName: 'Jane Doe',
        email: 'jane@salon.com',
        status: 'active',
        updatedAt: new Date(),
      });
      prisma.sms_userStatusLogs.create.mockResolvedValue({ id: 'log-2' });

      const result = await service.changeUserStatus(targetUserId, 'org-uuid-1', mockActor, {
        status: 'active',
        reason: 'Rehired employee',
      });

      expect(result.status).toBe('active');
      expect(result.previousStatus).toBe('deactivated');
      expect(prisma.sms_users.update).toHaveBeenCalledWith({
        where: { id: targetUserId },
        data: { status: 'active' },
      });
    });
  });
});

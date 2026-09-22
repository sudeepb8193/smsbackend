import { Test, TestingModule } from '@nestjs/testing';
import { UserRoleService } from './user-role.service';
import { PrismaService } from '../../../database/prisma.service';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';

describe('UserRoleService', () => {
  let service: UserRoleService;
  let prisma: any;

  const mockPrismaService = {
    sms_users: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    sms_roles: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    sms_userRoles: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn((callback) => {
      if (typeof callback === 'function') {
        return callback(mockPrismaService);
      }
      return Promise.all(callback);
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserRoleService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<UserRoleService>(UserRoleService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('assignRole', () => {
    it('should throw NotFoundException if user is not in organization', async () => {
      prisma.sms_users.findFirst.mockResolvedValue(null);

      await expect(
        service.assignRole('u1', 'org1', 'admin1', { roleId: 'r1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if role is inactive', async () => {
      prisma.sms_users.findFirst.mockResolvedValue({ id: 'u1', organizationId: 'org1' });
      prisma.sms_roles.findFirst.mockResolvedValue({ id: 'r1', status: 'inactive' });

      await expect(
        service.assignRole('u1', 'org1', 'admin1', { roleId: 'r1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if user already holds active role', async () => {
      prisma.sms_users.findFirst.mockResolvedValue({ id: 'u1', organizationId: 'org1' });
      prisma.sms_roles.findFirst.mockResolvedValue({ id: 'r1', status: 'active' });
      prisma.sms_userRoles.findMany.mockResolvedValue([{ id: 'ur1', roleId: 'r1', removedAt: null }]);

      await expect(
        service.assignRole('u1', 'org1', 'admin1', { roleId: 'r1' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should force first role to be primary', async () => {
      prisma.sms_users.findFirst.mockResolvedValue({ id: 'u1', organizationId: 'org1' });
      prisma.sms_roles.findFirst.mockResolvedValue({ id: 'r1', name: 'Branch Manager', status: 'active' });
      prisma.sms_userRoles.findMany.mockResolvedValue([]);
      prisma.sms_userRoles.findUnique.mockResolvedValue(null);
      prisma.sms_userRoles.create.mockResolvedValue({
        id: 'ur1',
        userId: 'u1',
        roleId: 'r1',
        isPrimary: true,
        assignedAt: new Date(),
        role: { name: 'Branch Manager' },
      });

      const res = await service.assignRole('u1', 'org1', 'admin1', { roleId: 'r1' });
      expect(res.isPrimary).toBe(true);
    });
  });

  describe('removeRole', () => {
    it('should block removal if user has only one active role', async () => {
      prisma.sms_users.findFirst.mockResolvedValue({ id: 'u1', organizationId: 'org1' });
      prisma.sms_userRoles.findMany.mockResolvedValue([
        { id: 'ur1', roleId: 'r1', isPrimary: true, role: { name: 'Super Admin' } },
      ]);

      await expect(service.removeRole('u1', 'r1', 'org1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should soft-delete role assignment if user has multiple active roles', async () => {
      prisma.sms_users.findFirst.mockResolvedValue({ id: 'u1', organizationId: 'org1' });
      prisma.sms_userRoles.findMany.mockResolvedValue([
        { id: 'ur1', roleId: 'r1', isPrimary: false, role: { name: 'Role 1', status: 'active' } },
        { id: 'ur2', roleId: 'r2', isPrimary: true, role: { name: 'Role 2', status: 'active' } },
      ]);
      prisma.sms_userRoles.update.mockResolvedValue({});

      const res = await service.removeRole('u1', 'r1', 'org1');
      expect(res.removedRoleId).toBe('r1');
    });
  });

  describe('getEffectivePermissions', () => {
    it('should return distinct union of permissions across active roles', async () => {
      prisma.sms_users.findFirst.mockResolvedValue({ id: 'u1', organizationId: 'org1' });
      prisma.sms_userRoles.findMany.mockResolvedValue([
        {
          id: 'ur1',
          isPrimary: true,
          role: {
            id: 'r1',
            name: 'Role 1',
            rolePermissions: [
              {
                permission: {
                  id: 'p1',
                  permissionKey: 'org:read',
                  moduleCode: 'org',
                  moduleLabel: 'Organization',
                  action: 'read',
                  label: 'Read Org',
                },
              },
            ],
          },
        },
        {
          id: 'ur2',
          isPrimary: false,
          role: {
            id: 'r2',
            name: 'Role 2',
            rolePermissions: [
              {
                permission: {
                  id: 'p1',
                  permissionKey: 'org:read',
                  moduleCode: 'org',
                  moduleLabel: 'Organization',
                  action: 'read',
                  label: 'Read Org',
                },
              },
              {
                permission: {
                  id: 'p2',
                  permissionKey: 'org:write',
                  moduleCode: 'org',
                  moduleLabel: 'Organization',
                  action: 'create',
                  label: 'Write Org',
                },
              },
            ],
          },
        },
      ]);

      const result = await service.getEffectivePermissions('u1', 'org1');
      expect(result.totalEffectivePermissions).toBe(2);
      expect(result.effectivePermissions.find((p) => p.permissionKey === 'org:read')?.grantedByRoles).toHaveLength(2);
    });
  });
});

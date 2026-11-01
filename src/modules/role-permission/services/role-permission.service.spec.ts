import { Test, TestingModule } from '@nestjs/testing';
import { RolePermissionService } from './role-permission.service';
import { RoleService } from './role.service';
import { EffectivePermissionResolverService } from './effective-permission-resolver.service';
import { PrismaService } from '../../../database/prisma.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { sms_roles_roleType, sms_rolePermissions_scope } from '@prisma/client';

describe('Role & RolePermission Services', () => {
  let roleService: RoleService;
  let rolePermissionService: RolePermissionService;
  let prisma: any;

  const mockRoleId = 'role-123';
  const mockOrgId = 'org-456';
  const mockUserId = 'user-789';

  beforeEach(async () => {
    prisma = {
      sms_roles: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      sms_permissions: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      sms_rolePermissions: {
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
      sms_roleBranchRestrictions: {
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
      sms_userRoles: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      sms_branches: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleService,
        RolePermissionService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: EffectivePermissionResolverService,
          useValue: {
            invalidateCache: jest.fn(),
            resolveUserPermissions: jest.fn().mockResolvedValue(new Map()),
            can: jest.fn().mockResolvedValue({ authorized: true }),
          },
        },
      ],
    }).compile();

    roleService = module.get<RoleService>(RoleService);
    rolePermissionService = module.get<RolePermissionService>(RolePermissionService);
  });

  describe('RoleService Edge Cases', () => {
    it('should block renaming a system role', async () => {
      prisma.sms_roles.findFirst.mockResolvedValue({
        id: mockRoleId,
        name: 'Owner',
        roleType: sms_roles_roleType.system,
        status: 'active',
      });

      await expect(
        roleService.updateRole(
          mockRoleId,
          { name: 'Boss' },
          mockUserId,
          mockOrgId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should block deleting a system role', async () => {
      prisma.sms_roles.findFirst.mockResolvedValue({
        id: mockRoleId,
        name: 'Branch Manager',
        roleType: sms_roles_roleType.system,
      });

      await expect(
        roleService.deleteRole(mockRoleId, mockUserId, mockOrgId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should block deleting a custom role if assigned to active users', async () => {
      prisma.sms_roles.findFirst.mockResolvedValue({
        id: mockRoleId,
        name: 'Senior Stylist',
        roleType: sms_roles_roleType.custom,
      });

      prisma.sms_userRoles.findMany.mockResolvedValue([
        {
          user: { id: 'user-1', displayName: 'Alice', email: 'alice@test.com' },
        },
      ]);

      await expect(
        roleService.deleteRole(mockRoleId, mockUserId, mockOrgId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('RolePermissionService Concurrency & Dependencies', () => {
    it('should reject stale update when expectedUpdatedAt does not match (OCC Conflict)', async () => {
      const initialDate = new Date('2026-10-10T10:00:00.000Z');
      prisma.sms_roles.findFirst.mockResolvedValue({
        id: mockRoleId,
        updatedAt: initialDate,
        rolePermissions: [],
      });

      const staleToken = '2026-10-09T08:00:00.000Z'; // older version

      await expect(
        rolePermissionService.updateRolePermissions(
          mockRoleId,
          {
            expectedUpdatedAt: staleToken,
            permissions: [],
          },
          mockUserId,
          mockOrgId,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject Restricted Branches scope when branch array is empty', async () => {
      const now = new Date();
      prisma.sms_roles.findFirst.mockResolvedValue({
        id: mockRoleId,
        organizationId: mockOrgId,
        updatedAt: now,
        rolePermissions: [],
      });

      prisma.sms_permissions.findMany.mockResolvedValue([
        {
          id: 'perm-1',
          permissionKey: 'billing.create',
          moduleCode: 'billing',
          moduleLabel: 'Billing',
          action: 'create',
          isLegacy: false,
        },
        {
          id: 'perm-2',
          permissionKey: 'billing.view',
          moduleCode: 'billing',
          moduleLabel: 'Billing',
          action: 'view',
          isLegacy: false,
        },
      ]);

      await expect(
        rolePermissionService.updateRolePermissions(
          mockRoleId,
          {
            expectedUpdatedAt: now.toISOString(),
            permissions: [
              {
                permissionKey: 'billing.create',
                scope: sms_rolePermissions_scope.restricted_branches,
                restrictedBranchIds: [], // Empty!
              },
            ],
          },
          mockUserId,
          mockOrgId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should automatically include implied View permission when a child action is granted', async () => {
      const now = new Date();
      prisma.sms_roles.findFirst.mockResolvedValue({
        id: mockRoleId,
        organizationId: mockOrgId,
        updatedAt: now,
        rolePermissions: [],
      });

      prisma.sms_permissions.findMany.mockResolvedValue([
        {
          id: 'perm-edit',
          permissionKey: 'appointments.edit',
          moduleCode: 'appointments',
          moduleLabel: 'Appointments',
          action: 'edit',
          isLegacy: false,
        },
        {
          id: 'perm-view',
          permissionKey: 'appointments.view',
          moduleCode: 'appointments',
          moduleLabel: 'Appointments',
          action: 'view',
          isLegacy: false,
        },
      ]);

      prisma.sms_roles.update.mockResolvedValue({
        id: mockRoleId,
        updatedAt: new Date(),
      });

      const res = await rolePermissionService.updateRolePermissions(
        mockRoleId,
        {
          expectedUpdatedAt: now.toISOString(),
          permissions: [
            {
              permissionKey: 'appointments.edit',
              scope: sms_rolePermissions_scope.all_branches,
            },
          ],
        },
        mockUserId,
        mockOrgId,
      );

      expect(res.success).toBe(true);
      // Both edit AND automatically implied view should be created
      expect(prisma.sms_rolePermissions.create).toHaveBeenCalledTimes(2);
    });
  });
});

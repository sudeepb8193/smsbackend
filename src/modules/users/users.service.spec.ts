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

  const mockUserStore: any[] = [];
  const mockRolesStore: any[] = [];
  const mockUserRolesStore: any[] = [];

  let userAutoIncrement = 1;
  let roleAutoIncrement = 1;
  let userRoleAutoIncrement = 1;

  beforeEach(async () => {
    mockUserStore.length = 0;
    mockRolesStore.length = 0;
    mockUserRolesStore.length = 0;

    userAutoIncrement = 1;
    roleAutoIncrement = 1;
    userRoleAutoIncrement = 1;

    // Preseed default roles for org 100
    mockRolesStore.push(
      { id: 1, uuid: 'role-1', organizationId: 100, name: 'Super Admin', code: 'SUPER_ADMIN', status: 'active', isSystem: true, deletedAt: null },
      { id: 2, uuid: 'role-2', organizationId: 100, name: 'Branch Manager', code: 'BRANCH_MANAGER', status: 'active', isSystem: true, deletedAt: null },
      { id: 3, uuid: 'role-3', organizationId: 100, name: 'Front Desk', code: 'FRONT_DESK', status: 'active', isSystem: true, deletedAt: null },
      { id: 4, uuid: 'role-4', organizationId: 100, name: 'Service Staff', code: 'SERVICE_STAFF', status: 'active', isSystem: true, deletedAt: null },
      { id: 5, uuid: 'role-5', organizationId: 100, name: 'Inactive Role', code: 'INACTIVE_ROLE', status: 'inactive', isSystem: false, deletedAt: null },
      { id: 99, uuid: 'role-99', organizationId: 200, name: 'Other Org Role', code: 'OTHER_ORG_ROLE', status: 'active', isSystem: false, deletedAt: null },
    );
    roleAutoIncrement = 100;

    const mockPrismaService: any = {
      $transaction: jest.fn().mockImplementation(async (cb) => {
        return cb(mockPrismaService);
      }),
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
      smsRole: {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          return mockRolesStore.find((r) => {
            if (where.organizationId && r.organizationId !== where.organizationId) return false;
            if (where.id && r.id !== where.id) return false;
            if (where.code && r.code !== where.code) return false;
            if (where.deletedAt === null && r.deletedAt !== null) return false;
            return true;
          }) || null;
        }),
        findMany: jest.fn().mockImplementation(({ where }) => {
          return mockRolesStore.filter((r) => r.organizationId === where.organizationId && r.deletedAt === null);
        }),
        create: jest.fn().mockImplementation(({ data }) => {
          const newRole = {
            id: roleAutoIncrement++,
            uuid: `role-uuid-${roleAutoIncrement}`,
            organizationId: data.organizationId,
            name: data.name,
            code: data.code,
            description: data.description || null,
            status: data.status || 'active',
            isSystem: data.isSystem || false,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          };
          mockRolesStore.push(newRole);
          return newRole;
        }),
      },
      smsUserRole: {
        findMany: jest.fn().mockImplementation(({ where }) => {
          return mockUserRolesStore
            .filter((ur) => {
              if (where.userId && ur.userId !== where.userId) return false;
              if (where.removedAt === null && ur.removedAt !== null) return false;
              return true;
            })
            .map((ur) => {
              const roleObj = mockRolesStore.find((r) => r.id === ur.roleId) || { name: 'Mock Role', code: 'MOCK_ROLE', status: 'active' };
              return {
                ...ur,
                role: { ...roleObj, rolePermissions: [] },
                assigner: null,
              };
            });
        }),
        findFirst: jest.fn().mockImplementation(({ where }) => {
          const matched = mockUserRolesStore.find((ur) => {
            if (where.userId && ur.userId !== where.userId) return false;
            if (where.roleId && ur.roleId !== where.roleId) return false;
            if (where.removedAt === null && ur.removedAt !== null) return false;
            return true;
          });
          if (!matched) return null;
          const roleObj = mockRolesStore.find((r) => r.id === matched.roleId) || { name: 'Mock Role', code: 'MOCK_ROLE', status: 'active' };
          return {
            ...matched,
            role: { ...roleObj, rolePermissions: [] },
            assigner: null,
          };
        }),
        count: jest.fn().mockImplementation(({ where }) => {
          return mockUserRolesStore.filter((ur) => {
            if (where.userId && ur.userId !== where.userId) return false;
            if (where.removedAt === null && ur.removedAt !== null) return false;
            return true;
          }).length;
        }),
        create: jest.fn().mockImplementation(({ data }) => {
          const newUr = {
            id: userRoleAutoIncrement++,
            userId: data.userId,
            roleId: data.roleId,
            isPrimary: data.isPrimary || false,
            assignedBy: data.assignedBy || null,
            assignedAt: data.assignedAt || new Date(),
            removedAt: null,
          };
          mockUserRolesStore.push(newUr);
          return newUr;
        }),
        updateMany: jest.fn().mockImplementation(({ where, data }) => {
          let count = 0;
          mockUserRolesStore.forEach((ur) => {
            if (where.userId && ur.userId !== where.userId) return;
            if (where.removedAt === null && ur.removedAt !== null) return;
            Object.assign(ur, data);
            count++;
          });
          return { count };
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const ur = mockUserRolesStore.find((item) => item.id === where.id);
          if (!ur) throw new Error('UserRole not found');
          Object.assign(ur, data);
          return ur;
        }),
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
  });

  describe('Create User & Basic Flow', () => {
    const adminCtx = { id: 1, organizationId: 100, role: Role.SUPER_ADMIN };

    it('should create user with invitation token', async () => {
      const user = await service.createUser(
        {
          displayName: 'John Salon',
          email: 'john@salon.com',
          role: Role.FRONT_DESK,
        },
        adminCtx,
      );

      expect(user.displayName).toBe('John Salon');
      expect(user.email).toBe('john@salon.com');
      expect(user.status).toBe('pending');
      expect(user.invitationUrl).toContain('/accept-invite?token=');
    });

    it('should reject creation if neither email nor phone is provided', async () => {
      await expect(
        service.createUser(
          { displayName: 'No Identifier', role: Role.FRONT_DESK },
          adminCtx,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Task 4.2 — Role Assignment & Management', () => {
    const adminCtx = { id: 99, organizationId: 100, role: Role.SUPER_ADMIN };
    let testUser: any;

    beforeEach(async () => {
      testUser = await service.createUser(
        { displayName: 'Staff Ravi', email: 'ravi@salon.com', role: Role.FRONT_DESK },
        adminCtx,
      );
    });

    it('should list assigned roles and auto-create primary role matching user.role', async () => {
      const res = await service.getUserRoles(testUser.id, 100);

      expect(res.userId).toBe(testUser.id);
      expect(res.activeRoles).toHaveLength(1);
      expect(res.activeRoles[0].isPrimary).toBe(true);
      expect(res.activeRoles[0].roleCode).toBe('FRONT_DESK');
    });

    it('should assign a secondary role to user', async () => {
      const res = await service.assignRole(
        testUser.id,
        { roleId: 4, isPrimary: false }, // SERVICE_STAFF
        adminCtx,
      );

      expect(res.activeRoles).toHaveLength(2);
      const primary = res.activeRoles.find((r: any) => r.isPrimary);
      const secondary = res.activeRoles.find((r: any) => !r.isPrimary);

      expect(primary?.roleCode).toBe('FRONT_DESK');
      expect(secondary?.roleCode).toBe('SERVICE_STAFF');
    });

    it('should block duplicate active role assignment', async () => {
      await service.assignRole(testUser.id, { roleId: 4 }, adminCtx);

      await expect(
        service.assignRole(testUser.id, { roleId: 4 }, adminCtx),
      ).rejects.toThrow(ConflictException);
    });

    it('should block assigning an inactive role', async () => {
      await expect(
        service.assignRole(testUser.id, { roleId: 5 }, adminCtx), // status = inactive
      ).rejects.toThrow(BadRequestException);
    });

    it('should block cross-tenant role assignment', async () => {
      await expect(
        service.assignRole(testUser.id, { roleId: 99 }, adminCtx), // org 200 role
      ).rejects.toThrow(NotFoundException);
    });

    it('should switch primary role atomically', async () => {
      await service.assignRole(testUser.id, { roleId: 4, isPrimary: false }, adminCtx); // SERVICE_STAFF

      const updated = await service.makeRolePrimary(testUser.id, 4, adminCtx);

      const primary = updated.activeRoles.find((r: any) => r.isPrimary);
      const secondary = updated.activeRoles.find((r: any) => !r.isPrimary);

      expect(primary?.roleId).toBe(4);
      expect(primary?.roleCode).toBe('SERVICE_STAFF');
      expect(secondary?.roleCode).toBe('FRONT_DESK');
    });

    it('should block removing user final remaining active role', async () => {
      const rolesRes = await service.getUserRoles(testUser.id, 100);
      const singleRoleId = rolesRes.activeRoles[0].roleId;

      await expect(
        service.removeRole(testUser.id, singleRoleId, adminCtx),
      ).rejects.toThrow(BadRequestException);
    });

    it('should block removing Primary role without promoting another first', async () => {
      // Add secondary role
      await service.assignRole(testUser.id, { roleId: 4 }, adminCtx);

      const rolesRes = await service.getUserRoles(testUser.id, 100);
      const primaryRole = rolesRes.activeRoles.find((r: any) => r.isPrimary);

      await expect(
        service.removeRole(testUser.id, primaryRole!.roleId, adminCtx),
      ).rejects.toThrow(BadRequestException);
    });

    it('should remove secondary role and preserve role history in removedAt', async () => {
      await service.assignRole(testUser.id, { roleId: 4 }, adminCtx); // Add secondary SERVICE_STAFF

      const updated = await service.removeRole(testUser.id, 4, adminCtx);

      expect(updated.activeRoles).toHaveLength(1);
      expect(updated.historicalRoles).toHaveLength(1);
      expect(updated.historicalRoles[0].roleId).toBe(4);
      expect(updated.historicalRoles[0].removedAt).toBeDefined();
    });

    it('should calculate effective permissions as union of active roles', async () => {
      await service.assignRole(testUser.id, { roleId: 4 }, adminCtx); // Add SERVICE_STAFF

      const effective = await service.getEffectivePermissions(testUser.id, 100);

      // FRONT_DESK permissions: appointment.view, appointment.manage, service.session.manage, billing.view
      // SERVICE_STAFF permissions: appointment.view, service.session.manage
      // Union permissions should contain appointment.view, appointment.manage, service.session.manage, billing.view without duplicates
      expect(effective).toContain('appointment.view');
      expect(effective).toContain('appointment.manage');
      expect(effective).toContain('service.session.manage');
      expect(effective).toContain('billing.view');
    });

    it('should reject privilege escalation by Branch Manager trying to assign Super Admin', async () => {
      const bmCtx = { id: 50, organizationId: 100, role: Role.BRANCH_MANAGER };

      await expect(
        service.assignRole(testUser.id, { roleId: 1 }, bmCtx), // Super Admin role
      ).rejects.toThrow(ForbiddenException);
    });
  });
});

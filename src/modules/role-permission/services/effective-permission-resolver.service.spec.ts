import { Test, TestingModule } from '@nestjs/testing';
import { EffectivePermissionResolverService } from './effective-permission-resolver.service';
import { PrismaService } from '../../../database/prisma.service';
import { sms_rolePermissions_scope, sms_staffPermissionOverrides_overrideType } from '@prisma/client';

describe('EffectivePermissionResolverService', () => {
  let resolver: EffectivePermissionResolverService;
  let prisma: any;

  const mockUserId = 'user-uuid-1';
  const mockOrgId = 'org-uuid-1';
  const mockStaffId = 'staff-uuid-1';
  const mockBranch1 = 'branch-uuid-1';
  const mockBranch2 = 'branch-uuid-2';

  beforeEach(async () => {
    prisma = {
      sms_users: {
        findFirst: jest.fn(),
      },
      sms_userRoles: {
        findMany: jest.fn(),
      },
      sms_staffPermissionOverrides: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EffectivePermissionResolverService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    resolver = module.get<EffectivePermissionResolverService>(
      EffectivePermissionResolverService,
    );
  });

  afterEach(() => {
    resolver.invalidateCache();
    jest.clearAllMocks();
  });

  it('should return empty permissions if user is inactive, deactivated, or not found', async () => {
    prisma.sms_users.findFirst.mockResolvedValue(null);

    const result = await resolver.resolveUserPermissions(mockUserId, mockOrgId);
    expect(result.size).toBe(0);

    const canResult = await resolver.can(mockUserId, mockOrgId, 'appointments.view');
    expect(canResult.authorized).toBe(false);
  });

  it('should union permissions across multiple assigned active roles', async () => {
    prisma.sms_users.findFirst.mockResolvedValue({
      id: mockUserId,
      organizationId: mockOrgId,
      status: 'active',
      staffLinked: null,
      userBranchAssignmentsForMe: [],
    });

    prisma.sms_userRoles.findMany.mockResolvedValue([
      {
        role: {
          id: 'role-1',
          name: 'Front Desk',
          status: 'active',
          deletedAt: null,
          rolePermissions: [
            {
              scope: sms_rolePermissions_scope.all_branches,
              permission: {
                permissionKey: 'appointments.view',
                moduleCode: 'appointments',
                action: 'view',
                label: 'View Appointments',
                isLegacy: false,
              },
            },
          ],
          roleBranchRestrictions: [],
        },
      },
      {
        role: {
          id: 'role-2',
          name: 'Cashier',
          status: 'active',
          deletedAt: null,
          rolePermissions: [
            {
              scope: sms_rolePermissions_scope.all_branches,
              permission: {
                permissionKey: 'billing.create',
                moduleCode: 'billing',
                action: 'create',
                label: 'Create Invoices',
                isLegacy: false,
              },
            },
          ],
          roleBranchRestrictions: [],
        },
      },
    ]);

    prisma.sms_staffPermissionOverrides.findMany.mockResolvedValue([]);

    const result = await resolver.resolveUserPermissions(mockUserId, mockOrgId);

    expect(result.size).toBe(2);
    expect(result.has('appointments.view')).toBe(true);
    expect(result.has('billing.create')).toBe(true);

    const checkAppt = await resolver.can(mockUserId, mockOrgId, 'appointments.view');
    expect(checkAppt.authorized).toBe(true);

    const checkBilling = await resolver.can(mockUserId, mockOrgId, 'billing.create');
    expect(checkBilling.authorized).toBe(true);

    const checkReports = await resolver.can(mockUserId, mockOrgId, 'reports.view');
    expect(checkReports.authorized).toBe(false);
  });

  it('should enforce Revoke override precedence over role grant', async () => {
    prisma.sms_users.findFirst.mockResolvedValue({
      id: mockUserId,
      organizationId: mockOrgId,
      status: 'active',
      staffLinked: { id: mockStaffId, homeBranchId: mockBranch1 },
      userBranchAssignmentsForMe: [],
    });

    prisma.sms_userRoles.findMany.mockResolvedValue([
      {
        role: {
          id: 'role-1',
          name: 'Front Desk',
          status: 'active',
          deletedAt: null,
          rolePermissions: [
            {
              scope: sms_rolePermissions_scope.all_branches,
              permission: {
                permissionKey: 'appointments.cancel',
                moduleCode: 'appointments',
                action: 'delete',
                label: 'Cancel Appointments',
                isLegacy: false,
              },
            },
          ],
          roleBranchRestrictions: [],
        },
      },
    ]);

    // Global revoke override on appointments.cancel
    prisma.sms_staffPermissionOverrides.findMany.mockResolvedValue([
      {
        overrideType: sms_staffPermissionOverrides_overrideType.revoke,
        branchId: null,
        permission: {
          permissionKey: 'appointments.cancel',
          moduleCode: 'appointments',
          action: 'delete',
          label: 'Cancel Appointments',
        },
      },
    ]);

    const result = await resolver.can(mockUserId, mockOrgId, 'appointments.cancel');
    expect(result.authorized).toBe(false);
    expect(result.reason).toContain('Missing required permission');
  });

  it('should support Grant override within branch scope', async () => {
    prisma.sms_users.findFirst.mockResolvedValue({
      id: mockUserId,
      organizationId: mockOrgId,
      status: 'active',
      staffLinked: { id: mockStaffId, homeBranchId: mockBranch1 },
      userBranchAssignmentsForMe: [],
    });

    // User role has NO refund approval
    prisma.sms_userRoles.findMany.mockResolvedValue([]);

    // Grant override specifically for mockBranch1
    prisma.sms_staffPermissionOverrides.findMany.mockResolvedValue([
      {
        overrideType: sms_staffPermissionOverrides_overrideType.grant,
        branchId: mockBranch1,
        permission: {
          permissionKey: 'billing.approve',
          moduleCode: 'billing',
          action: 'approve',
          label: 'Approve Refunds',
        },
      },
    ]);

    // Authorized on mockBranch1
    const allowedBranchResult = await resolver.can(
      mockUserId,
      mockOrgId,
      'billing.approve',
      mockBranch1,
    );
    expect(allowedBranchResult.authorized).toBe(true);

    // Denied on unauthorized mockBranch2
    const deniedBranchResult = await resolver.can(
      mockUserId,
      mockOrgId,
      'billing.approve',
      mockBranch2,
    );
    expect(deniedBranchResult.authorized).toBe(false);
    expect(deniedBranchResult.reason).toContain('access to branch "branch-uuid-2" is restricted');
  });

  it('should invalidate cache when role assignments change', async () => {
    prisma.sms_users.findFirst.mockResolvedValue({
      id: mockUserId,
      organizationId: mockOrgId,
      status: 'active',
      staffLinked: null,
      userBranchAssignmentsForMe: [],
    });

    prisma.sms_userRoles.findMany.mockResolvedValueOnce([
      {
        role: {
          id: 'role-1',
          name: 'Stylist',
          status: 'active',
          deletedAt: null,
          rolePermissions: [
            {
              scope: sms_rolePermissions_scope.all_branches,
              permission: {
                permissionKey: 'services.view',
                moduleCode: 'services',
                action: 'view',
                label: 'View Services',
                isLegacy: false,
              },
            },
          ],
          roleBranchRestrictions: [],
        },
      },
    ]);

    prisma.sms_staffPermissionOverrides.findMany.mockResolvedValue([]);

    // First call caches the result
    const firstCheck = await resolver.can(mockUserId, mockOrgId, 'services.view');
    expect(firstCheck.authorized).toBe(true);

    // Invalidate cache
    resolver.invalidateCache(mockUserId);

    // Next call fetches updated DB data (now empty)
    prisma.sms_userRoles.findMany.mockResolvedValueOnce([]);

    const secondCheck = await resolver.can(mockUserId, mockOrgId, 'services.view');
    expect(secondCheck.authorized).toBe(false);
  });
});

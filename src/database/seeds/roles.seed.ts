import {
  PrismaClient,
  sms_roles_roleType,
  sms_roles_status,
  sms_rolePermissions_scope,
} from '@prisma/client';

export interface PredefinedRoleConfig {
  name: string;
  slug: string;
  description: string;
  roleType: sms_roles_roleType;
  defaultScope: sms_rolePermissions_scope;
  permissionKeys: string[];
}

export const PREDEFINED_SYSTEM_ROLES: PredefinedRoleConfig[] = [
  {
    name: 'Owner',
    slug: 'owner',
    description: 'Salon Organization Owner with full operational, administrative, and financial rights across all branches.',
    roleType: sms_roles_roleType.system,
    defaultScope: sms_rolePermissions_scope.all_branches,
    // Owner gets all registered permissions
    permissionKeys: ['*'],
  },
  {
    name: 'Branch Manager',
    slug: 'branch-manager',
    description: 'Manages daily branch appointments, stylist rosters, customers, inventory, and branch transactions.',
    roleType: sms_roles_roleType.system,
    defaultScope: sms_rolePermissions_scope.own_branch,
    permissionKeys: [
      'branches.view',
      'branches.edit',
      'staff.view',
      'staff.edit',
      'staff.export',
      'appointments.view',
      'appointments.create',
      'appointments.edit',
      'appointments.delete',
      'appointments.approve',
      'services.view',
      'inventory.view',
      'inventory.create',
      'inventory.edit',
      'customers.view',
      'customers.create',
      'customers.edit',
      'customers.export',
      'billing.view',
      'billing.create',
      'billing.edit',
      'billing.approve',
      'billing.export',
      'billing.print',
      'reports.view',
      'reports.export',
      'reports.print',
    ],
  },
  {
    name: 'Front Desk',
    slug: 'front-desk',
    description: 'Handles client check-ins, appointments, cashier checkout, customer details, and appointment notifications.',
    roleType: sms_roles_roleType.system,
    defaultScope: sms_rolePermissions_scope.own_branch,
    permissionKeys: [
      'appointments.view',
      'appointments.create',
      'appointments.edit',
      'customers.view',
      'customers.create',
      'customers.edit',
      'services.view',
      'billing.view',
      'billing.create',
      'billing.print',
    ],
  },
  {
    name: 'Service Staff',
    slug: 'service-staff',
    description: 'Stylists, technicians, beauticians, and therapists providing client services and viewing schedules.',
    roleType: sms_roles_roleType.system,
    defaultScope: sms_rolePermissions_scope.own_branch,
    permissionKeys: [
      'appointments.view',
      'customers.view',
      'services.view',
    ],
  },
  {
    name: 'Inventory Manager',
    slug: 'inventory-manager',
    description: 'Monitors inventory levels, product replenishment, purchase orders, and salon supply usage.',
    roleType: sms_roles_roleType.system,
    defaultScope: sms_rolePermissions_scope.own_branch,
    permissionKeys: [
      'inventory.view',
      'inventory.create',
      'inventory.edit',
      'inventory.delete',
      'services.view',
      'reports.view',
      'reports.export',
    ],
  },
  {
    name: 'Accountant',
    slug: 'accountant',
    description: 'Reviews sales revenue, invoices, tax summaries, audit trails, and financial performance reports.',
    roleType: sms_roles_roleType.system,
    defaultScope: sms_rolePermissions_scope.all_branches,
    permissionKeys: [
      'organizations.view',
      'branches.view',
      'customers.view',
      'billing.view',
      'billing.export',
      'billing.print',
      'reports.view',
      'reports.export',
      'reports.print',
      'audit.view',
    ],
  },
  {
    name: 'Marketing Manager',
    slug: 'marketing-manager',
    description: 'Plans client acquisition campaigns, loyalty packages, customer communications, and analytics.',
    roleType: sms_roles_roleType.system,
    defaultScope: sms_rolePermissions_scope.all_branches,
    permissionKeys: [
      'customers.view',
      'customers.edit',
      'customers.export',
      'services.view',
      'reports.view',
      'reports.export',
    ],
  },
  {
    name: 'Customer',
    slug: 'customer',
    description: 'Self-service customer portal account for booking appointments, viewing service menus, and receipts.',
    roleType: sms_roles_roleType.system,
    defaultScope: sms_rolePermissions_scope.own_branch,
    permissionKeys: [
      'appointments.view',
      'appointments.create',
      'services.view',
    ],
  },
];

/**
 * Initializes predefined system roles idempotently for a given organization.
 * If organizationId is not provided, seeds global system roles where organizationId is null.
 */
export async function seedOrganizationSystemRoles(
  prisma: PrismaClient,
  organizationId: string | null = null,
): Promise<{ rolesCreated: number; permissionsAssigned: number }> {
  // Fetch all existing permissions to resolve keys
  const allPermissions = await prisma.sms_permissions.findMany({
    where: { isLegacy: false },
  });
  const permissionMap = new Map(allPermissions.map((p) => [p.permissionKey, p.id]));

  let rolesCreated = 0;
  let permissionsAssigned = 0;

  for (const roleDef of PREDEFINED_SYSTEM_ROLES) {
    // Check if role already exists for this org (or global null)
    let role = await prisma.sms_roles.findFirst({
      where: {
        organizationId,
        slug: roleDef.slug,
        deletedAt: null,
      },
    });

    if (!role) {
      role = await prisma.sms_roles.create({
        data: {
          organizationId,
          name: roleDef.name,
          slug: roleDef.slug,
          description: roleDef.description,
          roleType: sms_roles_roleType.system,
          status: sms_roles_status.active,
        },
      });
      rolesCreated++;
    }

    // Determine target permission IDs
    const targetPermissionIds: string[] = [];
    if (roleDef.permissionKeys.includes('*')) {
      targetPermissionIds.push(...allPermissions.map((p) => p.id));
    } else {
      for (const key of roleDef.permissionKeys) {
        const permId = permissionMap.get(key);
        if (permId) {
          targetPermissionIds.push(permId);
        }
      }
    }

    // Assign role permissions idempotently
    for (const permissionId of targetPermissionIds) {
      const existing = await prisma.sms_rolePermissions.findUnique({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId,
          },
        },
      });

      if (!existing) {
        await prisma.sms_rolePermissions.create({
          data: {
            roleId: role.id,
            permissionId,
            scope: roleDef.defaultScope,
          },
        });
        permissionsAssigned++;
      }
    }
  }

  return { rolesCreated, permissionsAssigned };
}

/**
 * Seeds roles across all existing organizations
 */
export async function seedAllOrganizationsRoles(prisma: PrismaClient) {
  const orgs = await prisma.sms_organizations.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
  });

  console.log(`Found ${orgs.length} organizations to initialize system roles.`);
  for (const org of orgs) {
    const res = await seedOrganizationSystemRoles(prisma, org.id);
    console.log(`Organization [${org.name}]: created ${res.rolesCreated} roles, assigned ${res.permissionsAssigned} permissions.`);
  }
}

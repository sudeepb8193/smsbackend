import { PrismaClient, sms_permissions_action } from '@prisma/client';

export interface PermissionDefinition {
  moduleCode: string;
  moduleLabel: string;
  action: sms_permissions_action;
  permissionKey: string;
  label: string;
  description: string;
  isLegacy?: boolean;
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  // Module: Organizations
  {
    moduleCode: 'organizations',
    moduleLabel: 'Organizations',
    action: sms_permissions_action.view,
    permissionKey: 'organizations.view',
    label: 'View Organizations',
    description: 'View organization profiles, settings, and business structures',
  },
  {
    moduleCode: 'organizations',
    moduleLabel: 'Organizations',
    action: sms_permissions_action.edit,
    permissionKey: 'organizations.edit',
    label: 'Edit Organization',
    description: 'Update organization branding, contact info, and tax profiles',
  },

  // Module: Branches
  {
    moduleCode: 'branches',
    moduleLabel: 'Branch Management',
    action: sms_permissions_action.view,
    permissionKey: 'branches.view',
    label: 'View Branches',
    description: 'View salon branch locations, facilities, and working hours',
  },
  {
    moduleCode: 'branches',
    moduleLabel: 'Branch Management',
    action: sms_permissions_action.create,
    permissionKey: 'branches.create',
    label: 'Create Branch',
    description: 'Create and initialize new salon branches and locations',
  },
  {
    moduleCode: 'branches',
    moduleLabel: 'Branch Management',
    action: sms_permissions_action.edit,
    permissionKey: 'branches.edit',
    label: 'Edit Branch',
    description: 'Update branch settings, manager assignments, and operating schedules',
  },
  {
    moduleCode: 'branches',
    moduleLabel: 'Branch Management',
    action: sms_permissions_action.delete,
    permissionKey: 'branches.delete',
    label: 'Delete/Close Branch',
    description: 'Deactivate or permanently close salon branches',
  },

  // Module: Roles & Permissions
  {
    moduleCode: 'roles',
    moduleLabel: 'Roles & Access Control',
    action: sms_permissions_action.view,
    permissionKey: 'roles.view',
    label: 'View Roles & Permissions',
    description: 'View organization roles, permission matrix, and branch restrictions',
  },
  {
    moduleCode: 'roles',
    moduleLabel: 'Roles & Access Control',
    action: sms_permissions_action.create,
    permissionKey: 'roles.create',
    label: 'Create Custom Role',
    description: 'Create new custom roles and clone permissions from existing roles',
  },
  {
    moduleCode: 'roles',
    moduleLabel: 'Roles & Access Control',
    action: sms_permissions_action.edit,
    permissionKey: 'roles.edit',
    label: 'Edit Role Permissions & Scope',
    description: 'Modify role permission assignments and branch access scopes',
  },
  {
    moduleCode: 'roles',
    moduleLabel: 'Roles & Access Control',
    action: sms_permissions_action.delete,
    permissionKey: 'roles.delete',
    label: 'Delete Custom Role',
    description: 'Soft delete custom roles with zero active user assignments',
  },

  // Module: Users
  {
    moduleCode: 'users',
    moduleLabel: 'User Management',
    action: sms_permissions_action.view,
    permissionKey: 'users.view',
    label: 'View Users',
    description: 'View user accounts, login status, and role assignments',
  },
  {
    moduleCode: 'users',
    moduleLabel: 'User Management',
    action: sms_permissions_action.create,
    permissionKey: 'users.create',
    label: 'Invite/Create Users',
    description: 'Invite new users and provision login credentials',
  },
  {
    moduleCode: 'users',
    moduleLabel: 'User Management',
    action: sms_permissions_action.edit,
    permissionKey: 'users.edit',
    label: 'Edit User Roles & Access',
    description: 'Assign or modify user roles, branch links, and status',
  },
  {
    moduleCode: 'users',
    moduleLabel: 'User Management',
    action: sms_permissions_action.delete,
    permissionKey: 'users.delete',
    label: 'Deactivate/Delete User',
    description: 'Deactivate user accounts and revoke system access',
  },

  // Module: Staff HR
  {
    moduleCode: 'staff',
    moduleLabel: 'Staff & HR Management',
    action: sms_permissions_action.view,
    permissionKey: 'staff.view',
    label: 'View Staff Directory',
    description: 'View staff employee profiles, designations, and qualifications',
  },
  {
    moduleCode: 'staff',
    moduleLabel: 'Staff & HR Management',
    action: sms_permissions_action.create,
    permissionKey: 'staff.create',
    label: 'Create Staff Record',
    description: 'Onboard new stylists, technicians, and salon employees',
  },
  {
    moduleCode: 'staff',
    moduleLabel: 'Staff & HR Management',
    action: sms_permissions_action.edit,
    permissionKey: 'staff.edit',
    label: 'Edit Staff Profile & Overrides',
    description: 'Update staff assignments, commissions, and permission overrides',
  },
  {
    moduleCode: 'staff',
    moduleLabel: 'Staff & HR Management',
    action: sms_permissions_action.delete,
    permissionKey: 'staff.delete',
    label: 'Terminate Staff Record',
    description: 'Terminate employment and remove staff active profiles',
  },
  {
    moduleCode: 'staff',
    moduleLabel: 'Staff & HR Management',
    action: sms_permissions_action.export,
    permissionKey: 'staff.export',
    label: 'Export Staff Data',
    description: 'Export staff rosters, attendance logs, and compensation summaries',
  },

  // Module: Appointments
  {
    moduleCode: 'appointments',
    moduleLabel: 'Appointments & Scheduling',
    action: sms_permissions_action.view,
    permissionKey: 'appointments.view',
    label: 'View Appointments',
    description: 'View salon appointment books, calendars, and booking records',
  },
  {
    moduleCode: 'appointments',
    moduleLabel: 'Appointments & Scheduling',
    action: sms_permissions_action.create,
    permissionKey: 'appointments.create',
    label: 'Book Appointments',
    description: 'Create new client bookings and service reservations',
  },
  {
    moduleCode: 'appointments',
    moduleLabel: 'Appointments & Scheduling',
    action: sms_permissions_action.edit,
    permissionKey: 'appointments.edit',
    label: 'Modify Appointments',
    description: 'Reschedule, reassign stylists, or update booking details',
  },
  {
    moduleCode: 'appointments',
    moduleLabel: 'Appointments & Scheduling',
    action: sms_permissions_action.delete,
    permissionKey: 'appointments.delete',
    label: 'Cancel Appointments',
    description: 'Cancel appointments and manage cancellation penalties',
  },
  {
    moduleCode: 'appointments',
    moduleLabel: 'Appointments & Scheduling',
    action: sms_permissions_action.approve,
    permissionKey: 'appointments.approve',
    label: 'Approve Appointments',
    description: 'Authorize online requests and VIP appointment bookings',
  },

  // Module: Services & Menu
  {
    moduleCode: 'services',
    moduleLabel: 'Services & Pricing',
    action: sms_permissions_action.view,
    permissionKey: 'services.view',
    label: 'View Service Catalog',
    description: 'View service menus, categories, pricing, and package bundles',
  },
  {
    moduleCode: 'services',
    moduleLabel: 'Services & Pricing',
    action: sms_permissions_action.create,
    permissionKey: 'services.create',
    label: 'Create Services',
    description: 'Add new salon services, packages, and service add-ons',
  },
  {
    moduleCode: 'services',
    moduleLabel: 'Services & Pricing',
    action: sms_permissions_action.edit,
    permissionKey: 'services.edit',
    label: 'Edit Services & Pricing',
    description: 'Adjust prices, branch overrides, durations, and resources',
  },
  {
    moduleCode: 'services',
    moduleLabel: 'Services & Pricing',
    action: sms_permissions_action.delete,
    permissionKey: 'services.delete',
    label: 'Delete Services',
    description: 'Discontinue or delete services and package bundles',
  },

  // Module: Inventory
  {
    moduleCode: 'inventory',
    moduleLabel: 'Inventory & Supplies',
    action: sms_permissions_action.view,
    permissionKey: 'inventory.view',
    label: 'View Inventory',
    description: 'View stock levels, consumption logs, and product catalogs',
  },
  {
    moduleCode: 'inventory',
    moduleLabel: 'Inventory & Supplies',
    action: sms_permissions_action.create,
    permissionKey: 'inventory.create',
    label: 'Add Inventory / Purchase',
    description: 'Receive purchase orders and add new inventory items',
  },
  {
    moduleCode: 'inventory',
    moduleLabel: 'Inventory & Supplies',
    action: sms_permissions_action.edit,
    permissionKey: 'inventory.edit',
    label: 'Adjust Stock & Pricing',
    description: 'Perform stock adjustments, audits, and threshold updates',
  },
  {
    moduleCode: 'inventory',
    moduleLabel: 'Inventory & Supplies',
    action: sms_permissions_action.delete,
    permissionKey: 'inventory.delete',
    label: 'Write-off Inventory',
    description: 'Dispose of expired/damaged stock and remove catalog products',
  },

  // Module: Customers CRM
  {
    moduleCode: 'customers',
    moduleLabel: 'Customer CRM',
    action: sms_permissions_action.view,
    permissionKey: 'customers.view',
    label: 'View Customers',
    description: 'View customer CRM profiles, service histories, and notes',
  },
  {
    moduleCode: 'customers',
    moduleLabel: 'Customer CRM',
    action: sms_permissions_action.create,
    permissionKey: 'customers.create',
    label: 'Register Customers',
    description: 'Create new customer profiles and loyalty memberships',
  },
  {
    moduleCode: 'customers',
    moduleLabel: 'Customer CRM',
    action: sms_permissions_action.edit,
    permissionKey: 'customers.edit',
    label: 'Edit Customer Profiles',
    description: 'Update customer contact info, allergies, notes, and tags',
  },
  {
    moduleCode: 'customers',
    moduleLabel: 'Customer CRM',
    action: sms_permissions_action.delete,
    permissionKey: 'customers.delete',
    label: 'Delete Customer Records',
    description: 'Anonymize or purge customer records in accordance with privacy laws',
  },
  {
    moduleCode: 'customers',
    moduleLabel: 'Customer CRM',
    action: sms_permissions_action.export,
    permissionKey: 'customers.export',
    label: 'Export Customer Directory',
    description: 'Export customer contact lists for reports and campaigns',
  },

  // Module: Billing & POS
  {
    moduleCode: 'billing',
    moduleLabel: 'Billing & POS',
    action: sms_permissions_action.view,
    permissionKey: 'billing.view',
    label: 'View Invoices & Billing',
    description: 'View transaction histories, register balances, and bills',
  },
  {
    moduleCode: 'billing',
    moduleLabel: 'Billing & POS',
    action: sms_permissions_action.create,
    permissionKey: 'billing.create',
    label: 'Create POS Invoices',
    description: 'Process checkouts, payments, and gift card purchases',
  },
  {
    moduleCode: 'billing',
    moduleLabel: 'Billing & POS',
    action: sms_permissions_action.edit,
    permissionKey: 'billing.edit',
    label: 'Apply Discounts & Adjustments',
    description: 'Modify line items, apply promotional discounts, and packages',
  },
  {
    moduleCode: 'billing',
    moduleLabel: 'Billing & POS',
    action: sms_permissions_action.approve,
    permissionKey: 'billing.approve',
    label: 'Approve Refunds & Voids',
    description: 'Authorize bill cancellations, invoice voids, and refund payouts',
  },
  {
    moduleCode: 'billing',
    moduleLabel: 'Billing & POS',
    action: sms_permissions_action.export,
    permissionKey: 'billing.export',
    label: 'Export Billing Reports',
    description: 'Export payment ledger, cashier closing reports, and tax statements',
  },
  {
    moduleCode: 'billing',
    moduleLabel: 'Billing & POS',
    action: sms_permissions_action.print,
    permissionKey: 'billing.print',
    label: 'Print Customer Receipts',
    description: 'Print thermal slips, paper invoices, and payment slips',
  },

  // Module: Reports & Analytics
  {
    moduleCode: 'reports',
    moduleLabel: 'Reports & Analytics',
    action: sms_permissions_action.view,
    permissionKey: 'reports.view',
    label: 'View Business Analytics',
    description: 'View revenue charts, service popularity, and utilization graphs',
  },
  {
    moduleCode: 'reports',
    moduleLabel: 'Reports & Analytics',
    action: sms_permissions_action.export,
    permissionKey: 'reports.export',
    label: 'Export Analytics Reports',
    description: 'Export analytical spreadsheets and business intelligence summaries',
  },
  {
    moduleCode: 'reports',
    moduleLabel: 'Reports & Analytics',
    action: sms_permissions_action.print,
    permissionKey: 'reports.print',
    label: 'Print Summary Reports',
    description: 'Print daily sales reconciliations and branch closing summaries',
  },

  // Module: Audit Logs
  {
    moduleCode: 'audit',
    moduleLabel: 'Audit & Compliance',
    action: sms_permissions_action.view,
    permissionKey: 'audit.view',
    label: 'View Audit Logs',
    description: 'Inspect security event trails, user activities, and data modifications',
  },
  {
    moduleCode: 'audit',
    moduleLabel: 'Audit & Compliance',
    action: sms_permissions_action.export,
    permissionKey: 'audit.export',
    label: 'Export Audit Logs',
    description: 'Export compliance reports and tamper-evident audit trails',
  },
];

/**
 * Seed or synchronize permissions idempotently into database
 */
export async function seedPermissions(prisma: PrismaClient): Promise<number> {
  let upsertedCount = 0;

  for (const perm of PERMISSION_DEFINITIONS) {
    await prisma.sms_permissions.upsert({
      where: { permissionKey: perm.permissionKey },
      update: {
        moduleCode: perm.moduleCode,
        moduleLabel: perm.moduleLabel,
        action: perm.action,
        label: perm.label,
        description: perm.description,
        isLegacy: perm.isLegacy ?? false,
      },
      create: {
        moduleCode: perm.moduleCode,
        moduleLabel: perm.moduleLabel,
        action: perm.action,
        permissionKey: perm.permissionKey,
        label: perm.label,
        description: perm.description,
        isLegacy: perm.isLegacy ?? false,
      },
    });
    upsertedCount++;
  }

  return upsertedCount;
}

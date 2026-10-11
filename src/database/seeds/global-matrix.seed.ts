import {
  PrismaClient,
  sms_roles_roleType,
  sms_roles_status,
  sms_rolePermissions_scope,
  sms_permissions_action,
} from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Access Control Matrix Legend:
 * F = Full control (create, edit, delete, approve, view, export, print)
 * M = Manage (create, edit, delete, view, export, print — no approval rights)
 * E = Edit (update records within scope, view)
 * V = View only (view)
 * O = Own records only (self-service: view, create, edit within own scope)
 * - = No access
 */
export type MatrixAccessLevel = 'F' | 'M' | 'E' | 'V' | 'O' | null;

export interface RolePersonaDefinition {
  code: 'SA' | 'BM' | 'FD' | 'ST' | 'IM' | 'AC' | 'MK' | 'CU';
  name: string;
  slug: string;
  description: string;
  defaultScope: sms_rolePermissions_scope;
}

export interface ModuleMatrixDefinition {
  number: number;
  phase: string;
  moduleCode: string;
  moduleLabel: string;
  description: string;
  accessMatrix: Record<RolePersonaDefinition['code'], MatrixAccessLevel>;
}

/**
 * 8 System Roles & Personas defined in Image 1
 */
export const GLOBAL_MATRIX_ROLES: RolePersonaDefinition[] = [
  {
    code: 'SA',
    name: 'Super Admin',
    slug: 'super-admin',
    description:
      'Platform Super Administrator with complete unrestricted authority across organizations and all platform modules.',
    defaultScope: sms_rolePermissions_scope.all_branches,
  },
  {
    code: 'SA',
    name: 'Owner',
    slug: 'owner',
    description:
      'Owns the entire platform across all branches. Configures organization settings, roles, integrations and has final approval authority on refunds, expenses and payroll.',
    defaultScope: sms_rolePermissions_scope.all_branches,
  },
  {
    code: 'BM',
    name: 'Branch Manager',
    slug: 'branch-manager',
    description:
      'Runs day-to-day operations for one branch: staff scheduling, approvals, local pricing visibility, and branch-level reporting. Cannot change global settings or roles.',
    defaultScope: sms_rolePermissions_scope.own_branch,
  },
  {
    code: 'FD',
    name: 'Front Desk / Receptionist',
    slug: 'front-desk',
    description:
      'The customer-facing operational role: books appointments, manages the queue, checks customers in and out, and processes payments at the counter.',
    defaultScope: sms_rolePermissions_scope.own_branch,
  },
  {
    code: 'ST',
    name: 'Service Staff',
    slug: 'service-staff',
    description:
      'Service delivery staff (stylist, therapist, technician, etc.). Manages their own schedule requests, sees their own commission and bookings, and runs the live service session.',
    defaultScope: sms_rolePermissions_scope.own_branch,
  },
  {
    code: 'IM',
    name: 'Inventory & Purchase Manager',
    slug: 'inventory-manager',
    description:
      'Owns the supply chain: products, suppliers, purchase orders and stock levels across branches.',
    defaultScope: sms_rolePermissions_scope.all_branches,
  },
  {
    code: 'AC',
    name: 'Accountant / Finance',
    slug: 'accountant',
    description:
      'Owns the money: expenses, commission calculation, payroll processing, day-closing reconciliation and financial reporting.',
    defaultScope: sms_rolePermissions_scope.all_branches,
  },
  {
    code: 'MK',
    name: 'Marketing Manager',
    slug: 'marketing-manager',
    description:
      'Owns customer engagement: campaigns, loyalty, discounts/coupons and review responses.',
    defaultScope: sms_rolePermissions_scope.all_branches,
  },
  {
    code: 'CU',
    name: 'Customer (Portal)',
    slug: 'customer',
    description:
      'The end customer, self-service only, through the Customer Portal — books, pays, and manages their own membership, loyalty and reviews.',
    defaultScope: sms_rolePermissions_scope.own_branch,
  },
];

/**
 * 54 Complete System Modules across 16 Phases defined in Images 2, 3, and 4
 */
export const GLOBAL_MATRIX_MODULES: ModuleMatrixDefinition[] = [
  // ==========================================
  // Phase 1 — Foundation
  // ==========================================
  {
    number: 1,
    phase: 'Phase 1 — Foundation',
    moduleCode: 'organization',
    moduleLabel: 'Organization / Business Setup',
    description: 'Organization structure, global settings, and configuration',
    accessMatrix: { SA: 'F', BM: 'V', FD: null, ST: null, IM: null, AC: 'V', MK: null, CU: null },
  },
  {
    number: 2,
    phase: 'Phase 1 — Foundation',
    moduleCode: 'branch',
    moduleLabel: 'Branch Management',
    description: 'Branch locations, facilities, working hours, and branch profiles',
    accessMatrix: { SA: 'F', BM: 'E', FD: 'V', ST: null, IM: null, AC: 'V', MK: null, CU: null },
  },
  {
    number: 3,
    phase: 'Phase 1 — Foundation',
    moduleCode: 'role-permission',
    moduleLabel: 'Role & Permission Management',
    description: 'System roles, permission catalogs, and access matrix assignments',
    accessMatrix: { SA: 'F', BM: null, FD: null, ST: null, IM: null, AC: null, MK: null, CU: null },
  },
  {
    number: 4,
    phase: 'Phase 1 — Foundation',
    moduleCode: 'user',
    moduleLabel: 'User Management',
    description: 'User authentication accounts, credentials, and user profiles',
    accessMatrix: { SA: 'F', BM: 'M', FD: null, ST: 'O', IM: null, AC: null, MK: null, CU: 'O' },
  },

  // ==========================================
  // Phase 2 — People / Staff
  // ==========================================
  {
    number: 5,
    phase: 'Phase 2 — People / Staff',
    moduleCode: 'staff',
    moduleLabel: 'Employee / Staff Management',
    description: 'Staff directory, employment records, contracts, and profiles',
    accessMatrix: { SA: 'F', BM: 'M', FD: 'V', ST: 'O', IM: null, AC: 'V', MK: null, CU: null },
  },
  {
    number: 6,
    phase: 'Phase 2 — People / Staff',
    moduleCode: 'staff-designation',
    moduleLabel: 'Staff Designation & Service Assignment',
    description: 'Job titles, skill capabilities, and service catalog mapping',
    accessMatrix: { SA: 'F', BM: 'M', FD: 'V', ST: 'O', IM: null, AC: null, MK: null, CU: null },
  },
  {
    number: 7,
    phase: 'Phase 2 — People / Staff',
    moduleCode: 'staff-scheduling',
    moduleLabel: 'Staff Scheduling',
    description: 'Work shifts, branch roster assignments, and schedules',
    accessMatrix: { SA: 'F', BM: 'M', FD: 'V', ST: 'O', IM: null, AC: null, MK: null, CU: null },
  },
  {
    number: 8,
    phase: 'Phase 2 — People / Staff',
    moduleCode: 'staff-attendance',
    moduleLabel: 'Staff Attendance',
    description: 'Daily check-ins, check-outs, timesheets, and overtime tracking',
    accessMatrix: { SA: 'F', BM: 'M', FD: null, ST: 'O', IM: null, AC: 'V', MK: null, CU: null },
  },
  {
    number: 9,
    phase: 'Phase 2 — People / Staff',
    moduleCode: 'staff-leave',
    moduleLabel: 'Staff Leave Management',
    description: 'Time-off requests, vacation approvals, and leave balance tracking',
    accessMatrix: { SA: 'F', BM: 'M', FD: null, ST: 'O', IM: null, AC: 'V', MK: null, CU: null },
  },

  // ==========================================
  // Phase 3 — Salon Services
  // ==========================================
  {
    number: 10,
    phase: 'Phase 3 — Salon Services',
    moduleCode: 'service-category',
    moduleLabel: 'Service Category Management',
    description: 'Service taxonomy, hierarchy, and department classification',
    accessMatrix: { SA: 'F', BM: 'V', FD: null, ST: null, IM: null, AC: null, MK: 'V', CU: null },
  },
  {
    number: 11,
    phase: 'Phase 3 — Salon Services',
    moduleCode: 'service',
    moduleLabel: 'Service Management',
    description: 'Service catalog, descriptions, standard durations, and pricing',
    accessMatrix: { SA: 'F', BM: 'M', FD: 'V', ST: 'V', IM: null, AC: null, MK: 'V', CU: null },
  },
  {
    number: 12,
    phase: 'Phase 3 — Salon Services',
    moduleCode: 'service-package',
    moduleLabel: 'Service Package Management',
    description: 'Bundled treatments, combo sessions, and seasonal packages',
    accessMatrix: { SA: 'F', BM: 'M', FD: 'V', ST: null, IM: null, AC: null, MK: 'M', CU: 'O' },
  },
  {
    number: 13,
    phase: 'Phase 3 — Salon Services',
    moduleCode: 'addon',
    moduleLabel: 'Add-on Management',
    description: 'Treatment upgrades, extra sessions, and quick enhancements',
    accessMatrix: { SA: 'F', BM: 'M', FD: 'V', ST: null, IM: null, AC: null, MK: 'V', CU: null },
  },

  // ==========================================
  // Phase 4 — Salon Resources
  // ==========================================
  {
    number: 14,
    phase: 'Phase 4 — Salon Resources',
    moduleCode: 'resource',
    moduleLabel: 'Resource Management',
    description: 'Chairs, treatment rooms, spa cabins, and equipment scheduling',
    accessMatrix: { SA: 'F', BM: 'M', FD: 'V', ST: 'V', IM: null, AC: null, MK: null, CU: null },
  },

  // ==========================================
  // Phase 5 — Customer / CRM
  // ==========================================
  {
    number: 15,
    phase: 'Phase 5 — Customer / CRM',
    moduleCode: 'customer',
    moduleLabel: 'Customer Management',
    description: 'Client records, contact details, tags, and client profiles',
    accessMatrix: { SA: 'F', BM: 'M', FD: 'M', ST: 'V', IM: null, AC: null, MK: 'V', CU: 'O' },
  },
  {
    number: 16,
    phase: 'Phase 5 — Customer / CRM',
    moduleCode: 'customer-crm',
    moduleLabel: 'Customer CRM',
    description: 'Client preferences, treatment notes, formulas, and history',
    accessMatrix: { SA: 'F', BM: 'V', FD: 'M', ST: 'V', IM: null, AC: null, MK: 'M', CU: null },
  },
  {
    number: 17,
    phase: 'Phase 5 — Customer / CRM',
    moduleCode: 'lead',
    moduleLabel: 'Lead Management',
    description: 'Prospect pipeline, inquiries, consultations, and conversion follow-up',
    accessMatrix: { SA: 'F', BM: 'V', FD: 'M', ST: null, IM: null, AC: null, MK: 'M', CU: null },
  },

  // ==========================================
  // Phase 6 — Appointment Engine
  // ==========================================
  {
    number: 18,
    phase: 'Phase 6 — Appointment Engine',
    moduleCode: 'appointment',
    moduleLabel: 'Appointment Management',
    description: 'Bookings, rescheduling, cancellations, and confirmations',
    accessMatrix: { SA: 'F', BM: 'M', FD: 'M', ST: 'O', IM: null, AC: null, MK: null, CU: 'O' },
  },
  {
    number: 19,
    phase: 'Phase 6 — Appointment Engine',
    moduleCode: 'calendar',
    moduleLabel: 'Calendar Management',
    description: 'Master salon calendar, stylist timelines, and daily grid views',
    accessMatrix: { SA: 'F', BM: 'V', FD: 'M', ST: 'O', IM: null, AC: null, MK: null, CU: null },
  },
  {
    number: 20,
    phase: 'Phase 6 — Appointment Engine',
    moduleCode: 'walkin-queue',
    moduleLabel: 'Walk-in & Queue Management',
    description: 'Waitlist tracking, token dispensing, queue display, and check-in',
    accessMatrix: { SA: 'F', BM: 'V', FD: 'M', ST: 'O', IM: null, AC: null, MK: null, CU: null },
  },

  // ==========================================
  // Phase 7 — Service Execution
  // ==========================================
  {
    number: 21,
    phase: 'Phase 7 — Service Execution',
    moduleCode: 'service-session',
    moduleLabel: 'Service Check-in / Service Session',
    description: 'Live chair session timer, in-progress updates, and completion',
    accessMatrix: { SA: 'F', BM: 'V', FD: 'V', ST: 'M', IM: null, AC: null, MK: null, CU: null },
  },
  {
    number: 22,
    phase: 'Phase 7 — Service Execution',
    moduleCode: 'service-history',
    moduleLabel: 'Service History',
    description: 'Past treatments, previous stylist notes, and audit logs',
    accessMatrix: { SA: 'F', BM: 'V', FD: 'V', ST: 'V', IM: null, AC: null, MK: null, CU: 'O' },
  },

  // ==========================================
  // Phase 8 — Inventory
  // ==========================================
  {
    number: 23,
    phase: 'Phase 8 — Inventory',
    moduleCode: 'product',
    moduleLabel: 'Product & Product Category',
    description: 'Retail products, professional supplies, and taxonomy',
    accessMatrix: { SA: 'F', BM: 'V', FD: 'V', ST: null, IM: 'M', AC: null, MK: null, CU: null },
  },
  {
    number: 24,
    phase: 'Phase 8 — Inventory',
    moduleCode: 'supplier',
    moduleLabel: 'Supplier Management',
    description: 'Vendors, supplier catalogs, procurement contacts, and terms',
    accessMatrix: { SA: 'F', BM: null, FD: null, ST: null, IM: 'M', AC: 'V', MK: null, CU: null },
  },
  {
    number: 25,
    phase: 'Phase 8 — Inventory',
    moduleCode: 'purchase',
    moduleLabel: 'Purchase Management',
    description: 'Purchase orders, delivery receipts, invoices, and restock tracking',
    accessMatrix: { SA: 'F', BM: 'V', FD: null, ST: null, IM: 'M', AC: 'V', MK: null, CU: null },
  },
  {
    number: 26,
    phase: 'Phase 8 — Inventory',
    moduleCode: 'inventory',
    moduleLabel: 'Inventory Management',
    description: 'Stock on hand, batch tracking, expiry dates, and branch stock transfers',
    accessMatrix: { SA: 'F', BM: 'V', FD: null, ST: 'V', IM: 'M', AC: null, MK: null, CU: null },
  },
  {
    number: 27,
    phase: 'Phase 8 — Inventory',
    moduleCode: 'product-consumption',
    moduleLabel: 'Service Product Consumption',
    description: 'In-salon backbar product usage per service and wastage logging',
    accessMatrix: { SA: 'F', BM: 'V', FD: null, ST: 'O', IM: 'M', AC: 'V', MK: null, CU: null },
  },

  // ==========================================
  // Phase 9 — POS & Billing
  // ==========================================
  {
    number: 28,
    phase: 'Phase 9 — POS & Billing',
    moduleCode: 'pos',
    moduleLabel: 'POS / Billing',
    description: 'Checkout counter, invoice generation, tax computation, and items',
    accessMatrix: { SA: 'F', BM: 'V', FD: 'M', ST: null, IM: null, AC: 'V', MK: null, CU: 'O' },
  },
  {
    number: 29,
    phase: 'Phase 9 — POS & Billing',
    moduleCode: 'payment',
    moduleLabel: 'Payment Management',
    description: 'Cash, cards, digital wallets, bank transfers, and gateway capture',
    accessMatrix: { SA: 'F', BM: 'V', FD: 'M', ST: null, IM: null, AC: 'M', MK: null, CU: null },
  },
  {
    number: 30,
    phase: 'Phase 9 — POS & Billing',
    moduleCode: 'split-payment',
    moduleLabel: 'Split Payment',
    description: 'Multi-tender payment division, bill splitting, and balance settlement',
    accessMatrix: { SA: 'F', BM: 'V', FD: 'M', ST: null, IM: null, AC: 'V', MK: null, CU: null },
  },
  {
    number: 31,
    phase: 'Phase 9 — POS & Billing',
    moduleCode: 'refund',
    moduleLabel: 'Refund Management',
    description: 'Refund processing, credit notes, transaction reversals, and audits',
    accessMatrix: { SA: 'F', BM: 'M', FD: 'E', ST: null, IM: null, AC: 'M', MK: null, CU: null },
  },

  // ==========================================
  // Phase 10 — Membership & Customer Retention
  // ==========================================
  {
    number: 32,
    phase: 'Phase 10 — Membership & Customer Retention',
    moduleCode: 'membership',
    moduleLabel: 'Membership Management',
    description: 'Tiered memberships, recurring privileges, and subscriptions',
    accessMatrix: { SA: 'F', BM: 'M', FD: 'M', ST: null, IM: null, AC: 'V', MK: 'V', CU: 'O' },
  },
  {
    number: 33,
    phase: 'Phase 10 — Membership & Customer Retention',
    moduleCode: 'loyalty',
    moduleLabel: 'Loyalty Management',
    description: 'Points accumulation, reward tiers, and client redemptions',
    accessMatrix: { SA: 'F', BM: 'V', FD: 'V', ST: null, IM: null, AC: null, MK: 'M', CU: 'O' },
  },
  {
    number: 34,
    phase: 'Phase 10 — Membership & Customer Retention',
    moduleCode: 'discount',
    moduleLabel: 'Discount & Coupon Management',
    description: 'Promotional codes, volume discounts, vouchers, and campaigns',
    accessMatrix: { SA: 'F', BM: 'V', FD: 'V', ST: null, IM: null, AC: null, MK: 'M', CU: null },
  },
  {
    number: 35,
    phase: 'Phase 10 — Membership & Customer Retention',
    moduleCode: 'gift-card',
    moduleLabel: 'Gift Card Management',
    description: 'Digital gift cards, balance tracking, issuance, and redemption',
    accessMatrix: { SA: 'F', BM: 'V', FD: 'M', ST: null, IM: null, AC: 'V', MK: 'V', CU: 'O' },
  },

  // ==========================================
  // Phase 11 — Finance
  // ==========================================
  {
    number: 36,
    phase: 'Phase 11 — Finance',
    moduleCode: 'expense',
    moduleLabel: 'Expense Management',
    description: 'Salon operational expenses, vendor bills, petty cash, and receipts',
    accessMatrix: { SA: 'F', BM: 'M', FD: null, ST: null, IM: null, AC: 'M', MK: null, CU: null },
  },
  {
    number: 37,
    phase: 'Phase 11 — Finance',
    moduleCode: 'commission',
    moduleLabel: 'Commission Management',
    description: 'Stylist tier percentages, service commissions, and product bonuses',
    accessMatrix: { SA: 'F', BM: 'V', FD: null, ST: 'V', IM: null, AC: 'M', MK: null, CU: null },
  },
  {
    number: 38,
    phase: 'Phase 11 — Finance',
    moduleCode: 'payroll',
    moduleLabel: 'Payroll Management',
    description: 'Salary slips, tax withholdings, deductions, and payout batches',
    accessMatrix: { SA: 'F', BM: null, FD: null, ST: 'V', IM: null, AC: 'M', MK: null, CU: null },
  },
  {
    number: 39,
    phase: 'Phase 11 — Finance',
    moduleCode: 'cash-register',
    moduleLabel: 'Cash Register / Day Closing',
    description: 'Till open/close floats, drawer audits, and end-of-day reconciliation',
    accessMatrix: { SA: 'F', BM: 'M', FD: 'M', ST: null, IM: null, AC: 'V', MK: null, CU: null },
  },

  // ==========================================
  // Phase 12 — Marketing & Communication
  // ==========================================
  {
    number: 40,
    phase: 'Phase 12 — Marketing & Communication',
    moduleCode: 'notification',
    moduleLabel: 'Notification Management',
    description: 'Automated SMS, WhatsApp, and email appointment reminders',
    accessMatrix: { SA: 'F', BM: 'V', FD: null, ST: null, IM: null, AC: null, MK: 'M', CU: 'O' },
  },
  {
    number: 41,
    phase: 'Phase 12 — Marketing & Communication',
    moduleCode: 'marketing',
    moduleLabel: 'Marketing & Campaigns',
    description: 'Targeted broadcast campaigns, client segmentation, and engagement',
    accessMatrix: { SA: 'F', BM: 'V', FD: null, ST: null, IM: null, AC: null, MK: 'F', CU: null },
  },
  {
    number: 42,
    phase: 'Phase 12 — Marketing & Communication',
    moduleCode: 'customer-followup',
    moduleLabel: 'Customer Follow-up / Automation',
    description: 'Post-visit check-ins, rebooking reminders, and birthday offers',
    accessMatrix: { SA: 'F', BM: 'V', FD: 'V', ST: null, IM: null, AC: null, MK: 'M', CU: null },
  },

  // ==========================================
  // Phase 13 — Customer Experience
  // ==========================================
  {
    number: 43,
    phase: 'Phase 13 — Customer Experience',
    moduleCode: 'customer-portal',
    moduleLabel: 'Customer Portal',
    description: 'Customer online self-service booking, history, and profile management',
    accessMatrix: { SA: 'F', BM: null, FD: null, ST: null, IM: null, AC: null, MK: 'V', CU: 'O' },
  },
  {
    number: 44,
    phase: 'Phase 13 — Customer Experience',
    moduleCode: 'reviews',
    moduleLabel: 'Reviews & Ratings',
    description: 'Client star ratings, stylist reviews, feedback moderation, and badges',
    accessMatrix: { SA: 'F', BM: 'V', FD: null, ST: 'V', IM: null, AC: null, MK: 'M', CU: 'O' },
  },
  {
    number: 45,
    phase: 'Phase 13 — Customer Experience',
    moduleCode: 'feedback',
    moduleLabel: 'Feedback & Complaints',
    description: 'Dispute resolution, complaint tickets, manager escalation, and redress',
    accessMatrix: { SA: 'F', BM: 'M', FD: 'V', ST: null, IM: null, AC: null, MK: 'V', CU: 'O' },
  },

  // ==========================================
  // Phase 14 — Assets & Operations
  // ==========================================
  {
    number: 46,
    phase: 'Phase 14 — Assets & Operations',
    moduleCode: 'asset',
    moduleLabel: 'Asset / Equipment Management',
    description: 'Salon chairs, dryers, lasers, maintenance logs, and asset value',
    accessMatrix: { SA: 'F', BM: 'M', FD: null, ST: null, IM: 'V', AC: 'V', MK: null, CU: null },
  },
  {
    number: 47,
    phase: 'Phase 14 — Assets & Operations',
    moduleCode: 'task',
    moduleLabel: 'Task Management',
    description: 'Daily cleaning checklists, opening/closing duties, and staff tasks',
    accessMatrix: { SA: 'F', BM: 'M', FD: 'O', ST: 'O', IM: null, AC: null, MK: null, CU: null },
  },

  // ==========================================
  // Phase 15 — Reporting
  // ==========================================
  {
    number: 48,
    phase: 'Phase 15 — Reporting',
    moduleCode: 'reports',
    moduleLabel: 'Reports & Analytics',
    description: 'Sales summaries, stylist productivity, occupancy, and inventory stats',
    accessMatrix: { SA: 'F', BM: 'V', FD: null, ST: null, IM: 'V', AC: 'V', MK: 'V', CU: null },
  },
  {
    number: 49,
    phase: 'Phase 15 — Reporting',
    moduleCode: 'analytics',
    moduleLabel: 'Business Analytics',
    description: 'Cross-branch revenue KPIs, forecast trends, and executive dashboards',
    accessMatrix: { SA: 'F', BM: 'V', FD: null, ST: null, IM: null, AC: 'V', MK: 'V', CU: null },
  },

  // ==========================================
  // Phase 16 — Administration
  // ==========================================
  {
    number: 50,
    phase: 'Phase 16 — Administration',
    moduleCode: 'audit',
    moduleLabel: 'Audit & Activity Log',
    description: 'Security audit trail, record modification tracking, and login events',
    accessMatrix: { SA: 'F', BM: null, FD: null, ST: null, IM: null, AC: null, MK: null, CU: null },
  },
  {
    number: 51,
    phase: 'Phase 16 — Administration',
    moduleCode: 'settings',
    moduleLabel: 'System Settings',
    description: 'Global organization parameters, regional currency, taxes, and localization',
    accessMatrix: { SA: 'F', BM: 'V', FD: null, ST: null, IM: null, AC: null, MK: null, CU: null },
  },
  {
    number: 52,
    phase: 'Phase 16 — Administration',
    moduleCode: 'integrations',
    moduleLabel: 'Integrations',
    description: 'Payment processors, SMS/WhatsApp gateways, accounting sync, and webhooks',
    accessMatrix: { SA: 'F', BM: null, FD: null, ST: null, IM: null, AC: null, MK: null, CU: null },
  },
  {
    number: 53,
    phase: 'Phase 16 — Administration',
    moduleCode: 'backup',
    moduleLabel: 'Backup & Data Management',
    description: 'Database snapshot archives, data export backups, and retention rules',
    accessMatrix: { SA: 'F', BM: null, FD: null, ST: null, IM: null, AC: null, MK: null, CU: null },
  },
  {
    number: 54,
    phase: 'Phase 16 — Administration',
    moduleCode: 'api-developer',
    moduleLabel: 'API & Developer Management',
    description: 'API access keys, rate limits, developer credentials, and documentation',
    accessMatrix: { SA: 'F', BM: null, FD: null, ST: null, IM: null, AC: null, MK: null, CU: null },
  },
];

/**
 * Maps an access level to the set of actions allowed for that permission.
 */
export function getActionsForAccessLevel(level: MatrixAccessLevel): sms_permissions_action[] {
  switch (level) {
    case 'F':
      // Full control — create, edit, delete, approve, view, export, print
      return [
        sms_permissions_action.view,
        sms_permissions_action.create,
        sms_permissions_action.edit,
        sms_permissions_action.delete,
        sms_permissions_action.approve,
        sms_permissions_action.export,
        sms_permissions_action.print,
      ];
    case 'M':
      // Manage — create, edit, delete, view, export, print (no approve rights)
      return [
        sms_permissions_action.view,
        sms_permissions_action.create,
        sms_permissions_action.edit,
        sms_permissions_action.delete,
        sms_permissions_action.export,
        sms_permissions_action.print,
      ];
    case 'E':
      // Edit — update records within scope, view
      return [
        sms_permissions_action.view,
        sms_permissions_action.edit,
      ];
    case 'V':
      // View only
      return [
        sms_permissions_action.view,
      ];
    case 'O':
      // Own records only (self-service)
      return [
        sms_permissions_action.view,
        sms_permissions_action.create,
        sms_permissions_action.edit,
      ];
    case null:
    default:
      return [];
  }
}

/**
 * Step 1: Seeds all 54 modules and their respective permissions into sms_permissions table.
 */
export async function seedGlobalMatrixPermissions(prisma: PrismaClient): Promise<{
  modulesCount: number;
  permissionsCount: number;
}> {
  console.log(`[Seed Matrix] Registering 54 modules and permission definitions...`);

  const allActions: sms_permissions_action[] = [
    sms_permissions_action.view,
    sms_permissions_action.create,
    sms_permissions_action.edit,
    sms_permissions_action.delete,
    sms_permissions_action.approve,
    sms_permissions_action.export,
    sms_permissions_action.print,
  ];

  let registeredCount = 0;

  for (const mod of GLOBAL_MATRIX_MODULES) {
    for (const action of allActions) {
      const permissionKey = `${mod.moduleCode}.${action}`;
      const actionLabel = action.charAt(0).toUpperCase() + action.slice(1);
      const label = `${actionLabel} ${mod.moduleLabel}`;
      const description = `${actionLabel} access for ${mod.moduleLabel} (${mod.phase})`;

      await prisma.sms_permissions.upsert({
        where: { permissionKey },
        update: {
          moduleCode: mod.moduleCode,
          moduleLabel: mod.moduleLabel,
          action,
          label,
          description,
          isLegacy: false,
        },
        create: {
          moduleCode: mod.moduleCode,
          moduleLabel: mod.moduleLabel,
          action,
          permissionKey,
          label,
          description,
          isLegacy: false,
        },
      });

      registeredCount++;
    }
  }

  console.log(
    `[Seed Matrix] Successfully registered ${GLOBAL_MATRIX_MODULES.length} modules and ${registeredCount} granular permissions.`,
  );
  return {
    modulesCount: GLOBAL_MATRIX_MODULES.length,
    permissionsCount: registeredCount,
  };
}

/**
 * Step 2: Idempotently creates the 8 roles and maps the permissions for a specific organization (or global null).
 */
export async function seedOrganizationGlobalMatrixRoles(
  prisma: PrismaClient,
  organizationId: string | null = null,
): Promise<{ rolesCreated: number; permissionsAssigned: number }> {
  // Fetch all registered permissions into memory map for fast key lookup
  const allPermissions = await prisma.sms_permissions.findMany({
    where: { isLegacy: false },
    select: { id: true, moduleCode: true, action: true, permissionKey: true },
  });

  const permissionLookup = new Map<string, string>();
  for (const perm of allPermissions) {
    permissionLookup.set(perm.permissionKey, perm.id);
  }

  let rolesCreated = 0;
  let permissionsAssigned = 0;

  for (const roleDef of GLOBAL_MATRIX_ROLES) {
    // 1. Find or create the role
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
    } else {
      // Keep name & description up-to-date with matrix definition
      await prisma.sms_roles.update({
        where: { id: role.id },
        data: {
          name: roleDef.name,
          description: roleDef.description,
          status: sms_roles_status.active,
        },
      });
    }

    // 2. Compute permission IDs to assign based on the access matrix
    const targetPermissionIds: string[] = [];

    for (const mod of GLOBAL_MATRIX_MODULES) {
      const accessLevel = mod.accessMatrix[roleDef.code];
      const allowedActions = getActionsForAccessLevel(accessLevel);

      for (const action of allowedActions) {
        const key = `${mod.moduleCode}.${action}`;
        const permId = permissionLookup.get(key);
        if (permId) {
          targetPermissionIds.push(permId);
        }
      }
    }

    // 3. Upsert role permission mappings
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
      } else if (existing.scope !== roleDef.defaultScope) {
        // Synchronize default scope if altered
        await prisma.sms_rolePermissions.update({
          where: { id: existing.id },
          data: { scope: roleDef.defaultScope },
        });
      }
    }
  }

  return { rolesCreated, permissionsAssigned };
}

/**
 * Step 3: Applies the Global Matrix across all active organizations in the database.
 */
export async function seedAllOrganizationsGlobalMatrix(prisma: PrismaClient) {
  console.log(`[Seed Matrix] Synchronizing Global Role & Permission Matrix across all organizations...`);

  // 1. Sync catalog permissions first
  await seedGlobalMatrixPermissions(prisma);

  // 2. Clean up any existing duplicate roles that were tied to individual organizations
  const existingOrgRoles = await prisma.sms_roles.findMany({
    where: { organizationId: { not: null }, roleType: sms_roles_roleType.system },
    select: { id: true },
  });
  if (existingOrgRoles.length > 0) {
    const orgRoleIds = existingOrgRoles.map((r) => r.id);
    await prisma.sms_userRoles.deleteMany({ where: { roleId: { in: orgRoleIds } } });
    await prisma.sms_rolePermissions.deleteMany({ where: { roleId: { in: orgRoleIds } } });
    await prisma.sms_roles.deleteMany({ where: { id: { in: orgRoleIds } } });
    console.log(`[Seed Matrix] Removed ${existingOrgRoles.length} duplicate organization-level roles.`);
  }

  // 3. Seed the single set of global system roles (organizationId: null)
  const globalResult = await seedOrganizationGlobalMatrixRoles(prisma, null);
  console.log(
    `[Seed Matrix] Global system roles: ${globalResult.rolesCreated} created, ${globalResult.permissionsAssigned} permissions assigned.`,
  );

  // 4. Restore user roles if backup exists (pointing to global system roles)
  const backupFile = path.join(__dirname, 'user-roles-backup.json');
  if (fs.existsSync(backupFile)) {
    try {
      const backupRaw = fs.readFileSync(backupFile, 'utf-8');
      const backup = JSON.parse(backupRaw);
      console.log(`[Seed Matrix] Found ${backup.length} user role assignments to restore.`);
      for (const item of backup) {
        // Find matching global role
        const role = await prisma.sms_roles.findFirst({
          where: {
            organizationId: null,
            slug: item.roleSlug,
            deletedAt: null,
          },
        });
        if (role) {
          await prisma.sms_userRoles.upsert({
            where: {
              userId_roleId: {
                userId: item.userId,
                roleId: role.id,
              },
            },
            update: { isPrimary: item.isPrimary ?? true },
            create: {
              userId: item.userId,
              roleId: role.id,
              isPrimary: item.isPrimary ?? true,
            },
          });
        }
      }
      console.log(`[Seed Matrix] User role assignments restored successfully.`);
    } catch (e) {
      console.warn(`[Seed Matrix] Warning during user roles restoration:`, e);
    }
  }

  console.log(`[Seed Matrix] Global Role & Permission Matrix synchronization completed.`);
}

/**
 * Standalone Execution Handler:
 * Ready to run when the user explicitly triggers database synchronization.
 */
async function main() {
  const prisma = new PrismaClient();
  try {
    console.log('=====================================================');
    console.log('   SMS 54-Module Global Role & Permission Seed       ');
    console.log('=====================================================');
    await seedAllOrganizationsGlobalMatrix(prisma);
  } catch (error) {
    console.error('[Seed Matrix Execution Error]:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Enable standalone CLI execution (e.g. `ts-node src/database/seeds/global-matrix.seed.ts`)
if (require.main === module) {
  main();
}

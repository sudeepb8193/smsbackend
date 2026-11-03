import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { EffectivePermissionResolverService } from '../../role-permission/services/effective-permission-resolver.service';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { Prisma } from '@prisma/client';

export class SchedulingAccessHelper {
  private static readonly logger = new Logger(SchedulingAccessHelper.name);

  /**
   * Resolve effective organization ID
   */
  static resolveOrgId(user?: AuthenticatedUser, queryOrgId?: string): string {
    const roles = (user?.roles || []).map((r) =>
      r.toLowerCase().replace(/_/g, '-'),
    );
    const isSuperAdmin = roles.includes('super-admin');
    return (isSuperAdmin && queryOrgId) || queryOrgId || user?.organizationId || '';
  }

  /**
   * Record audit log entry in sms_auditLogs
   */
  static async recordAuditLog(
    prisma: PrismaService,
    organizationId: string,
    performedById: string | undefined,
    action: string,
    oldValue: any,
    newValue: any,
  ) {
    try {
      await prisma.sms_auditLogs.create({
        data: {
          organizationId,
          performedById: performedById || null,
          action,
          oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : Prisma.JsonNull,
          newValue: newValue ? JSON.parse(JSON.stringify(newValue)) : Prisma.JsonNull,
        },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to record audit log for ${action}: ${err.message}`);
    }
  }

  /**
   * Validate that staff exists, belongs to organization, and return staff with branch assignments
   */
  static async validateStaff(
    prisma: PrismaService,
    staffId: string,
    organizationId: string,
  ) {
    const staff = await prisma.sms_staff.findFirst({
      where: {
        id: staffId,
        organizationId,
        deletedAt: null,
      },
      include: {
        homeBranch: {
          select: { id: true, name: true, code: true, status: true },
        },
        staffBranchAssignments: {
          where: {
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gte: new Date() } },
            ],
          },
          include: {
            branch: {
              select: { id: true, name: true, code: true, status: true },
            },
          },
        },
        user: {
          select: { id: true, email: true, displayName: true },
        },
        staffContacts: true,
      },
    });

    if (!staff) {
      throw new NotFoundException({
        code: 'STAFF_NOT_FOUND',
        message: 'Employee record not found in this organization',
      });
    }

    return staff;
  }

  /**
   * Check if staff is authorized to work at a target branch
   */
  static isStaffEligibleForBranch(staff: any, targetBranchId: string): boolean {
    if (!targetBranchId) return true;
    if (staff.homeBranchId === targetBranchId) return true;
    const secondaryMatches = (staff.staffBranchAssignments || []).some(
      (a: any) => a.branchId === targetBranchId,
    );
    return secondaryMatches;
  }

  /**
   * Validate user access to target staff and branch (RBAC, branch scoping, own-record)
   */
  static async validateUserAccess(
    prisma: PrismaService,
    permissionResolver: EffectivePermissionResolverService | undefined,
    user: AuthenticatedUser,
    organizationId: string,
    requiredPermission: string,
    targetBranchId?: string,
    targetStaff?: any,
  ) {
    if (!user) {
      throw new ForbiddenException({
        code: 'AUTH_REQUIRED',
        message: 'User authentication required',
      });
    }

    const roles = (user.roles || []).map((r) =>
      r.toUpperCase().replace(/[\s_-]+/g, '_'),
    );

    const isSuperAdmin = roles.some((r) =>
      ['SUPER_ADMIN', 'SUPERADMIN', 'SUPER-ADMIN'].includes(r),
    );
    if (isSuperAdmin) return;

    // Check organization boundary
    if (user.organizationId && user.organizationId !== organizationId) {
      throw new ForbiddenException({
        code: 'CROSS_ORGANIZATION_ACCESS_DENIED',
        message: 'You cannot access or modify scheduling data of another organization',
      });
    }

    const isOwner = roles.includes('OWNER');
    const isServiceStaff =
      (roles.includes('SERVICE_STAFF') || roles.includes('STAFF')) &&
      !roles.some((r) =>
        ['SUPER_ADMIN', 'SUPERADMIN', 'OWNER', 'BRANCH_MANAGER', 'ACCOUNTANT', 'FRONT_DESK'].includes(r),
      );

    // 1. Strict Own-Record Check for Service Staff
    if (isServiceStaff && targetStaff) {
      const isOwn =
        targetStaff.userId === user.id ||
        (user.email &&
          targetStaff.staffContacts?.personalEmail?.toLowerCase() ===
            user.email.toLowerCase());

      if (!isOwn) {
        throw new ForbiddenException({
          code: 'FORBIDDEN_OWN_RECORD_ONLY',
          message: 'Service staff are only permitted to view and manage their own schedule and preferences',
        });
      }
    }

    // 2. Branch-Scope Check for Non-Owner Roles
    if (!isOwner && permissionResolver && requiredPermission) {
      const permResult = await permissionResolver.can(
        user.id,
        organizationId,
        requiredPermission,
        targetBranchId,
      );

      if (!permResult.authorized) {
        throw new ForbiddenException({
          code: 'FORBIDDEN_PERMISSION',
          message: permResult.reason || 'Insufficient permissions for this operation',
        });
      }

      if (
        (permResult.effectiveScope === 'own_branch' ||
          permResult.effectiveScope === 'restricted_branches') &&
        targetStaff
      ) {
        const permsMap = await permissionResolver.resolveUserPermissions(
          user.id,
          organizationId,
        );
        const entry = permsMap.get(requiredPermission);
        if (entry && !entry.isAllBranches) {
          const staffBranches = [
            targetStaff.homeBranchId,
            ...(targetStaff.staffBranchAssignments || []).map((s: any) => s.branchId),
          ].filter(Boolean);

          const hasAccess = staffBranches.some((bId: string) =>
            entry.allowedBranchIds.includes(bId),
          );

          if (!hasAccess) {
            throw new ForbiddenException({
              code: 'FORBIDDEN_BRANCH_SCOPE',
              message: 'Staff member is not assigned to any branch within your authorized scope',
            });
          }
        }
      }
    }
  }
}


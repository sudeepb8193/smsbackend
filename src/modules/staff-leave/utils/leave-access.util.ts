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

export class LeaveAccessHelper {
  private static readonly logger = new Logger(LeaveAccessHelper.name);

  /**
   * Resolve effective organization ID from user or query
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
   * Validate that staff exists, belongs to organization, and is not deleted
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
        user: {
          select: { id: true, email: true, displayName: true },
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
      },
    });

    if (!staff) {
      throw new NotFoundException({
        code: 'STAFF_NOT_FOUND',
        message: 'Staff member does not exist in this organization or has been removed',
      });
    }

    return staff;
  }

  /**
   * Validate user access permissions and branch scope
   */
  static async validateUserAccess(
    prisma: PrismaService,
    permissionResolver: EffectivePermissionResolverService,
    user: AuthenticatedUser,
    organizationId: string,
    requiredPermission: string,
    targetBranchId?: string,
    targetStaff?: any,
  ): Promise<void> {
    const roles = (user.roles || []).map((r) =>
      r.toLowerCase().replace(/_/g, '-'),
    );
    const isSuperAdmin = roles.includes('super-admin');

    if (isSuperAdmin) {
      return;
    }

    if (user.organizationId !== organizationId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_ORG',
        message: 'Access to external organization data is strictly prohibited',
      });
    }

    // Check if user is Service Staff performing own-record self-service
    const isServiceStaffOnly =
      (roles.includes('service-staff') || roles.includes('staff')) &&
      !roles.includes('owner') &&
      !roles.includes('branch-manager') &&
      !roles.includes('super-admin');

    if (isServiceStaffOnly) {
      if (targetStaff && targetStaff.userId && targetStaff.userId !== user.id) {
        throw new ForbiddenException({
          code: 'FORBIDDEN_OWN_RECORD',
          message: 'Service Staff are strictly restricted to their own leave records',
        });
      }
    }

    // Evaluate canonical permission through resolver
    const check = await permissionResolver.can(
      user.id,
      organizationId,
      requiredPermission,
      targetBranchId,
    );

    if (!check.authorized) {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_PERMISSIONS',
        message: check.reason || `You lack the '${requiredPermission}' permission for this scope`,
      });
    }
  }

  /**
   * Get authenticated staff linked to user (for self-service endpoints)
   */
  static async getStaffForUser(
    prisma: PrismaService,
    userId: string,
    organizationId: string,
  ) {
    const staff = await prisma.sms_staff.findFirst({
      where: {
        userId,
        organizationId,
        deletedAt: null,
      },
      include: {
        homeBranch: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    if (!staff) {
      throw new NotFoundException({
        code: 'STAFF_RECORD_NOT_FOUND',
        message: 'No staff employment record is associated with your user account',
      });
    }

    return staff;
  }

  /**
   * Get authenticated staff linked to user safely without throwing NotFoundException.
   * Allows administrative users (Super Admin, Owner) without staff profiles to access workspaces.
   */
  static async getStaffForUserSafe(
    prisma: PrismaService,
    userId: string,
    organizationId: string,
  ) {
    return prisma.sms_staff.findFirst({
      where: {
        userId,
        organizationId,
        deletedAt: null,
      },
      include: {
        homeBranch: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }
}

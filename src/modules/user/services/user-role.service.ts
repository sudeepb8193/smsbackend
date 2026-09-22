import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AssignRoleDto } from '../dto/assign-role.dto';
import { BulkAssignRoleDto } from '../dto/bulk-assign-role.dto';

@Injectable()
export class UserRoleService {
  constructor(private prisma: PrismaService) {}

  /**
   * Helper to verify user belongs to organization and is active/not deleted
   */
  private async checkUserInOrg(userId: string, organizationId: string) {
    const user = await this.prisma.sms_users.findFirst({
      where: {
        id: userId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User does not exist in this organization',
      });
    }
    return user;
  }

  /**
   * Get all active roles available for assignment in the organization
   */
  async getAvailableRoles(organizationId: string) {
    return this.prisma.sms_roles.findMany({
      where: {
        OR: [
          { organizationId },
          { organizationId: null },
        ],
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        roleType: true,
        status: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get list of organization users with active roles summary
   */
  async getUsersWithRoles(organizationId: string) {
    const users = await this.prisma.sms_users.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        phoneNumber: true,
        status: true,
        userRolesAssignedToMe: {
          where: { removedAt: null },
          select: {
            id: true,
            isPrimary: true,
            assignedAt: true,
            role: {
              select: {
                id: true,
                name: true,
                slug: true,
                status: true,
              },
            },
          },
        },
      },
      orderBy: { displayName: 'asc' },
    });

    return users.map((u) => {
      const activeRoles = u.userRolesAssignedToMe.map((ur) => ({
        id: ur.id,
        roleId: ur.role.id,
        name: ur.role.name,
        slug: ur.role.slug,
        isPrimary: ur.isPrimary,
        isRoleInactive: ur.role.status !== 'active',
        assignedAt: ur.assignedAt,
      }));

      const primaryRole = activeRoles.find((r) => r.isPrimary) || activeRoles[0] || null;

      return {
        id: u.id,
        displayName: u.displayName,
        email: u.email,
        phoneNumber: u.phoneNumber,
        status: u.status,
        primaryRole,
        activeRolesCount: activeRoles.length,
        activeRoles,
      };
    });
  }

  /**
   * Get user active roles, audit history, and effective permissions
   */
  async getUserRoleDetails(userId: string, organizationId: string) {
    const user = await this.checkUserInOrg(userId, organizationId);

    const allAssignments = await this.prisma.sms_userRoles.findMany({
      where: { userId: user.id },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
        assignedBy: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    const activeAssignments = allAssignments.filter((a) => a.removedAt === null);
    const historicalAssignments = allAssignments.filter((a) => a.removedAt !== null);

    const activeRoles = activeAssignments.map((a) => ({
      assignmentId: a.id,
      roleId: a.role.id,
      name: a.role.name,
      slug: a.role.slug,
      description: a.role.description,
      isPrimary: a.isPrimary,
      isRoleInactive: a.role.status !== 'active',
      assignedAt: a.assignedAt,
      assignedBy: a.assignedBy ? a.assignedBy.displayName : 'System',
    }));

    const historicalRoles = historicalAssignments.map((a) => ({
      assignmentId: a.id,
      roleId: a.role.id,
      name: a.role.name,
      slug: a.role.slug,
      assignedAt: a.assignedAt,
      removedAt: a.removedAt,
      assignedBy: a.assignedBy ? a.assignedBy.displayName : 'System',
    }));

    const effectivePermissions = await this.getEffectivePermissions(userId, organizationId);

    return {
      userId: user.id,
      displayName: user.displayName,
      email: user.email,
      status: user.status,
      activeRoles,
      historicalRoles,
      effectivePermissions: effectivePermissions.effectivePermissions,
    };
  }

  /**
   * Assign a role to a user
   */
  async assignRole(
    userId: string,
    organizationId: string,
    assignerId: string,
    dto: AssignRoleDto,
  ) {
    await this.checkUserInOrg(userId, organizationId);

    // Verify role exists and belongs to org (or is a global/system role)
    const role = await this.prisma.sms_roles.findFirst({
      where: {
        id: dto.roleId,
        OR: [
          { organizationId },
          { organizationId: null },
        ],
        deletedAt: null,
      },
    });

    if (!role) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: 'The specified role was not found in this organization',
      });
    }

    // Check if role is active
    if (role.status !== 'active') {
      throw new BadRequestException({
        code: 'ROLE_INACTIVE',
        message: 'Role is inactive and cannot be assigned to users',
      });
    }

    // Check existing role assignments for this user
    const activeAssignments = await this.prisma.sms_userRoles.findMany({
      where: { userId, removedAt: null },
    });

    const isAlreadyAssigned = activeAssignments.some((a) => a.roleId === dto.roleId);
    if (isAlreadyAssigned) {
      throw new ConflictException({
        code: 'ROLE_ALREADY_ASSIGNED',
        message: 'User is already assigned to this role',
      });
    }

    // Determine if this role should be primary
    const isFirstRole = activeAssignments.length === 0;
    const shouldBePrimary = isFirstRole || Boolean(dto.isPrimary);

    // Look for a soft-removed historical record to re-activate if existing unique record exists
    const existingRecord = await this.prisma.sms_userRoles.findUnique({
      where: {
        userId_roleId: {
          userId,
          roleId: dto.roleId,
        },
      },
    });

    return await this.prisma.$transaction(async (tx) => {
      // If marking as primary, demote existing primary roles for this user
      if (shouldBePrimary) {
        await tx.sms_userRoles.updateMany({
          where: { userId, removedAt: null },
          data: { isPrimary: false },
        });
      }

      let result;
      if (existingRecord) {
        // Update soft-removed record
        result = await tx.sms_userRoles.update({
          where: { id: existingRecord.id },
          data: {
            removedAt: null,
            assignedAt: new Date(),
            assignedById: assignerId,
            isPrimary: shouldBePrimary,
          },
          include: { role: true },
        });
      } else {
        // Create new role assignment
        result = await tx.sms_userRoles.create({
          data: {
            userId,
            roleId: dto.roleId,
            isPrimary: shouldBePrimary,
            assignedById: assignerId,
            assignedAt: new Date(),
          },
          include: { role: true },
        });
      }

      return {
        id: result.id,
        userId: result.userId,
        roleId: result.roleId,
        roleName: result.role.name,
        isPrimary: result.isPrimary,
        assignedAt: result.assignedAt,
      };
    });
  }

  /**
   * Set a role as Primary for a user (switches primary role)
   */
  async setPrimaryRole(userId: string, roleId: string, organizationId: string) {
    await this.checkUserInOrg(userId, organizationId);

    const activeAssignment = await this.prisma.sms_userRoles.findFirst({
      where: {
        userId,
        roleId,
        removedAt: null,
      },
      include: { role: true },
    });

    if (!activeAssignment) {
      throw new BadRequestException({
        code: 'ROLE_NOT_ASSIGNED',
        message: 'User is not actively assigned to this role',
      });
    }

    if (activeAssignment.role.status !== 'active') {
      throw new BadRequestException({
        code: 'ROLE_INACTIVE',
        message: 'Inactive roles cannot be set as the Primary role',
      });
    }

    await this.prisma.$transaction([
      this.prisma.sms_userRoles.updateMany({
        where: { userId, removedAt: null },
        data: { isPrimary: false },
      }),
      this.prisma.sms_userRoles.update({
        where: { id: activeAssignment.id },
        data: { isPrimary: true },
      }),
    ]);

    return {
      userId,
      primaryRoleId: roleId,
      primaryRoleName: activeAssignment.role.name,
      message: 'Primary role successfully updated',
    };
  }

  /**
   * Get preview of permissions that will be lost upon removing a role
   */
  async getRoleRemovalImpact(userId: string, roleId: string, organizationId: string) {
    await this.checkUserInOrg(userId, organizationId);

    const activeAssignments = await this.prisma.sms_userRoles.findMany({
      where: { userId, removedAt: null },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    const targetAssignment = activeAssignments.find((a) => a.roleId === roleId);
    if (!targetAssignment) {
      throw new NotFoundException({
        code: 'ROLE_NOT_ASSIGNED',
        message: 'User does not hold this active role',
      });
    }

    // Check if it's the last active role
    if (activeAssignments.length <= 1) {
      return {
        isLastRole: true,
        roleId,
        roleName: targetAssignment.role.name,
        canRemove: false,
        blockedReason: 'A user must always hold at least one role to retain login access. Deactivate the user account if access should be fully removed.',
        lostPermissionsCount: 0,
        lostPermissions: [],
      };
    }

    // Extract permissions of the target role
    const targetPermissions = targetAssignment.role.rolePermissions.map((rp) => rp.permission);

    // Extract permissions of all OTHER active roles
    const otherAssignments = activeAssignments.filter((a) => a.roleId !== roleId);
    const otherPermissionsMap = new Set<string>();
    otherAssignments.forEach((a) => {
      a.role.rolePermissions.forEach((rp) => {
        otherPermissionsMap.add(rp.permission.permissionKey);
      });
    });

    // Lost permissions = permissions in target role NOT present in any other assigned role
    const lostPermissions = targetPermissions.filter(
      (p) => !otherPermissionsMap.has(p.permissionKey),
    ).map((p) => ({
      id: p.id,
      permissionKey: p.permissionKey,
      moduleCode: p.moduleCode,
      moduleLabel: p.moduleLabel,
      action: p.action,
      label: p.label,
      description: p.description,
    }));

    return {
      isLastRole: false,
      roleId,
      roleName: targetAssignment.role.name,
      isPrimary: targetAssignment.isPrimary,
      canRemove: true,
      lostPermissionsCount: lostPermissions.length,
      lostPermissions,
    };
  }

  /**
   * Remove a role from a user (Soft delete + block if last role)
   */
  async removeRole(userId: string, roleId: string, organizationId: string) {
    await this.checkUserInOrg(userId, organizationId);

    const activeAssignments = await this.prisma.sms_userRoles.findMany({
      where: { userId, removedAt: null },
      include: { role: true },
    });

    const targetAssignment = activeAssignments.find((a) => a.roleId === roleId);
    if (!targetAssignment) {
      throw new NotFoundException({
        code: 'ROLE_NOT_ASSIGNED',
        message: 'Role assignment not found or already removed',
      });
    }

    // Block removal if this is the user's last remaining role
    if (activeAssignments.length <= 1) {
      throw new BadRequestException({
        code: 'LAST_ROLE_REMOVAL_BLOCKED',
        message: 'A user must always hold at least one role to retain login access. Deactivation is the correct action if access should be fully removed.',
      });
    }

    return await this.prisma.$transaction(async (tx) => {
      // Soft-remove the role assignment
      await tx.sms_userRoles.update({
        where: { id: targetAssignment.id },
        data: { removedAt: new Date() },
      });

      // If the removed role was primary, promote another active role to primary
      if (targetAssignment.isPrimary) {
        const remainingAssignments = activeAssignments.filter((a) => a.roleId !== roleId);
        // Prefer an active status role to promote to primary
        const activeRemaining = remainingAssignments.find((a) => a.role.status === 'active') || remainingAssignments[0];

        if (activeRemaining) {
          await tx.sms_userRoles.update({
            where: { id: activeRemaining.id },
            data: { isPrimary: true },
          });
        }
      }

      return {
        userId,
        removedRoleId: roleId,
        removedRoleName: targetAssignment.role.name,
        message: 'Role successfully removed from user',
      };
    });
  }

  /**
   * Bulk assign a role to multiple users
   */
  async bulkAssignRoles(
    organizationId: string,
    assignerId: string,
    dto: BulkAssignRoleDto,
  ) {
    // Verify target role exists and is active
    const role = await this.prisma.sms_roles.findFirst({
      where: {
        id: dto.roleId,
        OR: [{ organizationId }, { organizationId: null }],
        deletedAt: null,
      },
    });

    if (!role) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: 'Target role not found in organization',
      });
    }

    if (role.status !== 'active') {
      throw new BadRequestException({
        code: 'ROLE_INACTIVE',
        message: 'Role is inactive and cannot be assigned to users',
      });
    }

    const assignedUsers: string[] = [];
    const skippedUsers: { userId: string; reason: string }[] = [];

    for (const userId of dto.userIds) {
      try {
        await this.assignRole(userId, organizationId, assignerId, {
          roleId: dto.roleId,
          isPrimary: dto.isPrimary,
        });
        assignedUsers.push(userId);
      } catch (err: any) {
        skippedUsers.push({
          userId,
          reason: err.response?.message || err.message || 'Failed to assign role',
        });
      }
    }

    return {
      roleId: role.id,
      roleName: role.name,
      totalRequested: dto.userIds.length,
      assignedCount: assignedUsers.length,
      skippedCount: skippedUsers.length,
      assignedUserIds: assignedUsers,
      skippedUsers,
    };
  }

  /**
   * Compute union of effective permissions for a user across all active assigned roles
   */
  async getEffectivePermissions(userId: string, organizationId: string) {
    await this.checkUserInOrg(userId, organizationId);

    const activeAssignments = await this.prisma.sms_userRoles.findMany({
      where: { userId, removedAt: null },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    // Permission key -> distinct permission object + roles granting it
    const permissionsMap = new Map<
      string,
      {
        id: string;
        permissionKey: string;
        moduleCode: string;
        moduleLabel: string;
        action: string;
        label: string;
        description: string | null;
        grantedByRoles: { roleId: string; roleName: string; isPrimary: boolean }[];
      }
    >();

    for (const assignment of activeAssignments) {
      const roleName = assignment.role.name;
      const roleId = assignment.role.id;
      const isPrimary = assignment.isPrimary;

      for (const rp of assignment.role.rolePermissions) {
        const perm = rp.permission;
        if (!permissionsMap.has(perm.permissionKey)) {
          permissionsMap.set(perm.permissionKey, {
            id: perm.id,
            permissionKey: perm.permissionKey,
            moduleCode: perm.moduleCode,
            moduleLabel: perm.moduleLabel,
            action: perm.action,
            label: perm.label,
            description: perm.description,
            grantedByRoles: [{ roleId, roleName, isPrimary }],
          });
        } else {
          const existing = permissionsMap.get(perm.permissionKey)!;
          if (!existing.grantedByRoles.some((r) => r.roleId === roleId)) {
            existing.grantedByRoles.push({ roleId, roleName, isPrimary });
          }
        }
      }
    }

    const effectivePermissions = Array.from(permissionsMap.values());

    return {
      userId,
      totalEffectivePermissions: effectivePermissions.length,
      effectivePermissions,
    };
  }
}

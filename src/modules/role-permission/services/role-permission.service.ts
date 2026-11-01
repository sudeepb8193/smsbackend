import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AssignRolePermissionsDto } from '../dto/assign-role-permissions.dto';
import { sms_rolePermissions_scope } from '@prisma/client';
import { randomUUID } from 'crypto';
import { EffectivePermissionResolverService } from './effective-permission-resolver.service';

@Injectable()
export class RolePermissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly effectivePermissionResolver: EffectivePermissionResolverService,
  ) {}

  /**
   * Get all permission assignments and branch restrictions for a role
   */
  async getRolePermissions(roleId: string, organizationId: string | null, isSuperAdmin: boolean = false) {
    const role = await this.prisma.sms_roles.findFirst({
      where: {
        id: roleId,
        deletedAt: null,
        ...(isSuperAdmin
          ? {}
          : {
              OR: [{ organizationId }, { organizationId: null }],
            }),
      },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
        roleBranchRestrictions: {
          include: {
            branch: {
              select: { id: true, name: true, code: true, status: true },
            },
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: 'Role not found or inaccessible',
      });
    }

    // Map branch restrictions by moduleCode
    const restrictionsByModule = new Map<
      string,
      { branchId: string; branchName: string; branchCode: string }[]
    >();

    for (const rbr of role.roleBranchRestrictions) {
      if (!restrictionsByModule.has(rbr.moduleCode)) {
        restrictionsByModule.set(rbr.moduleCode, []);
      }
      restrictionsByModule.get(rbr.moduleCode)!.push({
        branchId: rbr.branchId,
        branchName: rbr.branch.name,
        branchCode: rbr.branch.code,
      });
    }

    const assignments = role.rolePermissions.map((rp) => ({
      id: rp.id,
      permissionId: rp.permissionId,
      permissionKey: rp.permission.permissionKey,
      moduleCode: rp.permission.moduleCode,
      moduleLabel: rp.permission.moduleLabel,
      action: rp.permission.action,
      label: rp.permission.label,
      description: rp.permission.description,
      scope: rp.scope,
      restrictedBranches: restrictionsByModule.get(rp.permission.moduleCode) || [],
    }));

    return {
      roleId: role.id,
      roleName: role.name,
      roleSlug: role.slug,
      roleType: role.roleType,
      organizationId: role.organizationId,
      versionToken: role.updatedAt.toISOString(),
      updatedAt: role.updatedAt,
      assignments,
    };
  }

  /**
   * Save role permission assignments and branch scopes with optimistic concurrency control
   */
  async updateRolePermissions(
    roleId: string,
    dto: AssignRolePermissionsDto,
    actorId: string,
    organizationId: string | null,
    isSuperAdmin: boolean = false,
    clientIp?: string,
  ) {
    const role = await this.prisma.sms_roles.findFirst({
      where: {
        id: roleId,
        deletedAt: null,
        ...(isSuperAdmin
          ? {}
          : {
              OR: [{ organizationId }, { organizationId: null }],
            }),
      },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
    });

    if (!role) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: 'Role not found or inaccessible',
      });
    }

    // 1. Optimistic Concurrency Control Check
    if (dto.expectedUpdatedAt) {
      const currentToken = role.updatedAt.toISOString();
      if (dto.expectedUpdatedAt !== currentToken) {
        throw new ConflictException({
          code: 'CONCURRENCY_CONFLICT',
          message:
            'This role configuration was modified by another administrator since you loaded it. Please refresh and review the latest settings before saving.',
          currentUpdatedAt: currentToken,
        });
      }
    }

    // 2. Fetch all registered permissions
    const allPermissions = await this.prisma.sms_permissions.findMany({
      where: { isLegacy: false },
    });
    const permissionKeyMap = new Map(allPermissions.map((p) => [p.permissionKey, p]));

    // 3. Centralized Dependency Rules Resolution
    // Any action requiring view must ensure view is granted.
    // If view is missing, automatically include view.
    // If view was explicitly omitted/revoked for a module, ensure dependent permissions of that module are removed.
    const incomingPermissions = new Map<
      string,
      {
        permissionKey: string;
        scope: sms_rolePermissions_scope;
        restrictedBranchIds?: string[];
      }
    >();

    for (const item of dto.permissions) {
      incomingPermissions.set(item.permissionKey, item);
    }

    // Resolve dependencies by module
    const modulesPresent = new Set<string>();
    for (const [key] of incomingPermissions) {
      const perm = permissionKeyMap.get(key);
      if (perm) {
        modulesPresent.add(perm.moduleCode);
      }
    }

    for (const moduleCode of modulesPresent) {
      const viewKey = `${moduleCode}.view`;
      const viewPerm = permissionKeyMap.get(viewKey);

      // Check if module has non-view permissions selected
      const nonViewPerms = Array.from(incomingPermissions.keys()).filter((k) => {
        const p = permissionKeyMap.get(k);
        return p && p.moduleCode === moduleCode && p.action !== 'view';
      });

      // If non-view permissions are granted, ensure the base module view permission is automatically implied and included
      if (nonViewPerms.length > 0 && viewPerm && !incomingPermissions.has(viewKey)) {
        const firstNonView = incomingPermissions.get(nonViewPerms[0])!;
        incomingPermissions.set(viewKey, {
          permissionKey: viewKey,
          scope: firstNonView.scope,
          restrictedBranchIds: firstNonView.restrictedBranchIds ? [...firstNonView.restrictedBranchIds] : undefined,
        });
      }
    }

    // 4. Validate Branch Scopes & Restricted Branches
    const moduleRestrictedBranchesMap = new Map<string, string[]>();

    for (const [key, item] of incomingPermissions) {
      const perm = permissionKeyMap.get(key);
      if (!perm) continue;

      if (item.scope === sms_rolePermissions_scope.restricted_branches) {
        if (!item.restrictedBranchIds || item.restrictedBranchIds.length === 0) {
          throw new BadRequestException({
            code: 'RESTRICTED_BRANCHES_EMPTY',
            message: `Scope "Restricted Branches" for module "${perm.moduleLabel}" requires at least one selected branch.`,
          });
        }

        // Validate all branches belong to the role's organization and are active
        const targetOrgId = role.organizationId || organizationId;
        if (targetOrgId) {
          const validBranches = await this.prisma.sms_branches.findMany({
            where: {
              id: { in: item.restrictedBranchIds },
              organizationId: targetOrgId,
              deletedAt: null,
            },
            select: { id: true },
          });

          if (validBranches.length !== item.restrictedBranchIds.length) {
            throw new BadRequestException({
              code: 'INVALID_RESTRICTED_BRANCH',
              message: `One or more selected branches do not belong to this organization or are no longer active.`,
            });
          }
        }

        moduleRestrictedBranchesMap.set(perm.moduleCode, item.restrictedBranchIds);
      }
    }

    // 5. Execute Atomically in Transaction
    return await this.prisma.$transaction(
      async (tx) => {
        // Delete existing role permissions
        await tx.sms_rolePermissions.deleteMany({
          where: { roleId },
        });

        // Delete existing role branch restrictions
        await tx.sms_roleBranchRestrictions.deleteMany({
          where: { roleId },
        });

        // Prepare new role permissions for batch insertion
        const permissionsData: {
          id: string;
          roleId: string;
          permissionId: string;
          scope: sms_rolePermissions_scope;
          grantedById: string;
          updatedAt: Date;
        }[] = [];

        for (const [key, item] of incomingPermissions) {
          const perm = permissionKeyMap.get(key);
          if (!perm) continue;

          permissionsData.push({
            id: randomUUID(),
            roleId,
            permissionId: perm.id,
            scope: item.scope,
            grantedById: actorId,
            updatedAt: new Date(),
          });
        }

        if (permissionsData.length > 0) {
          if (typeof tx.sms_rolePermissions.createMany === 'function') {
            await tx.sms_rolePermissions.createMany({
              data: permissionsData,
            });
          } else {
            for (const p of permissionsData) {
              await tx.sms_rolePermissions.create({ data: p });
            }
          }
        }

        // Prepare branch restrictions for batch insertion
        const branchRestrictionsData: {
          id: string;
          roleId: string;
          moduleCode: string;
          branchId: string;
        }[] = [];

        for (const [moduleCode, branchIds] of moduleRestrictedBranchesMap) {
          for (const branchId of branchIds) {
            branchRestrictionsData.push({
              id: randomUUID(),
              roleId,
              moduleCode,
              branchId,
            });
          }
        }

        if (branchRestrictionsData.length > 0) {
          if (typeof tx.sms_roleBranchRestrictions.createMany === 'function') {
            await tx.sms_roleBranchRestrictions.createMany({
              data: branchRestrictionsData,
            });
          } else {
            for (const b of branchRestrictionsData) {
              await tx.sms_roleBranchRestrictions.create({ data: b });
            }
          }
        }

        // Update role's updatedAt timestamp
        const updatedRole = await tx.sms_roles.update({
          where: { id: roleId },
          data: { updatedAt: new Date() },
        });

        // Invalidate effective permission cache for all users immediately
        this.effectivePermissionResolver.invalidateCache();

        const isZeroPermissions = incomingPermissions.size === 0;

        return {
          success: true,
          roleId,
          updatedAt: updatedRole.updatedAt,
          versionToken: updatedRole.updatedAt.toISOString(),
          assignedPermissionsCount: incomingPermissions.size,
          warning: isZeroPermissions
            ? 'Warning: This role now has zero granted permissions. Users assigned to this role will not have protected application access.'
            : null,
        };
      },
      {
        maxWait: 10000,
        timeout: 30000,
      },
    );
  }
}

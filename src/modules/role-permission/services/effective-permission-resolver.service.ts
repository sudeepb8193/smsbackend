import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { sms_rolePermissions_scope, sms_staffPermissionOverrides_overrideType } from '@prisma/client';

export interface EffectivePermissionEntry {
  permissionKey: string;
  moduleCode: string;
  action: string;
  label: string;
  scope: sms_rolePermissions_scope;
  allowedBranchIds: string[]; // empty means all branches if scope is all_branches, or specific allowed branch IDs
  isAllBranches: boolean;
  grantedByRoleNames: string[];
  isStaffOverrideGrant?: boolean;
}

export interface AuthorizationResult {
  authorized: boolean;
  reason?: string;
  effectiveScope?: string;
  matchedPermission?: string;
}

@Injectable()
export class EffectivePermissionResolverService {
  private readonly logger = new Logger(EffectivePermissionResolverService.name);

  // In-memory versioning & cache for real-time authorization
  private cache = new Map<string, { timestamp: number; permissions: Map<string, EffectivePermissionEntry> }>();
  private readonly CACHE_TTL_MS = 30000; // 30 seconds max TTL; invalidated instantly on mutations

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Invalidate authorization cache for a specific user or all users
   */
  invalidateCache(userId?: string) {
    if (userId) {
      for (const key of this.cache.keys()) {
        if (key.startsWith(userId)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  /**
   * Compute full effective permissions map for a user
   */
  async resolveUserPermissions(
    userId: string,
    organizationId: string,
  ): Promise<Map<string, EffectivePermissionEntry>> {
    const cacheKey = `${userId}:${organizationId}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.permissions;
    }

    // 1. Verify User & Organization
    const user = await this.prisma.sms_users.findFirst({
      where: {
        id: userId,
        organizationId,
        deletedAt: null,
      },
      include: {
        staffLinked: {
          include: {
            staffBranchAssignments: true,
          },
        },
        userBranchAssignmentsForMe: true,
      },
    });

    if (!user || user.status === 'deactivated' || user.status === 'suspended') {
      return new Map();
    }

    // Determine user's assigned "Own Branches"
    const ownBranchIds = new Set<string>();
    if (user.staffLinked?.homeBranchId) {
      ownBranchIds.add(user.staffLinked.homeBranchId);
    }
    if (user.staffLinked?.staffBranchAssignments) {
      user.staffLinked.staffBranchAssignments.forEach((sba) => ownBranchIds.add(sba.branchId));
    }
    if (user.userBranchAssignmentsForMe) {
      const now = new Date();
      user.userBranchAssignmentsForMe.forEach((uba) => {
        const fromOk = !uba.effectiveFrom || new Date(uba.effectiveFrom) <= now;
        const toOk = !uba.effectiveTo || new Date(uba.effectiveTo) >= now;
        if (fromOk && toOk) {
          ownBranchIds.add(uba.branchId);
        }
      });
    }

    // 2. Fetch Active Assigned Roles & Role Permissions
    const userRoles = await this.prisma.sms_userRoles.findMany({
      where: {
        userId,
        removedAt: null,
      },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
            roleBranchRestrictions: true,
          },
        },
      },
    });

    // 3. Union Permissions Across Assigned Active Roles
    const effectiveMap = new Map<string, EffectivePermissionEntry>();

    // Check if user holds Super Admin role (only platform super-admin gets full system bypass)
    const isSuperAdmin = userRoles.some((ur) => {
      const slug = ur.role?.slug?.toLowerCase();
      const name = ur.role?.name?.toUpperCase();
      return (
        slug === 'super-admin' ||
        name === 'SUPER_ADMIN' ||
        name === 'SUPER ADMIN'
      );
    });

    if (isSuperAdmin) {
      const allPermissions = await this.prisma.sms_permissions.findMany({
        where: { isLegacy: false },
      });
      for (const perm of allPermissions) {
        effectiveMap.set(perm.permissionKey, {
          permissionKey: perm.permissionKey,
          moduleCode: perm.moduleCode,
          action: perm.action,
          label: perm.label,
          scope: sms_rolePermissions_scope.all_branches,
          allowedBranchIds: [],
          isAllBranches: true,
          grantedByRoleNames: ['Super Admin'],
        });
      }
    } else {
      for (const ur of userRoles) {
        const role = ur.role;
        if (!role || role.status !== 'active' || role.deletedAt) continue;

        // If an Owner role has never had rolePermissions configured in DB, provide default full access
        const isOwnerRole = role.slug?.toLowerCase() === 'owner' || role.name?.toUpperCase() === 'OWNER';
        if (isOwnerRole && (!role.rolePermissions || role.rolePermissions.length === 0)) {
          const allPermissions = await this.prisma.sms_permissions.findMany({
            where: { isLegacy: false },
          });
          for (const perm of allPermissions) {
            effectiveMap.set(perm.permissionKey, {
              permissionKey: perm.permissionKey,
              moduleCode: perm.moduleCode,
              action: perm.action,
              label: perm.label,
              scope: sms_rolePermissions_scope.all_branches,
              allowedBranchIds: [],
              isAllBranches: true,
              grantedByRoleNames: [role.name || 'Owner'],
            });
          }
          continue;
        }

        for (const rp of role.rolePermissions) {
          const perm = rp.permission;
          if (!perm || perm.isLegacy) continue;

          // Calculate branch scope for this role-permission
          let allowedBranches: string[] = [];
          let isAll = false;

          if (rp.scope === sms_rolePermissions_scope.all_branches) {
            isAll = true;
          } else if (rp.scope === sms_rolePermissions_scope.own_branch) {
            allowedBranches = Array.from(ownBranchIds);
          } else if (rp.scope === sms_rolePermissions_scope.restricted_branches) {
            // Look up restricted branches for this role and moduleCode
            const restricted = role.roleBranchRestrictions
              .filter((r) => r.moduleCode === perm.moduleCode)
              .map((r) => r.branchId);
            allowedBranches = restricted;
          }

          if (!effectiveMap.has(perm.permissionKey)) {
            effectiveMap.set(perm.permissionKey, {
              permissionKey: perm.permissionKey,
              moduleCode: perm.moduleCode,
              action: perm.action,
              label: perm.label,
              scope: rp.scope,
              allowedBranchIds: allowedBranches,
              isAllBranches: isAll,
              grantedByRoleNames: [role.name],
            });
          } else {
            // Merge scope (broadest wins: all_branches > restricted_branches / own_branch)
            const existing = effectiveMap.get(perm.permissionKey)!;
            if (!existing.grantedByRoleNames.includes(role.name)) {
              existing.grantedByRoleNames.push(role.name);
            }

            if (isAll) {
              existing.isAllBranches = true;
              existing.scope = sms_rolePermissions_scope.all_branches;
              existing.allowedBranchIds = [];
            } else if (!existing.isAllBranches) {
              // Merge allowed branches
              const combined = new Set([...existing.allowedBranchIds, ...allowedBranches]);
              existing.allowedBranchIds = Array.from(combined);
            }
          }
        }
      }
    }

    // 4. Apply Staff-Level Overrides (Precedence Step)
    if (user.staffLinked?.id) {
      const now = new Date();
      const overrides = await this.prisma.sms_staffPermissionOverrides.findMany({
        where: {
          staffId: user.staffLinked.id,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        include: {
          permission: true,
        },
      });

      for (const ov of overrides) {
        const key = ov.permission.permissionKey;

        if (ov.overrideType === sms_staffPermissionOverrides_overrideType.revoke) {
          // REVOKE OVERRIDE PRECEDENCE: Explicitly denies access
          if (ov.branchId) {
            // Revoke for specific branch
            const existing = effectiveMap.get(key);
            if (existing) {
              existing.allowedBranchIds = existing.allowedBranchIds.filter((b) => b !== ov.branchId);
              if (existing.allowedBranchIds.length === 0 && !existing.isAllBranches) {
                effectiveMap.delete(key);
              }
            }
          } else {
            // Global revoke for this staff member
            effectiveMap.delete(key);
          }
        } else if (ov.overrideType === sms_staffPermissionOverrides_overrideType.grant) {
          // GRANT OVERRIDE PRECEDENCE: Adds permission within permitted scope
          if (!effectiveMap.has(key)) {
            effectiveMap.set(key, {
              permissionKey: key,
              moduleCode: ov.permission.moduleCode,
              action: ov.permission.action,
              label: ov.permission.label,
              scope: ov.branchId ? sms_rolePermissions_scope.restricted_branches : sms_rolePermissions_scope.all_branches,
              allowedBranchIds: ov.branchId ? [ov.branchId] : [],
              isAllBranches: !ov.branchId,
              grantedByRoleNames: ['Staff Exception Grant'],
              isStaffOverrideGrant: true,
            });
          } else {
            const existing = effectiveMap.get(key)!;
            if (ov.branchId && !existing.isAllBranches) {
              if (!existing.allowedBranchIds.includes(ov.branchId)) {
                existing.allowedBranchIds.push(ov.branchId);
              }
            } else if (!ov.branchId) {
              existing.isAllBranches = true;
              existing.allowedBranchIds = [];
            }
          }
        }
      }
    }

    // Store in cache
    this.cache.set(cacheKey, { timestamp: Date.now(), permissions: effectiveMap });

    return effectiveMap;
  }

  /**
   * Resolve singular/plural aliases for permission keys (e.g. branch.create <-> branches.create)
   */
  getPermissionAliases(permKey: string): string[] {
    const key = permKey.trim().toLowerCase();
    const [module, action] = key.split('.');
    if (!action) return [key];

    const aliases = new Set<string>([key]);
    const spellingVariants = [module];
    if (module.includes('organisation')) {
      spellingVariants.push(module.replace(/organisation/g, 'organization'));
    } else if (module.includes('organization')) {
      spellingVariants.push(module.replace(/organization/g, 'organisation'));
    }

    // Action aliases (e.g. update <-> edit)
    const actionVariants = [action];
    if (action === 'update') actionVariants.push('edit');
    if (action === 'edit') actionVariants.push('update');

    // Module 05 standardized operation mappings
    if (key.startsWith('staff')) {
      if (action === 'manage') {
        aliases.add(`${module}.manage_status`);
        aliases.add(`${module}.terminate`);
        aliases.add(`${module}.link_user`);
        aliases.add(`${module}.reveal_sensitive`);
        aliases.add(`${module}.manage_versions`);
        aliases.add(`${module}.transfer`);
      }
      if (['manage_status', 'terminate', 'link_user', 'reveal_sensitive', 'manage_versions', 'transfer'].includes(action)) {
        aliases.add(`${module}.manage`);
      }
      if (action === 'upload' || action === 'assign') {
        aliases.add(`${module}.create`);
      }
      if (action === 'download') {
        aliases.add(`${module}.view`);
      }
      if (action === 'remove') {
        aliases.add(`${module}.delete`);
        aliases.add(`${module}.manage`);
      }
    }

    for (const m of spellingVariants) {
      for (const act of actionVariants) {
        aliases.add(`${m}.${act}`);
        if (m.endsWith('es')) {
          aliases.add(`${m.slice(0, -2)}.${act}`); // branches -> branch
        } else if (m.endsWith('s')) {
          aliases.add(`${m.slice(0, -1)}.${act}`); // users -> user, roles -> role, organizations -> organization
        } else {
          aliases.add(`${m}s.${act}`); // user -> users, role -> roles, organization -> organizations
          aliases.add(`${m}es.${act}`); // branch -> branches
        }
      }
    }
    return Array.from(aliases);
  }

  /**
   * Primary authorization check method for APIs & guards
   */
  async can(
    userId: string,
    organizationId: string,
    requiredPermission: string,
    branchId?: string,
  ): Promise<AuthorizationResult> {
    const permissionsMap = await this.resolveUserPermissions(userId, organizationId);

    const aliases = this.getPermissionAliases(requiredPermission);
    let entry: EffectivePermissionEntry | undefined;
    let matchedKey: string | undefined;

    for (const k of aliases) {
      if (permissionsMap.has(k)) {
        entry = permissionsMap.get(k);
        matchedKey = k;
        break;
      }
    }

    if (!entry) {
      return {
        authorized: false,
        reason: `Missing required permission: ${requiredPermission}`,
      };
    }

    // If branchId is specified, check branch scope
    if (branchId) {
      if (!entry.isAllBranches && !entry.allowedBranchIds.includes(branchId)) {
        return {
          authorized: false,
          reason: `Permission "${matchedKey || requiredPermission}" is granted, but access to branch "${branchId}" is restricted.`,
          effectiveScope: entry.scope,
        };
      }
    }

    return {
      authorized: true,
      effectiveScope: entry.scope,
      matchedPermission: matchedKey || requiredPermission,
    };
  }

  /**
   * Return effective permissions summary list for client UI preview
   */
  async getEffectivePermissionsSummary(userId: string, organizationId: string) {
    const map = await this.resolveUserPermissions(userId, organizationId);
    return Array.from(map.values());
  }
}

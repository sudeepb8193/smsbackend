import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { QueryPermissionsDto } from '../dto/query-permissions.dto';
import { PERMISSION_DEFINITIONS } from '../../../database/seeds/permissions.seed';

export interface ModulePermissionGroup {
  moduleCode: string;
  moduleLabel: string;
  permissions: {
    id: string;
    action: string;
    permissionKey: string;
    label: string;
    description: string | null;
    isLegacy: boolean;
  }[];
}

@Injectable()
export class PermissionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all registered permissions with optional filtering
   */
  async findAll(query: QueryPermissionsDto) {
    const where: any = {};

    if (query.moduleCode) {
      where.moduleCode = query.moduleCode;
    }

    if (query.action) {
      where.action = query.action;
    }

    if (!query.includeLegacy) {
      where.isLegacy = false;
    }

    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { permissionKey: { contains: term, mode: 'insensitive' } },
        { label: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { moduleLabel: { contains: term, mode: 'insensitive' } },
      ];
    }

    const permissions = await this.prisma.sms_permissions.findMany({
      where,
      orderBy: [{ moduleCode: 'asc' }, { action: 'asc' }],
    });

    return permissions;
  }

  /**
   * Get permission catalog grouped by module for matrix display
   */
  async getMatrixTemplate() {
    const permissions = await this.prisma.sms_permissions.findMany({
      where: { isLegacy: false },
      orderBy: [{ moduleCode: 'asc' }, { action: 'asc' }],
    });

    const groupsMap = new Map<string, ModulePermissionGroup>();

    for (const p of permissions) {
      if (!groupsMap.has(p.moduleCode)) {
        groupsMap.set(p.moduleCode, {
          moduleCode: p.moduleCode,
          moduleLabel: p.moduleLabel,
          permissions: [],
        });
      }
      groupsMap.get(p.moduleCode)!.permissions.push({
        id: p.id,
        action: p.action,
        permissionKey: p.permissionKey,
        label: p.label,
        description: p.description,
        isLegacy: p.isLegacy,
      });
    }

    return Array.from(groupsMap.values());
  }

  /**
   * Helper to determine implied dependency rules
   * For any module, actions 'create', 'edit', 'delete', 'approve', 'export', 'print' require and imply 'view'
   */
  getDependencyRules(): { impliedAction: string; requiredAction: string }[] {
    return [
      { impliedAction: 'create', requiredAction: 'view' },
      { impliedAction: 'edit', requiredAction: 'view' },
      { impliedAction: 'delete', requiredAction: 'view' },
      { impliedAction: 'approve', requiredAction: 'view' },
      { impliedAction: 'export', requiredAction: 'view' },
      { impliedAction: 'print', requiredAction: 'view' },
    ];
  }

  /**
   * Dynamically register a new module and its supported actions
   */
  async createModulePermissions(dto: import('../dto/create-module-permissions.dto').CreateModulePermissionsDto) {
    const { moduleCode, moduleLabel, actions, description } = dto;
    const actionLabels: Record<string, string> = {
      view: 'View',
      create: 'Create',
      edit: 'Edit',
      delete: 'Delete',
      approve: 'Approve',
      export: 'Export',
      print: 'Print',
    };

    const created: any[] = [];
    for (const action of actions) {
      const permissionKey = `${moduleCode}.${action}`;
      const label = `${actionLabels[action] || action} ${moduleLabel}`;
      const desc = description || `Allows user to ${action} ${moduleLabel.toLowerCase()}`;

      const perm = await this.prisma.sms_permissions.upsert({
        where: { permissionKey },
        update: {
          moduleLabel,
          label,
          description: desc,
          isLegacy: false,
        },
        create: {
          moduleCode,
          moduleLabel,
          action: action as any,
          permissionKey,
          label,
          description: desc,
          isLegacy: false,
        },
      });
      created.push(perm);
    }

    return {
      success: true,
      moduleCode,
      moduleLabel,
      permissions: created,
    };
  }

  /**
   * Update an existing module and its supported actions
   */
  async updateModulePermissions(
    moduleCode: string,
    dto: import('../dto/update-module-permissions.dto').UpdateModulePermissionsDto,
  ) {
    const { moduleLabel, actions, description } = dto;
    const actionLabels: Record<string, string> = {
      view: 'View',
      create: 'Create',
      edit: 'Edit',
      delete: 'Delete',
      approve: 'Approve',
      export: 'Export',
      print: 'Print',
    };

    // Verify module exists
    const existingPerms = await this.prisma.sms_permissions.findMany({
      where: { moduleCode },
    });
    if (!existingPerms || existingPerms.length === 0) {
      throw new Error(`Module with code "${moduleCode}" not found`);
    }

    return await this.prisma.$transaction(async (tx) => {
      // If actions array is provided, handle additions and deletions
      if (actions && actions.length > 0) {
        const existingActions = existingPerms.map((p) => p.action as string);
        const actionsToRemove = existingActions.filter((a) => !actions.includes(a as any));

        if (actionsToRemove.length > 0) {
          const permsToRemove = existingPerms.filter((p) => actionsToRemove.includes(p.action as string));
          const permIdsToRemove = permsToRemove.map((p) => p.id);

          await tx.sms_rolePermissions.deleteMany({
            where: { permissionId: { in: permIdsToRemove } },
          });
          await tx.sms_staffPermissionOverrides.deleteMany({
            where: { permissionId: { in: permIdsToRemove } },
          });
          await tx.sms_permissions.deleteMany({
            where: { id: { in: permIdsToRemove } },
          });
        }

        // Upsert actions
        for (const action of actions) {
          const permissionKey = `${moduleCode}.${action}`;
          const label = `${actionLabels[action] || action} ${moduleLabel}`;
          const desc = description || `Allows user to ${action} ${moduleLabel.toLowerCase()}`;

          await tx.sms_permissions.upsert({
            where: { permissionKey },
            update: {
              moduleLabel,
              label,
              description: desc,
            },
            create: {
              moduleCode,
              moduleLabel,
              action: action as any,
              permissionKey,
              label,
              description: desc,
              isLegacy: false,
            },
          });
        }
      } else {
        // Just update moduleLabel and description for all existing permissions
        for (const p of existingPerms) {
          const label = `${actionLabels[p.action] || p.action} ${moduleLabel}`;
          const desc = description || p.description;
          await tx.sms_permissions.update({
            where: { id: p.id },
            data: {
              moduleLabel,
              label,
              description: desc,
            },
          });
        }
      }

      const updated = await tx.sms_permissions.findMany({
        where: { moduleCode },
        orderBy: { action: 'asc' },
      });

      return {
        success: true,
        moduleCode,
        moduleLabel,
        permissions: updated,
      };
    });
  }

  /**
   * Delete a module and all associated permissions and role assignments
   */
  async deleteModule(moduleCode: string) {
    const existingPerms = await this.prisma.sms_permissions.findMany({
      where: { moduleCode },
    });
    if (!existingPerms || existingPerms.length === 0) {
      throw new Error(`Module with code "${moduleCode}" not found`);
    }

    const permIds = existingPerms.map((p) => p.id);

    return await this.prisma.$transaction(async (tx) => {
      await tx.sms_rolePermissions.deleteMany({
        where: { permissionId: { in: permIds } },
      });
      await tx.sms_staffPermissionOverrides.deleteMany({
        where: { permissionId: { in: permIds } },
      });
      const deleted = await tx.sms_permissions.deleteMany({
        where: { id: { in: permIds } },
      });

      return {
        success: true,
        moduleCode,
        deletedCount: deleted.count,
      };
    });
  }
}

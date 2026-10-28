import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { QueryRolesDto } from '../dto/query-roles.dto';
import { sms_roles_roleType, sms_roles_status } from '@prisma/client';
import { randomUUID } from 'crypto';

@Injectable()
export class RoleService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Helper to generate a slug from role name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * List roles with active user counts and filters
   */
  async findAll(organizationId: string | null, query: QueryRolesDto, isSuperAdmin: boolean = false) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
    };

    // Tenant Scoping
    if (!isSuperAdmin) {
      where.OR = [
        { organizationId },
        { organizationId: null },
      ];
    } else if (query.organizationId) {
      where.OR = [
        { organizationId: query.organizationId },
        { organizationId: null },
      ];
    } else {
      // Global template roles for Super Admin
      where.organizationId = null;
    }

    if (query.roleType) {
      where.roleType = query.roleType;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      const term = query.search.trim();
      where.AND = [
        {
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { slug: { contains: term, mode: 'insensitive' } },
            { description: { contains: term, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [total, roles] = await Promise.all([
      this.prisma.sms_roles.count({ where }),
      this.prisma.sms_roles.findMany({
        where,
        skip,
        take: limit,
        include: {
          clonedFrom: {
            select: { id: true, name: true, slug: true },
          },
          organization: {
            select: { id: true, name: true },
          },
          userRoles: {
            where: { removedAt: null },
            select: { id: true, userId: true },
          },
          _count: {
            select: {
              rolePermissions: true,
            },
          },
        },
        orderBy: [{ roleType: 'asc' }, { name: 'asc' }],
      }),
    ]);

    const items = roles.map((r) => {
      // Calculate distinct active user count
      const distinctUsers = new Set(r.userRoles.map((ur) => ur.userId));
      return {
        id: r.id,
        organizationId: r.organizationId,
        organizationName: r.organization?.name || 'Global',
        name: r.name,
        slug: r.slug,
        description: r.description,
        roleType: r.roleType,
        status: r.status,
        clonedFromRoleId: r.clonedFromRoleId,
        clonedFromName: r.clonedFrom?.name || null,
        permissionsCount: r._count.rolePermissions,
        activeUsersCount: distinctUsers.size,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find single role by ID
   */
  async findOne(roleId: string, organizationId: string | null, isSuperAdmin: boolean = false) {
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
        clonedFrom: {
          select: { id: true, name: true, slug: true },
        },
        organization: {
          select: { id: true, name: true },
        },
        userRoles: {
          where: { removedAt: null },
          select: { id: true, userId: true },
        },
        _count: {
          select: {
            rolePermissions: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: 'Role not found or inaccessible in this organization',
      });
    }

    const distinctUsers = new Set(role.userRoles.map((ur) => ur.userId));

    return {
      id: role.id,
      organizationId: role.organizationId,
      organizationName: role.organization?.name || 'Global',
      name: role.name,
      slug: role.slug,
      description: role.description,
      roleType: role.roleType,
      status: role.status,
      clonedFromRoleId: role.clonedFromRoleId,
      clonedFromName: role.clonedFrom?.name || null,
      permissionsCount: role._count.rolePermissions,
      activeUsersCount: distinctUsers.size,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  /**
   * Create custom role with optional permission cloning
   */
  async createRole(
    dto: CreateRoleDto,
    creatorId: string,
    targetOrgId: string,
    clientIp?: string,
  ) {
    const slug = dto.slug ? this.generateSlug(dto.slug) : this.generateSlug(dto.name);

    // Prevent duplicate name or slug within the organization
    const existing = await this.prisma.sms_roles.findFirst({
      where: {
        organizationId: targetOrgId,
        OR: [{ name: { equals: dto.name, mode: 'insensitive' } }, { slug }],
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictException({
        code: 'ROLE_DUPLICATE',
        message: `A role with the name "${dto.name}" or slug "${slug}" already exists in this organization`,
      });
    }

    // Verify clonedFromRoleId if provided
    let clonedSourceRole: any = null;
    if (dto.clonedFromRoleId) {
      clonedSourceRole = await this.prisma.sms_roles.findFirst({
        where: {
          id: dto.clonedFromRoleId,
          deletedAt: null,
          OR: [{ organizationId: targetOrgId }, { organizationId: null }],
        },
        include: {
          rolePermissions: true,
          roleBranchRestrictions: true,
        },
      });

      if (!clonedSourceRole) {
        throw new NotFoundException({
          code: 'CLONE_SOURCE_NOT_FOUND',
          message: 'The role selected to clone permissions from does not exist or belongs to another organization',
        });
      }
    }

    return await this.prisma.$transaction(
      async (tx) => {
        // 1. Create the new custom role
        const newRole = await tx.sms_roles.create({
          data: {
            organizationId: targetOrgId,
            name: dto.name,
            slug,
            description: dto.description || null,
            roleType: sms_roles_roleType.custom,
            clonedFromRoleId: dto.clonedFromRoleId || null,
            status: sms_roles_status.active,
            createdById: creatorId,
          },
        });

        // 2. If cloning, copy permissions and branch restrictions
        if (clonedSourceRole && clonedSourceRole.rolePermissions?.length > 0) {
          const clonedPermissionsData = clonedSourceRole.rolePermissions.map((rp) => ({
            id: randomUUID(),
            roleId: newRole.id,
            permissionId: rp.permissionId,
            scope: rp.scope,
            grantedById: creatorId,
            updatedAt: new Date(),
          }));

          if (typeof tx.sms_rolePermissions.createMany === 'function') {
            await tx.sms_rolePermissions.createMany({
              data: clonedPermissionsData,
            });
          } else {
            for (const rp of clonedPermissionsData) {
              await tx.sms_rolePermissions.create({ data: rp });
            }
          }

          // Copy role branch restrictions (only for branches belonging to targetOrgId)
          if (clonedSourceRole.roleBranchRestrictions?.length > 0) {
            const validBranchIds = new Set(
              (
                await tx.sms_branches.findMany({
                  where: {
                    id: { in: clonedSourceRole.roleBranchRestrictions.map((rbr) => rbr.branchId) },
                    organizationId: targetOrgId,
                    deletedAt: null,
                  },
                  select: { id: true },
                })
              ).map((b) => b.id),
            );

            const clonedRestrictionsData = clonedSourceRole.roleBranchRestrictions
              .filter((rbr) => validBranchIds.has(rbr.branchId))
              .map((rbr) => ({
                id: randomUUID(),
                roleId: newRole.id,
                moduleCode: rbr.moduleCode,
                branchId: rbr.branchId,
              }));

            if (clonedRestrictionsData.length > 0) {
              if (typeof tx.sms_roleBranchRestrictions.createMany === 'function') {
                await tx.sms_roleBranchRestrictions.createMany({
                  data: clonedRestrictionsData,
                });
              } else {
                for (const rbr of clonedRestrictionsData) {
                  await tx.sms_roleBranchRestrictions.create({ data: rbr });
                }
              }
            }
          }
        }

        return newRole;
      },
      {
        maxWait: 10000,
        timeout: 30000,
      },
    );
  }

  /**
   * Update role metadata
   */
  async updateRole(
    roleId: string,
    dto: UpdateRoleDto,
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
    });

    if (!role) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: 'Role not found',
      });
    }

    // System role protection: System roles cannot be renamed
    if (role.roleType === sms_roles_roleType.system && dto.name && dto.name !== role.name) {
      throw new BadRequestException({
        code: 'SYSTEM_ROLE_RENAME_BLOCKED',
        message: 'System predefined roles cannot be renamed to ensure system stability',
      });
    }

    // If deactivating, check if there are active users assigned
    if (dto.status === sms_roles_status.inactive && role.status === sms_roles_status.active) {
      const activeAssignmentsCount = await this.prisma.sms_userRoles.count({
        where: {
          roleId,
          removedAt: null,
          user: { deletedAt: null },
        },
      });

      if (activeAssignmentsCount > 0) {
        throw new BadRequestException({
          code: 'ROLE_DEACTIVATION_BLOCKED',
          message: `Cannot deactivate role "${role.name}" because it is currently assigned to ${activeAssignmentsCount} active user(s). Reassign them first.`,
        });
      }
    }

    // Check unique name if changing name
    if (dto.name && dto.name !== role.name && role.organizationId) {
      const duplicate = await this.prisma.sms_roles.findFirst({
        where: {
          organizationId: role.organizationId,
          name: { equals: dto.name, mode: 'insensitive' },
          id: { not: roleId },
          deletedAt: null,
        },
      });
      if (duplicate) {
        throw new ConflictException({
          code: 'ROLE_DUPLICATE_NAME',
          message: `A role named "${dto.name}" already exists in this organization`,
        });
      }
    }

    const updated = await this.prisma.sms_roles.update({
      where: { id: roleId },
      data: {
        name: dto.name ?? role.name,
        description: dto.description !== undefined ? dto.description : role.description,
        status: dto.status ?? role.status,
      },
    });

    return updated;
  }

  /**
   * Soft delete a custom role with assigned users check
   */
  async deleteRole(
    roleId: string,
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
    });

    if (!role) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: 'Role not found',
      });
    }

    // System roles can never be deleted
    if (role.roleType === sms_roles_roleType.system) {
      throw new BadRequestException({
        code: 'SYSTEM_ROLE_DELETE_BLOCKED',
        message: 'Predefined system roles cannot be deleted',
      });
    }

    // Check if active users are assigned
    const activeAssignments = await this.prisma.sms_userRoles.findMany({
      where: {
        roleId,
        removedAt: null,
        user: { deletedAt: null },
      },
      include: {
        user: {
          select: { id: true, displayName: true, email: true },
        },
      },
    });

    if (activeAssignments.length > 0) {
      throw new BadRequestException({
        code: 'ROLE_IN_USE_DELETE_BLOCKED',
        message: `Cannot delete role "${role.name}" because it is currently assigned to ${activeAssignments.length} active user(s). Reassign them before deleting.`,
        affectedUsers: activeAssignments.map((a) => ({
          userId: a.user.id,
          displayName: a.user.displayName,
          email: a.user.email,
        })),
      });
    }

    // Soft delete custom role
    const deleted = await this.prisma.sms_roles.update({
      where: { id: roleId },
      data: {
        deletedAt: new Date(),
        status: sms_roles_status.inactive,
      },
    });

    return {
      success: true,
      roleId: deleted.id,
      name: deleted.name,
      message: `Role "${deleted.name}" successfully deleted`,
    };
  }

  /**
   * Get affected users for a role (useful before delete/deactivate)
   */
  async getAffectedUsers(roleId: string, organizationId: string | null, isSuperAdmin: boolean = false) {
    await this.findOne(roleId, organizationId, isSuperAdmin);

    const activeAssignments = await this.prisma.sms_userRoles.findMany({
      where: {
        roleId,
        removedAt: null,
        user: { deletedAt: null },
      },
      include: {
        user: {
          select: { id: true, displayName: true, email: true, phoneNumber: true, status: true },
        },
      },
    });

    return {
      roleId,
      activeUsersCount: activeAssignments.length,
      users: activeAssignments.map((a) => ({
        assignmentId: a.id,
        userId: a.user.id,
        displayName: a.user.displayName,
        email: a.user.email,
        phoneNumber: a.user.phoneNumber,
        status: a.user.status,
        isPrimary: a.isPrimary,
        assignedAt: a.assignedAt,
      })),
    };
  }
}

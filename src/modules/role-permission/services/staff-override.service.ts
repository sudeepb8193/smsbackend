import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateStaffOverrideDto } from '../dto/create-staff-override.dto';
import { sms_staffPermissionOverrides_overrideType } from '@prisma/client';
import { EffectivePermissionResolverService } from './effective-permission-resolver.service';

@Injectable()
export class StaffOverrideService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly effectivePermissionResolver: EffectivePermissionResolverService,
  ) {}

  /**
   * Helper to verify staff belongs to organization
   */
  private async getStaffInOrg(staffId: string, organizationId: string | null, isSuperAdmin: boolean = false) {
    const staff = await this.prisma.sms_staff.findFirst({
      where: {
        id: staffId,
        deletedAt: null,
        ...(isSuperAdmin
          ? {}
          : {
              organizationId: organizationId || undefined,
            }),
      },
      include: {
        user: {
          select: { id: true, displayName: true, email: true, status: true },
        },
        homeBranch: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    if (!staff) {
      throw new NotFoundException({
        code: 'STAFF_NOT_FOUND',
        message: 'Staff member not found or inaccessible in this organization',
      });
    }

    return staff;
  }

  /**
   * List overrides for a staff member with expiry status
   */
  async getStaffOverrides(staffId: string, organizationId: string | null, isSuperAdmin: boolean = false) {
    const staff = await this.getStaffInOrg(staffId, organizationId, isSuperAdmin);

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const overrides = await this.prisma.sms_staffPermissionOverrides.findMany({
      where: { staffId },
      include: {
        permission: true,
        branch: {
          select: { id: true, name: true, code: true },
        },
        grantedBy: {
          select: { id: true, displayName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const items = overrides.map((o) => {
      const isExpired = o.expiresAt ? new Date(o.expiresAt) < now : false;
      const isExpiringSoon =
        o.expiresAt && !isExpired
          ? new Date(o.expiresAt) <= sevenDaysFromNow
          : false;

      return {
        id: o.id,
        staffId: o.staffId,
        permissionId: o.permissionId,
        permissionKey: o.permission.permissionKey,
        permissionLabel: o.permission.label,
        moduleCode: o.permission.moduleCode,
        moduleLabel: o.permission.moduleLabel,
        action: o.permission.action,
        overrideType: o.overrideType,
        branchId: o.branchId,
        branchName: o.branch?.name || 'All Branches',
        reason: o.reason,
        expiresAt: o.expiresAt,
        isExpired,
        isExpiringSoon,
        grantedById: o.grantedById,
        grantedByName: o.grantedBy.displayName,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      };
    });

    return {
      staffId: staff.id,
      employeeCode: staff.employeeCode,
      fullName: staff.fullName,
      linkedUser: staff.user,
      homeBranch: staff.homeBranch,
      totalOverrides: items.length,
      activeOverridesCount: items.filter((i) => !i.isExpired).length,
      overrides: items,
    };
  }

  /**
   * Create staff permission override
   */
  async createOverride(
    staffId: string,
    dto: CreateStaffOverrideDto,
    actorId: string,
    organizationId: string | null,
    isSuperAdmin: boolean = false,
    clientIp?: string,
  ) {
    const staff = await this.getStaffInOrg(staffId, organizationId, isSuperAdmin);

    // 1. Validate Expiration Date
    let parsedExpiry: Date | null = null;
    if (dto.expiresAt) {
      parsedExpiry = new Date(dto.expiresAt);
      if (isNaN(parsedExpiry.getTime())) {
        throw new BadRequestException({
          code: 'INVALID_EXPIRY_DATE',
          message: 'expiresAt must be a valid ISO date-time string',
        });
      }
      if (parsedExpiry <= new Date()) {
        throw new BadRequestException({
          code: 'EXPIRY_DATE_IN_PAST',
          message: 'The expiration date must be in the future',
        });
      }
    }

    // 2. Validate Permission
    const permission = await this.prisma.sms_permissions.findUnique({
      where: { permissionKey: dto.permissionKey },
    });

    if (!permission) {
      throw new NotFoundException({
        code: 'PERMISSION_NOT_FOUND',
        message: `Permission "${dto.permissionKey}" does not exist`,
      });
    }

    if (permission.isLegacy) {
      throw new BadRequestException({
        code: 'LEGACY_PERMISSION_OVERRIDE_BLOCKED',
        message: `Permission "${dto.permissionKey}" is deprecated and cannot be newly granted`,
      });
    }

    // 3. Validate Branch if provided
    if (dto.branchId) {
      const branch = await this.prisma.sms_branches.findFirst({
        where: {
          id: dto.branchId,
          organizationId: staff.organizationId,
          deletedAt: null,
        },
      });

      if (!branch) {
        throw new BadRequestException({
          code: 'INVALID_BRANCH',
          message: 'Target branch does not belong to the staff member’s organization',
        });
      }
    }

    // 4. Check for Redundant Grant Override
    if (dto.overrideType === sms_staffPermissionOverrides_overrideType.grant && staff.userId) {
      const activeRoles = await this.prisma.sms_userRoles.findMany({
        where: { userId: staff.userId, removedAt: null },
        include: {
          role: {
            include: {
              rolePermissions: {
                where: { permissionId: permission.id },
              },
            },
          },
        },
      });

      const alreadyGrantedGlobally = activeRoles.some((ar) =>
        ar.role.rolePermissions.some((rp) => rp.scope === 'all_branches'),
      );

      if (alreadyGrantedGlobally && !dto.branchId) {
        throw new ConflictException({
          code: 'REDUNDANT_GRANT_OVERRIDE',
          message: `Staff already holds permission "${dto.permissionKey}" globally across all branches through role assignments.`,
        });
      }
    }

    // 5. Upsert override
    const existing = await this.prisma.sms_staffPermissionOverrides.findFirst({
      where: {
        staffId,
        permissionId: permission.id,
        branchId: dto.branchId || null,
      },
    });

    const result = existing
      ? await this.prisma.sms_staffPermissionOverrides.update({
          where: { id: existing.id },
          data: {
            overrideType: dto.overrideType,
            reason: dto.reason,
            expiresAt: parsedExpiry,
            grantedById: actorId,
          },
          include: { permission: true, branch: true },
        })
      : await this.prisma.sms_staffPermissionOverrides.create({
          data: {
            staffId,
            permissionId: permission.id,
            overrideType: dto.overrideType,
            branchId: dto.branchId || null,
            reason: dto.reason,
            expiresAt: parsedExpiry,
            grantedById: actorId,
          },
          include: { permission: true, branch: true },
        });

    if (staff.user?.id) {
      this.effectivePermissionResolver.invalidateCache(staff.user.id);
    }

    return {
      id: result.id,
      staffId: result.staffId,
      permissionKey: result.permission.permissionKey,
      overrideType: result.overrideType,
      branchId: result.branchId,
      branchName: result.branch?.name || 'All Branches',
      reason: result.reason,
      expiresAt: result.expiresAt,
      createdAt: result.createdAt,
    };
  }

  /**
   * Delete / Revoke staff permission override
   */
  async removeOverride(
    staffId: string,
    overrideId: string,
    actorId: string,
    organizationId: string | null,
    isSuperAdmin: boolean = false,
    clientIp?: string,
  ) {
    const staff = await this.getStaffInOrg(staffId, organizationId, isSuperAdmin);

    const override = await this.prisma.sms_staffPermissionOverrides.findFirst({
      where: { id: overrideId, staffId },
      include: { permission: true },
    });

    if (!override) {
      throw new NotFoundException({
        code: 'OVERRIDE_NOT_FOUND',
        message: 'Permission override not found for this staff member',
      });
    }

    await this.prisma.sms_staffPermissionOverrides.delete({
      where: { id: overrideId },
    });

    if (staff.user?.id) {
      this.effectivePermissionResolver.invalidateCache(staff.user.id);
    }

    return {
      success: true,
      overrideId,
      message: 'Staff permission override successfully removed',
    };
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { EffectivePermissionResolverService } from '../../role-permission/services/effective-permission-resolver.service';
import {
  CreateDesignationDto,
  UpdateDesignationDto,
} from '../dto/designation.dto';
import {
  CreateSkillRatingDto,
  UpdateSkillRatingDto,
} from '../dto/skill-rating.dto';
import {
  AssignServiceDto,
  BulkAssignServicesDto,
  UpdateDurationOverrideDto,
} from '../dto/staff-service.dto';
import {
  CreateBranchOverrideDto,
  UpdateBranchOverrideDto,
} from '../dto/branch-override.dto';
import {
  CreateCommissionOverrideDto,
  UpdateCommissionOverrideDto,
  SetCommissionEligibilityDto,
} from '../dto/commission-rate.dto';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import {
  sms_staffDesignations_designationType,
  sms_staffSkillRatings_verificationStatus,
  sms_commission_type,
  Prisma,
} from '@prisma/client';

@Injectable()
export class StaffDesignationService {
  private readonly logger = new Logger(StaffDesignationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    private readonly permissionResolver?: EffectivePermissionResolverService,
  ) {}

  // =========================================================================
  // UTILITY & ACCESS VALIDATION
  // =========================================================================

  /**
   * Helper: Record audit log for security-sensitive actions
   */
  private async recordAuditLog(
    organizationId: string,
    performedById: string | undefined,
    action: string,
    oldValue: any,
    newValue: any,
  ) {
    try {
      await this.prisma.sms_auditLogs.create({
        data: {
          organizationId,
          performedById: performedById || null,
          action,
          oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : Prisma.JsonNull,
          newValue: newValue ? JSON.parse(JSON.stringify(newValue)) : Prisma.JsonNull,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to create audit log for ${action}: ${err.message}`);
    }
  }

  /**
   * Validate that staff exists, belongs to the organization, and return staff
   */
  async validateStaff(staffId: string, organizationId: string) {
    const staff = await this.prisma.sms_staff.findFirst({
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
   * Role-based access validation: enforce own-record isolation for Service Staff
   * and branch-scope restrictions for Branch Managers / restricted roles.
   */
  async validateAccess(
    staff: any,
    currentUser?: AuthenticatedUser | string,
    requiredPermission?: string,
    targetBranchId?: string,
  ) {
    if (!currentUser) return;
    const user: AuthenticatedUser =
      typeof currentUser === 'string'
        ? {
            id: currentUser,
            email: null,
            displayName: '',
            organizationId: staff.organizationId,
            status: 'active',
            roles: [],
          }
        : currentUser;

    const roles = (user.roles || []).map((r) =>
      r.toUpperCase().replace(/[\s_-]+/g, '_'),
    );
    const isSuperAdmin = roles.some((r) =>
      ['SUPER_ADMIN', 'SUPERADMIN', 'SUPER-ADMIN'].includes(r),
    );
    if (isSuperAdmin) return;

    const isOwner = roles.includes('OWNER');
    const isServiceStaff =
      (roles.includes('SERVICE_STAFF') || roles.includes('STAFF')) &&
      !roles.some((r) =>
        ['SUPER_ADMIN', 'SUPERADMIN', 'OWNER', 'BRANCH_MANAGER', 'ACCOUNTANT', 'FRONT_DESK'].includes(r),
      );

    // 1. Strict Own-Record Check for Service Staff
    if (isServiceStaff) {
      const isOwnRecord =
        staff.userId === user.id ||
        (user.email &&
          staff.staffContacts?.personalEmail?.toLowerCase() === user.email.toLowerCase());

      if (!isOwnRecord) {
        throw new ForbiddenException({
          code: 'FORBIDDEN_OWN_RECORD_ONLY',
          message: 'You are only authorized to view and access your own staff profile',
        });
      }
    }

    // 2. Branch-Scope Check for Non-Owner Roles with branch restrictions (e.g. Branch Manager)
    if (!isOwner) {
      if (this.permissionResolver && requiredPermission) {
        const permResult = await this.permissionResolver.can(
          user.id,
          staff.organizationId,
          requiredPermission,
          targetBranchId,
        );

        if (!permResult.authorized) {
          throw new ForbiddenException({
            code: 'FORBIDDEN_PERMISSION',
            message: permResult.reason || 'Insufficient permissions for this operation',
          });
        }

        // If scope is own_branch or restricted_branches, verify that the staff member belongs to an allowed branch
        if (
          permResult.effectiveScope === 'own_branch' ||
          permResult.effectiveScope === 'restricted_branches'
        ) {
          const permsMap = await this.permissionResolver.resolveUserPermissions(
            user.id,
            staff.organizationId,
          );
          const entry = permsMap.get(requiredPermission);
          if (entry && !entry.isAllBranches) {
            const staffBranches = [
              staff.homeBranchId,
              ...(staff.staffBranchAssignments || []).map((s: any) => s.branchId),
            ].filter(Boolean);

            const hasAccess = staffBranches.some((bId: string) =>
              entry.allowedBranchIds.includes(bId),
            );

            if (!hasAccess) {
              throw new ForbiddenException({
                code: 'FORBIDDEN_BRANCH_SCOPE',
                message: 'Employee is not assigned to any branch within your authorized scope',
              });
            }
          }
        }
      } else if (user.assignedBranchIds && user.assignedBranchIds.length > 0) {
        // Fallback direct branch scoping check
        if (targetBranchId && !user.assignedBranchIds.includes(targetBranchId)) {
          throw new ForbiddenException({
            code: 'FORBIDDEN_BRANCH_SCOPE',
            message: 'You are not authorized for the specified target branch',
          });
        }

        const staffBranches = [
          staff.homeBranchId,
          ...(staff.staffBranchAssignments || []).map((s: any) => s.branchId),
        ].filter(Boolean);

        const hasAccess = staffBranches.some((bId: string) =>
          user.assignedBranchIds?.includes(bId),
        );

        if (!hasAccess) {
          throw new ForbiddenException({
            code: 'FORBIDDEN_BRANCH_SCOPE',
            message: 'Employee is not assigned to any branch within your authorized scope',
          });
        }
      }
    }
  }

  /**
   * Helper: Prevent Service Staff from performing management actions on their own record
   */
  private preventSelfManagement(
    staff: any,
    currentUser?: AuthenticatedUser,
    actionDescription?: string,
  ) {
    if (!currentUser) return;
    const roles = (currentUser.roles || []).map((r) =>
      r.toUpperCase().replace(/[\s_-]+/g, '_'),
    );
    const isServiceStaff =
      (roles.includes('SERVICE_STAFF') || roles.includes('STAFF')) &&
      !roles.some((r) =>
        ['SUPER_ADMIN', 'SUPERADMIN', 'OWNER', 'BRANCH_MANAGER', 'ACCOUNTANT', 'FRONT_DESK'].includes(r),
      );

    if (isServiceStaff && staff.userId === currentUser.id) {
      throw new ForbiddenException({
        code: 'SELF_MANAGEMENT_PROHIBITED',
        message: `Employees are strictly prohibited to ${actionDescription || 'perform this operation'} for themselves`,
      });
    }
  }

  // =========================================================================
  // TASK 6.1: SERVICE PROVIDER DESIGNATION
  // =========================================================================

  async getStaffDesignations(organizationId: string, staffId: string, currentUser?: AuthenticatedUser) {
    const staff = await this.validateStaff(staffId, organizationId);
    await this.validateAccess(staff, currentUser, 'staff_designation.view');

    const designations = await this.prisma.sms_staffDesignations.findMany({
      where: { staffId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });

    return {
      staffId: staff.id,
      fullName: staff.fullName,
      employeeCode: staff.employeeCode,
      primaryDesignation: designations.find((d) => d.isPrimary) || null,
      designations,
    };
  }

  async createDesignation(
    organizationId: string,
    staffId: string,
    dto: CreateDesignationDto,
    currentUser?: AuthenticatedUser | string,
  ) {
    const staff = await this.validateStaff(staffId, organizationId);
    const userObj = typeof currentUser === 'object' ? currentUser : undefined;
    const currentUserId = typeof currentUser === 'string' ? currentUser : currentUser?.id;

    await this.validateAccess(staff, userObj, 'staff_designation.create');
    this.preventSelfManagement(staff, userObj, 'assign professional designations');

    // Rule: Other requires customLabel
    if (
      dto.designationType === sms_staffDesignations_designationType.other &&
      (!dto.customLabel || !dto.customLabel.trim())
    ) {
      throw new BadRequestException({
        code: 'CUSTOM_LABEL_REQUIRED',
        message: 'Custom label is required when designation type is Other',
      });
    }

    const trimmedLabel = dto.customLabel?.trim() || null;

    // Rule: Reject duplicate active designation
    const existingDuplicate = await this.prisma.sms_staffDesignations.findFirst({
      where: {
        staffId,
        designationType: dto.designationType,
        customLabel: trimmedLabel,
      },
    });

    if (existingDuplicate) {
      throw new ConflictException({
        code: 'DUPLICATE_DESIGNATION',
        message: 'This designation is already assigned to this employee',
      });
    }

    const existingCount = await this.prisma.sms_staffDesignations.count({
      where: { staffId },
    });

    // Rule: First designation must be Primary. If isPrimary is true, demote others.
    const shouldBePrimary = existingCount === 0 || dto.isPrimary === true;

    return await this.prisma.$transaction(async (tx) => {
      if (shouldBePrimary && existingCount > 0) {
        await tx.sms_staffDesignations.updateMany({
          where: { staffId },
          data: { isPrimary: false },
        });
      }

      const created = await tx.sms_staffDesignations.create({
        data: {
          staffId,
          designationType: dto.designationType,
          customLabel: trimmedLabel,
          isPrimary: shouldBePrimary,
          yearsOfExperience: dto.yearsOfExperience ?? null,
        },
      });

      await this.recordAuditLog(
        organizationId,
        currentUserId,
        'staff_designation.create',
        null,
        created,
      );

      return created;
    });
  }

  async updateDesignation(
    organizationId: string,
    staffId: string,
    designationId: string,
    dto: UpdateDesignationDto,
    currentUser?: AuthenticatedUser | string,
  ) {
    const staff = await this.validateStaff(staffId, organizationId);
    const userObj = typeof currentUser === 'object' ? currentUser : undefined;
    const currentUserId = typeof currentUser === 'string' ? currentUser : currentUser?.id;

    await this.validateAccess(staff, userObj, 'staff_designation.update');
    this.preventSelfManagement(staff, userObj, 'update professional designations');

    const existing = await this.prisma.sms_staffDesignations.findFirst({
      where: { id: designationId, staffId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'DESIGNATION_NOT_FOUND',
        message: 'Designation record not found for this employee',
      });
    }

    const targetType = dto.designationType || existing.designationType;
    const targetLabel =
      targetType === sms_staffDesignations_designationType.other
        ? (dto.customLabel !== undefined ? dto.customLabel?.trim() : existing.customLabel)
        : null;

    if (targetType === sms_staffDesignations_designationType.other && !targetLabel) {
      throw new BadRequestException({
        code: 'CUSTOM_LABEL_REQUIRED',
        message: 'Custom label is required when designation type is Other',
      });
    }

    return await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary === true && !existing.isPrimary) {
        await tx.sms_staffDesignations.updateMany({
          where: { staffId },
          data: { isPrimary: false },
        });
      }

      const updated = await tx.sms_staffDesignations.update({
        where: { id: designationId },
        data: {
          designationType: targetType,
          customLabel: targetLabel,
          isPrimary: dto.isPrimary !== undefined ? dto.isPrimary : existing.isPrimary,
          yearsOfExperience:
            dto.yearsOfExperience !== undefined
              ? dto.yearsOfExperience
              : existing.yearsOfExperience,
        },
      });

      await this.recordAuditLog(
        organizationId,
        currentUserId,
        'staff_designation.update',
        existing,
        updated,
      );

      return updated;
    });
  }

  async setPrimaryDesignation(
    organizationId: string,
    staffId: string,
    designationId: string,
    currentUser?: AuthenticatedUser | string,
  ) {
    const staff = await this.validateStaff(staffId, organizationId);
    const userObj = typeof currentUser === 'object' ? currentUser : undefined;
    const currentUserId = typeof currentUser === 'string' ? currentUser : currentUser?.id;

    await this.validateAccess(staff, userObj, 'staff_designation.update');
    this.preventSelfManagement(staff, userObj, 'change primary designation');

    const target = await this.prisma.sms_staffDesignations.findFirst({
      where: { id: designationId, staffId },
    });

    if (!target) {
      throw new NotFoundException({
        code: 'DESIGNATION_NOT_FOUND',
        message: 'Designation not found for this employee',
      });
    }

    return await this.prisma.$transaction(async (tx) => {
      await tx.sms_staffDesignations.updateMany({
        where: { staffId },
        data: { isPrimary: false },
      });

      const updated = await tx.sms_staffDesignations.update({
        where: { id: designationId },
        data: { isPrimary: true },
      });

      await this.recordAuditLog(
        organizationId,
        currentUserId,
        'staff_designation.set_primary',
        { previousPrimary: true },
        updated,
      );

      return updated;
    });
  }

  async deleteDesignation(
    organizationId: string,
    staffId: string,
    designationId: string,
    currentUser?: AuthenticatedUser | string,
  ) {
    const staff = await this.validateStaff(staffId, organizationId);
    const userObj = typeof currentUser === 'object' ? currentUser : undefined;
    const currentUserId = typeof currentUser === 'string' ? currentUser : currentUser?.id;

    await this.validateAccess(staff, userObj, 'staff_designation.delete');
    this.preventSelfManagement(staff, userObj, 'delete professional designations');

    const existing = await this.prisma.sms_staffDesignations.findFirst({
      where: { id: designationId, staffId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'DESIGNATION_NOT_FOUND',
        message: 'Designation not found for this employee',
      });
    }

    // Business rule: If employee has active service assignments, blocking removal of their ONLY designation
    const totalDesignations = await this.prisma.sms_staffDesignations.count({
      where: { staffId },
    });

    if (totalDesignations <= 1) {
      const activeServicesCount = await this.prisma.sms_staffServices.count({
        where: { staffId, isActive: true },
      });

      if (activeServicesCount > 0) {
        throw new BadRequestException({
          code: 'ACTIVE_SERVICES_BLOCK_REMOVAL',
          message:
            'Cannot remove the only remaining designation: at least one professional designation is required for staff with active service assignments. Please unassign services first or designate a replacement.',
        });
      }
    }

    return await this.prisma.$transaction(async (tx) => {
      await tx.sms_staffDesignations.delete({
        where: { id: designationId },
      });

      // Auto-promote next remaining designation to Primary if deleted was Primary
      if (existing.isPrimary) {
        const nextRemaining = await tx.sms_staffDesignations.findFirst({
          where: { staffId },
          orderBy: { createdAt: 'asc' },
        });

        if (nextRemaining) {
          await tx.sms_staffDesignations.update({
            where: { id: nextRemaining.id },
            data: { isPrimary: true },
          });
        }
      }

      await this.recordAuditLog(
        organizationId,
        currentUserId,
        'staff_designation.delete',
        existing,
        null,
      );

      return { success: true, message: 'Designation removed successfully' };
    });
  }

  // =========================================================================
  // TASK 6.2: SKILL PROFICIENCY & SPECIALIZATION
  // =========================================================================

  async getStaffSkillRatings(
    organizationId: string,
    staffId: string,
    currentUser?: AuthenticatedUser,
  ) {
    const staff = await this.validateStaff(staffId, organizationId);
    await this.validateAccess(staff, currentUser, 'staff_skill_rating.view');
    const skills = await this.prisma.sms_staffSkillRatings.findMany({
      where: { staffId },
      include: {
        verifiedBy: {
          select: { id: true, displayName: true, email: true },
        },
      },
      orderBy: [{ verificationStatus: 'desc' }, { createdAt: 'desc' }],
    });

    return {
      staffId: staff.id,
      fullName: staff.fullName,
      totalSkills: skills.length,
      verifiedCount: skills.filter(
        (s) => s.verificationStatus === sms_staffSkillRatings_verificationStatus.manager_verified,
      ).length,
      skills,
    };
  }

  async createSkillRating(
    organizationId: string,
    staffId: string,
    dto: CreateSkillRatingDto,
    currentUser: AuthenticatedUser,
  ) {
    const staff = await this.validateStaff(staffId, organizationId);

    // Normalize skill name
    const normalizedSkillName = dto.skillName.trim();
    if (!normalizedSkillName) {
      throw new BadRequestException({
        code: 'SKILL_NAME_REQUIRED',
        message: 'Skill name cannot be blank',
      });
    }

    // Check duplicate case-insensitively
    const existing = await this.prisma.sms_staffSkillRatings.findFirst({
      where: {
        staffId,
        skillName: { equals: normalizedSkillName, mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_SKILL',
        message: `Skill "${normalizedSkillName}" is already registered for this employee`,
      });
    }

    // Determine verification state:
    // If ordinary service staff self-declares, MUST BE self_declared.
    const roles = (currentUser?.roles || []).map((r) =>
      r.toUpperCase().replace(/[\s_-]+/g, '_'),
    );
    const isServiceStaffOnly =
      (roles.includes('SERVICE_STAFF') || roles.includes('STAFF')) &&
      !roles.some((r) =>
        ['SUPER_ADMIN', 'SUPERADMIN', 'OWNER', 'BRANCH_MANAGER'].includes(r),
      );

    let verificationStatus: sms_staffSkillRatings_verificationStatus =
      sms_staffSkillRatings_verificationStatus.self_declared;
    let verifiedById: string | null = null;
    let verifiedAt: Date | null = null;

    if (!isServiceStaffOnly && dto.verificationStatus === sms_staffSkillRatings_verificationStatus.manager_verified) {
      // Management verification
      verificationStatus = sms_staffSkillRatings_verificationStatus.manager_verified;
      verifiedById = currentUser.id;
      verifiedAt = new Date();
    }

    const created = await this.prisma.sms_staffSkillRatings.create({
      data: {
        staffId,
        skillName: normalizedSkillName,
        proficiencyLevel: dto.proficiencyLevel,
        verificationStatus,
        verifiedById,
        verifiedAt,
      },
      include: {
        verifiedBy: {
          select: { id: true, displayName: true, email: true },
        },
      },
    });

    await this.recordAuditLog(
      organizationId,
      currentUser.id,
      'staff_skill_rating.create',
      null,
      created,
    );

    return created;
  }

  async updateSkillRating(
    organizationId: string,
    staffId: string,
    skillId: string,
    dto: UpdateSkillRatingDto,
    currentUser: AuthenticatedUser,
  ) {
    const staff = await this.validateStaff(staffId, organizationId);
    await this.validateAccess(staff, currentUser, 'staff_skill_rating.update');

    const existing = await this.prisma.sms_staffSkillRatings.findFirst({
      where: { id: skillId, staffId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'SKILL_NOT_FOUND',
        message: 'Skill rating record not found for this employee',
      });
    }

    // Re-verification policy: If employee changes proficiency level, reset to self_declared
    const roles = (currentUser?.roles || []).map((r) =>
      r.toUpperCase().replace(/[\s_-]+/g, '_'),
    );
    const isStaffSelf = staff.userId === currentUser.id;
    let resetVerification = false;
    if (isStaffSelf && dto.proficiencyLevel && dto.proficiencyLevel !== existing.proficiencyLevel) {
      resetVerification = true;
    }

    const updated = await this.prisma.sms_staffSkillRatings.update({
      where: { id: skillId },
      data: {
        proficiencyLevel: dto.proficiencyLevel || existing.proficiencyLevel,
        skillName: dto.skillName?.trim() || existing.skillName,
        ...(resetVerification
          ? {
              verificationStatus: sms_staffSkillRatings_verificationStatus.self_declared,
              verifiedById: null,
              verifiedAt: null,
            }
          : {}),
      },
      include: {
        verifiedBy: {
          select: { id: true, displayName: true, email: true },
        },
      },
    });

    await this.recordAuditLog(
      organizationId,
      currentUser.id,
      'staff_skill_rating.update',
      existing,
      updated,
    );

    return updated;
  }

  async verifySkillRating(
    organizationId: string,
    staffId: string,
    skillId: string,
    currentUser: AuthenticatedUser | string,
    note?: string,
  ) {
    const currentUserId = typeof currentUser === 'string' ? currentUser : currentUser.id;
    const staff = await this.validateStaff(staffId, organizationId);
    await this.validateAccess(staff, currentUser, 'staff_skill_rating.approve');

    // Business rule: Staff cannot verify their own skills!
    if (staff.userId === currentUserId) {
      throw new ForbiddenException({
        code: 'SELF_VERIFICATION_FORBIDDEN',
        message: 'Employees are strictly prohibited from verifying their own skills',
      });
    }

    const existing = await this.prisma.sms_staffSkillRatings.findFirst({
      where: { id: skillId, staffId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'SKILL_NOT_FOUND',
        message: 'Skill rating record not found',
      });
    }

    const updated = await this.prisma.sms_staffSkillRatings.update({
      where: { id: skillId },
      data: {
        verificationStatus: sms_staffSkillRatings_verificationStatus.manager_verified,
        verifiedById: currentUserId,
        verifiedAt: new Date(),
      },
      include: {
        verifiedBy: {
          select: { id: true, displayName: true, email: true },
        },
      },
    });

    await this.recordAuditLog(
      organizationId,
      currentUserId,
      'staff_skill_rating.verify',
      existing,
      { ...updated, verificationNote: note || null },
    );

    return updated;
  }

  async rejectSkillRating(
    organizationId: string,
    staffId: string,
    skillId: string,
    currentUser: AuthenticatedUser,
    reason?: string,
  ) {
    const staff = await this.validateStaff(staffId, organizationId);
    await this.validateAccess(staff, currentUser, 'staff_skill_rating.reject');

    if (staff.userId === currentUser.id) {
      throw new ForbiddenException({
        code: 'SELF_REJECTION_FORBIDDEN',
        message: 'Employees cannot reject their own skills via management workflow',
      });
    }

    const existing = await this.prisma.sms_staffSkillRatings.findFirst({
      where: { id: skillId, staffId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'SKILL_NOT_FOUND',
        message: 'Skill rating record not found',
      });
    }

    // Rejection resets verification status to self_declared with audit record
    const updated = await this.prisma.sms_staffSkillRatings.update({
      where: { id: skillId },
      data: {
        verificationStatus: sms_staffSkillRatings_verificationStatus.self_declared,
        verifiedById: null,
        verifiedAt: null,
      },
    });

    await this.recordAuditLog(
      organizationId,
      currentUser.id,
      'staff_skill_rating.reject',
      existing,
      { ...updated, rejectionReason: reason || null },
    );

    return {
      success: true,
      message: 'Skill verification rejected and status restored to self-declared',
      skill: updated,
    };
  }

  async deleteSkillRating(
    organizationId: string,
    staffId: string,
    skillId: string,
    currentUser: AuthenticatedUser,
  ) {
    const staff = await this.validateStaff(staffId, organizationId);
    await this.validateAccess(staff, currentUser, 'staff_skill_rating.delete');

    const existing = await this.prisma.sms_staffSkillRatings.findFirst({
      where: { id: skillId, staffId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'SKILL_NOT_FOUND',
        message: 'Skill rating record not found',
      });
    }

    await this.prisma.sms_staffSkillRatings.delete({
      where: { id: skillId },
    });

    await this.recordAuditLog(
      organizationId,
      currentUser.id,
      'staff_skill_rating.delete',
      existing,
      null,
    );

    return { success: true, message: 'Skill rating removed' };
  }

  // =========================================================================
  // TASK 6.3: SERVICE ASSIGNMENT
  // =========================================================================

  async getAssignedServices(
    organizationId: string,
    staffId: string,
    currentUser?: AuthenticatedUser,
  ) {
    const staff = await this.validateStaff(staffId, organizationId);
    await this.validateAccess(staff, currentUser, 'staff_service.view');
    const assignments = await this.prisma.sms_staffServices.findMany({
      where: { staffId },
      include: {
        service: {
          include: {
            category: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        assignedBy: {
          select: { id: true, displayName: true, email: true },
        },
        staffServiceBranchOverrides: {
          include: {
            branch: {
              select: { id: true, name: true, code: true },
            },
          },
        },
      },
      orderBy: [{ isActive: 'desc' }, { assignedAt: 'desc' }],
    });

    return {
      staffId: staff.id,
      fullName: staff.fullName,
      totalAssigned: assignments.length,
      activeCount: assignments.filter((a) => a.isActive).length,
      assignments: assignments.map((a) => ({
        id: a.id,
        serviceId: a.serviceId,
        serviceName: a.service?.name,
        categoryName: a.service?.category?.name,
        categoryId: a.service?.categoryId,
        catalogDurationMinutes: a.service?.baseDurationMinutes,
        durationOverrideMinutes: a.durationOverrideMinutes,
        effectiveDurationMinutes:
          a.durationOverrideMinutes || a.service?.baseDurationMinutes,
        basePriceAmount: a.service?.basePriceAmount,
        isActive: a.isActive,
        serviceStatus: a.service?.status,
        assignedAt: a.assignedAt,
        assignedBy: a.assignedBy,
        branchOverridesCount: a.staffServiceBranchOverrides.length,
        branchOverrides: a.staffServiceBranchOverrides,
      })),
    };
  }

  async getAvailableCatalogServices(
    organizationId: string,
    staffId: string,
    currentUser?: AuthenticatedUser,
    search?: string,
    categoryId?: string,
  ) {
    const staff = await this.validateStaff(staffId, organizationId);
    await this.validateAccess(staff, currentUser, 'staff_service.view');
    // Fetch staff designations and verified skills for intelligent suggestion badges
    const [designations, verifiedSkills, assignedServices] = await Promise.all([
      this.prisma.sms_staffDesignations.findMany({ where: { staffId } }),
      this.prisma.sms_staffSkillRatings.findMany({
        where: {
          staffId,
          verificationStatus: sms_staffSkillRatings_verificationStatus.manager_verified,
        },
      }),
      this.prisma.sms_staffServices.findMany({
        where: { staffId },
        select: { serviceId: true, isActive: true },
      }),
    ]);

    const assignedServiceMap = new Map(
      assignedServices.map((as) => [as.serviceId, as.isActive]),
    );

    // Filter services from Module 11
    const whereClause: Prisma.sms_servicesWhereInput = {
      organizationId,
      deletedAt: null,
      status: 'active',
      ...(categoryId ? { categoryId } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const services = await this.prisma.sms_services.findMany({
      where: whereClause,
      include: {
        category: {
          select: { id: true, name: true, slug: true, displayOrder: true },
        },
      },
      orderBy: [
        { category: { displayOrder: 'asc' } },
        { name: 'asc' },
      ],
    });

    // Helper: Determine if service matches designation or skill
    const designationTypes = designations.map((d) => d.designationType.toLowerCase());
    const verifiedSkillNames = verifiedSkills.map((s) => s.skillName.toLowerCase());

    return services.map((s) => {
      const isAssigned = assignedServiceMap.has(s.id);
      const isCurrentlyActive = assignedServiceMap.get(s.id) === true;
      const sName = s.name.toLowerCase();
      const catName = s.category?.name.toLowerCase() || '';

      // Match heuristic for suggestions:
      let isSuggested = false;
      let suggestionReason = '';

      if (
        (designationTypes.includes('stylist') || designationTypes.includes('hairdresser')) &&
        (catName.includes('hair') || sName.includes('hair') || sName.includes('cut'))
      ) {
        isSuggested = true;
        suggestionReason = 'Matches Hair Stylist designation';
      } else if (
        designationTypes.includes('nail_technician') &&
        (catName.includes('nail') || sName.includes('manicure') || sName.includes('pedicure'))
      ) {
        isSuggested = true;
        suggestionReason = 'Matches Nail Technician designation';
      } else if (
        designationTypes.includes('makeup_artist') &&
        (catName.includes('makeup') || sName.includes('bridal') || sName.includes('makeup'))
      ) {
        isSuggested = true;
        suggestionReason = 'Matches Makeup Artist designation';
      } else if (
        designationTypes.includes('therapist') &&
        (catName.includes('massage') || catName.includes('spa') || sName.includes('therapy'))
      ) {
        isSuggested = true;
        suggestionReason = 'Matches Therapist designation';
      } else if (
        designationTypes.includes('beautician') &&
        (catName.includes('skin') || catName.includes('facial') || sName.includes('wax'))
      ) {
        isSuggested = true;
        suggestionReason = 'Matches Beautician designation';
      }

      // Check skill matches
      for (const vSkill of verifiedSkillNames) {
        if (sName.includes(vSkill) || vSkill.includes(sName)) {
          isSuggested = true;
          suggestionReason = `Matches verified skill: ${vSkill}`;
          break;
        }
      }

      return {
        id: s.id,
        name: s.name,
        categoryId: s.categoryId,
        categoryName: s.category?.name,
        baseDurationMinutes: s.baseDurationMinutes,
        basePriceAmount: s.basePriceAmount,
        isAssigned,
        isActive: isCurrentlyActive,
        isSuggested,
        suggestionReason,
      };
    });
  }

  async assignService(
    organizationId: string,
    staffId: string,
    dto: AssignServiceDto,
    currentUser?: AuthenticatedUser | string,
  ) {
    const staff = await this.validateStaff(staffId, organizationId);
    const userObj = typeof currentUser === 'object' ? currentUser : undefined;
    const currentUserId = typeof currentUser === 'string' ? currentUser : currentUser?.id;

    await this.validateAccess(staff, userObj, 'staff_service.create');
    this.preventSelfManagement(staff, userObj, 'assign services');

    // Business rule: Must have at least 1 designation
    const designationsCount = await this.prisma.sms_staffDesignations.count({
      where: { staffId },
    });
    if (designationsCount === 0) {
      throw new BadRequestException({
        code: 'DESIGNATION_REQUIRED',
        message:
          'Employee must have at least one professional service designation before services can be assigned',
      });
    }

    // Validate service in organization
    const service = await this.prisma.sms_services.findFirst({
      where: {
        id: dto.serviceId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!service) {
      throw new NotFoundException({
        code: 'SERVICE_NOT_FOUND',
        message: 'Service record not found in this organization',
      });
    }

    if (service.status !== 'active') {
      throw new BadRequestException({
        code: 'INACTIVE_SERVICE',
        message: `Service "${service.name}" is currently ${service.status} and cannot be assigned`,
      });
    }

    const existing = await this.prisma.sms_staffServices.findFirst({
      where: { staffId, serviceId: dto.serviceId },
    });

    if (existing && existing.isActive) {
      throw new ConflictException({
        code: 'SERVICE_ALREADY_ASSIGNED',
        message: 'This service is already actively assigned to this employee',
      });
    }

    const assignment = await this.prisma.sms_staffServices.upsert({
      where: { staffId_serviceId: { staffId, serviceId: dto.serviceId } },
      update: {
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        durationOverrideMinutes: dto.durationOverrideMinutes ?? existing?.durationOverrideMinutes,
        assignedById: currentUserId || null,
        assignedAt: new Date(),
      },
      create: {
        staffId,
        serviceId: dto.serviceId,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        durationOverrideMinutes: dto.durationOverrideMinutes ?? null,
        assignedById: currentUserId || null,
      },
      include: {
        service: true,
      },
    });

    await this.recordAuditLog(
      organizationId,
      currentUserId,
      'staff_service.assign',
      existing,
      assignment,
    );

    return assignment;
  }

  async bulkAssignServices(
    organizationId: string,
    staffId: string,
    dto: BulkAssignServicesDto,
    currentUser?: AuthenticatedUser | string,
  ) {
    const staff = await this.validateStaff(staffId, organizationId);
    const userObj = typeof currentUser === 'object' ? currentUser : undefined;
    const currentUserId = typeof currentUser === 'string' ? currentUser : currentUser?.id;

    await this.validateAccess(staff, userObj, 'staff_service.manage');
    this.preventSelfManagement(staff, userObj, 'bulk assign services');

    const designationsCount = await this.prisma.sms_staffDesignations.count({
      where: { staffId },
    });
    if (designationsCount === 0) {
      throw new BadRequestException({
        code: 'DESIGNATION_REQUIRED',
        message:
          'Employee must have at least one professional designation before services can be assigned',
      });
    }

    // Validate all services belong to org and are active
    const validServices = await this.prisma.sms_services.findMany({
      where: {
        id: { in: dto.serviceIds },
        organizationId,
        deletedAt: null,
        status: 'active',
      },
    });

    if (validServices.length === 0) {
      throw new BadRequestException({
        code: 'NO_VALID_SERVICES',
        message: 'None of the provided service IDs are valid and active in this organization',
      });
    }

    const results = await this.prisma.$transaction(async (tx) => {
      const assignments: any[] = [];
      for (const service of validServices) {
        const assigned = await tx.sms_staffServices.upsert({
          where: { staffId_serviceId: { staffId, serviceId: service.id } },
          update: {
            isActive: true,
            durationOverrideMinutes: dto.defaultDurationOverrideMinutes ?? undefined,
            assignedById: currentUserId || null,
            assignedAt: new Date(),
          },
          create: {
            staffId,
            serviceId: service.id,
            isActive: true,
            durationOverrideMinutes: dto.defaultDurationOverrideMinutes ?? null,
            assignedById: currentUserId || null,
          },
        });
        assignments.push(assigned);
      }
      return assignments;
    });

    await this.recordAuditLog(
      organizationId,
      currentUserId,
      'staff_service.bulk_assign',
      null,
      { assignedCount: results.length, serviceIds: validServices.map((s) => s.id) },
    );

    return {
      success: true,
      assignedCount: results.length,
      assignments: results,
    };
  }

  async updateServiceAssignment(
    organizationId: string,
    staffId: string,
    assignmentId: string,
    dto: UpdateDurationOverrideDto,
    currentUser?: AuthenticatedUser | string,
  ) {
    const staff = await this.validateStaff(staffId, organizationId);
    const userObj = typeof currentUser === 'object' ? currentUser : undefined;
    const currentUserId = typeof currentUser === 'string' ? currentUser : currentUser?.id;

    await this.validateAccess(staff, userObj, 'staff_service.update');

    const existing = await this.prisma.sms_staffServices.findFirst({
      where: { id: assignmentId, staffId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'ASSIGNMENT_NOT_FOUND',
        message: 'Service assignment record not found for this employee',
      });
    }

    const updated = await this.prisma.sms_staffServices.update({
      where: { id: assignmentId },
      data: {
        durationOverrideMinutes:
          dto.durationOverrideMinutes !== undefined
            ? dto.durationOverrideMinutes
            : existing.durationOverrideMinutes,
        isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
      },
      include: {
        service: true,
      },
    });

    await this.recordAuditLog(
      organizationId,
      currentUserId,
      'staff_service.update',
      existing,
      updated,
    );

    return updated;
  }

  async deleteServiceAssignment(
    organizationId: string,
    staffId: string,
    assignmentId: string,
    currentUser?: AuthenticatedUser | string,
  ) {
    const staff = await this.validateStaff(staffId, organizationId);
    const userObj = typeof currentUser === 'object' ? currentUser : undefined;
    const currentUserId = typeof currentUser === 'string' ? currentUser : currentUser?.id;

    await this.validateAccess(staff, userObj, 'staff_service.delete');
    this.preventSelfManagement(staff, userObj, 'unassign services');

    const existing = await this.prisma.sms_staffServices.findFirst({
      where: { id: assignmentId, staffId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'ASSIGNMENT_NOT_FOUND',
        message: 'Service assignment not found for this employee',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      // Clean up related branch overrides
      await tx.sms_staffServiceBranchOverrides.deleteMany({
        where: { staffServiceId: assignmentId },
      });

      await tx.sms_staffServices.delete({
        where: { id: assignmentId },
      });
    });

    await this.recordAuditLog(
      organizationId,
      currentUserId,
      'staff_service.unassign',
      existing,
      null,
    );

    return { success: true, message: 'Service assignment removed successfully' };
  }

  // =========================================================================
  // TASK 6.4: BRANCH-WISE SERVICE AVAILABILITY (EXCEPTION-BASED)
  // =========================================================================

  async getBranchServiceAvailability(
    organizationId: string,
    staffId: string,
    staffServiceId?: string,
    currentUser?: AuthenticatedUser,
  ) {
    const staff = await this.validateStaff(staffId, organizationId);
    await this.validateAccess(staff, currentUser, 'staff_service_branch.view');
    // Get all assigned branches for employee
    const assignedBranches = [
      {
        id: staff.homeBranch.id,
        name: staff.homeBranch.name,
        code: staff.homeBranch.code,
        isHomeBranch: true,
      },
      ...staff.staffBranchAssignments
        .filter((sba) => sba.branchId !== staff.homeBranchId)
        .map((sba) => ({
          id: sba.branch.id,
          name: sba.branch.name,
          code: sba.branch.code,
          isHomeBranch: false,
        })),
    ];

    // Get staff services
    const staffServices = await this.prisma.sms_staffServices.findMany({
      where: {
        staffId,
        isActive: true,
        ...(staffServiceId ? { id: staffServiceId } : {}),
      },
      include: {
        service: true,
        staffServiceBranchOverrides: {
          include: {
            branch: {
              select: { id: true, name: true, code: true },
            },
          },
        },
      },
    });

    // Build effective availability matrix
    const matrix = staffServices.map((ss) => {
      const overrideMap = new Map(
        ss.staffServiceBranchOverrides.map((o) => [o.branchId, o]),
      );

      const branchAvailability = assignedBranches.map((branch) => {
        const override = overrideMap.get(branch.id);
        const isOverride = !!override;
        const isAvailable = isOverride ? override.isAvailable : true; // Default: available at all assigned branches

        return {
          branchId: branch.id,
          branchName: branch.name,
          branchCode: branch.code,
          isHomeBranch: branch.isHomeBranch,
          isAvailable,
          isOverride,
          overrideId: override?.id || null,
          reason: override?.reason || null,
        };
      });

      return {
        staffServiceId: ss.id,
        serviceId: ss.serviceId,
        serviceName: ss.service?.name,
        exceptionsCount: ss.staffServiceBranchOverrides.length,
        branchAvailability,
      };
    });

    return {
      staffId: staff.id,
      fullName: staff.fullName,
      assignedBranchesCount: assignedBranches.length,
      assignedBranches,
      matrix,
    };
  }

  async createOrUpdateBranchOverride(
    organizationId: string,
    staffId: string,
    staffServiceId: string,
    dto: CreateBranchOverrideDto,
    currentUser?: AuthenticatedUser | string,
  ) {
    const staff = await this.validateStaff(staffId, organizationId);
    const userObj = typeof currentUser === 'object' ? currentUser : undefined;
    const currentUserId = typeof currentUser === 'string' ? currentUser : currentUser?.id;

    await this.validateAccess(staff, userObj, 'staff_service_branch.create', dto.branchId);
    this.preventSelfManagement(staff, userObj, 'configure branch availability overrides');

    const staffService = await this.prisma.sms_staffServices.findFirst({
      where: { id: staffServiceId, staffId },
      include: { service: true },
    });

    if (!staffService) {
      throw new NotFoundException({
        code: 'STAFF_SERVICE_NOT_FOUND',
        message: 'Staff service assignment not found',
      });
    }

    // Validate branch belongs to employee's assigned branches
    const isHome = staff.homeBranchId === dto.branchId;
    const isSecondary = staff.staffBranchAssignments.some(
      (sba) => sba.branchId === dto.branchId,
    );

    if (!isHome && !isSecondary) {
      throw new BadRequestException({
        code: 'BRANCH_NOT_ASSIGNED_TO_STAFF',
        message: 'Branch is not currently assigned to this employee',
      });
    }

    // Business rule: Attempt to mark service unavailable at Home Branch when it's their ONLY branch -> Block!
    const totalBranchesCount = 1 + staff.staffBranchAssignments.filter((b) => b.branchId !== staff.homeBranchId).length;
    if (isHome && totalBranchesCount === 1 && dto.isAvailable === false) {
      throw new BadRequestException({
        code: 'CANNOT_DISABLE_HOME_ONLY_BRANCH',
        message:
          'Cannot mark service unavailable at home branch when it is the employee’s only assigned branch. Please unassign the service entirely instead.',
      });
    }

    const existingOverride = await this.prisma.sms_staffServiceBranchOverrides.findUnique({
      where: {
        staffServiceId_branchId: {
          staffServiceId,
          branchId: dto.branchId,
        },
      },
    });

    const override = await this.prisma.sms_staffServiceBranchOverrides.upsert({
      where: {
        staffServiceId_branchId: {
          staffServiceId,
          branchId: dto.branchId,
        },
      },
      update: {
        isAvailable: dto.isAvailable !== undefined ? dto.isAvailable : false,
        reason: dto.reason?.trim() || null,
      },
      create: {
        staffServiceId,
        branchId: dto.branchId,
        isAvailable: dto.isAvailable !== undefined ? dto.isAvailable : false,
        reason: dto.reason?.trim() || null,
        createdById: currentUserId || null,
      },
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    await this.recordAuditLog(
      organizationId,
      currentUserId,
      'staff_service_branch.override',
      existingOverride,
      override,
    );

    return override;
  }

  async deleteBranchOverride(
    organizationId: string,
    staffId: string,
    staffServiceId: string,
    branchId: string,
    currentUser?: AuthenticatedUser | string,
  ) {
    const staff = await this.validateStaff(staffId, organizationId);
    const userObj = typeof currentUser === 'object' ? currentUser : undefined;
    const currentUserId = typeof currentUser === 'string' ? currentUser : currentUser?.id;

    await this.validateAccess(staff, userObj, 'staff_service_branch.delete', branchId);
    this.preventSelfManagement(staff, userObj, 'remove branch availability overrides');

    const existing = await this.prisma.sms_staffServiceBranchOverrides.findUnique({
      where: {
        staffServiceId_branchId: {
          staffServiceId,
          branchId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'OVERRIDE_NOT_FOUND',
        message: 'No branch exception found to remove (availability is already default)',
      });
    }

    await this.prisma.sms_staffServiceBranchOverrides.delete({
      where: {
        staffServiceId_branchId: {
          staffServiceId,
          branchId,
        },
      },
    });

    await this.recordAuditLog(
      organizationId,
      currentUserId,
      'staff_service_branch.remove_override',
      existing,
      null,
    );

    return {
      success: true,
      message: 'Branch exception removed; inherited default availability restored',
    };
  }

  // =========================================================================
  // TASK 6.5: COMMISSION ELIGIBILITY & RATE OVERRIDE
  // =========================================================================

  async getStaffCommissionConfiguration(
    organizationId: string,
    staffId: string,
    currentUser?: AuthenticatedUser,
  ) {
    const staff = await this.validateStaff(staffId, organizationId);
    await this.validateAccess(staff, currentUser, 'staff_commission.view');
    // Fetch all commission overrides for this staff
    const overrides = await this.prisma.sms_staffCommissionRates.findMany({
      where: { staffId },
      include: {
        service: {
          select: { id: true, name: true, categoryId: true },
        },
        createdBy: {
          select: { id: true, displayName: true, email: true },
        },
      },
      orderBy: [{ serviceId: 'asc' }, { effectiveFrom: 'desc' }],
    });

    // Check staff-wide eligibility: if any active staff-wide rate has isCommissionEligible false, or default true
    const staffWideDefault = overrides.find((o) => o.serviceId === null);
    const isCommissionEligible = staffWideDefault ? staffWideDefault.isCommissionEligible : true;

    // Fetch assigned services to resolve effective rates
    const assignedServices = await this.prisma.sms_staffServices.findMany({
      where: { staffId, isActive: true },
      include: {
        service: {
          include: {
            category: { select: { id: true, name: true } },
          },
        },
      },
    });

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Resolve effective rate for each assigned service
    const resolvedServices = assignedServices.map((as) => {
      const sId = as.serviceId;
      const sName = as.service?.name;
      const catName = as.service?.category?.name;

      if (!isCommissionEligible) {
        return {
          serviceId: sId,
          serviceName: sName,
          categoryName: catName,
          isEligible: false,
          effectiveType: 'percentage',
          effectiveValue: 0,
          source: 'not_eligible',
          sourceLabel: 'Not Eligible for Commission',
          isFuture: false,
          effectiveFrom: null,
          effectiveTo: null,
        };
      }

      // 1. Service-specific override active today
      const serviceOverride = overrides.find((o) => {
        if (o.serviceId !== sId) return false;
        const from = o.effectiveFrom.toISOString().split('T')[0];
        const to = o.effectiveTo ? o.effectiveTo.toISOString().split('T')[0] : null;
        return from <= todayStr && (!to || to >= todayStr);
      });

      if (serviceOverride) {
        return {
          serviceId: sId,
          serviceName: sName,
          categoryName: catName,
          isEligible: true,
          effectiveType: serviceOverride.commissionType,
          effectiveValue: Number(serviceOverride.commissionValue),
          source: 'service_override',
          sourceLabel: 'Service-specific override',
          isFuture: false,
          effectiveFrom: serviceOverride.effectiveFrom,
          effectiveTo: serviceOverride.effectiveTo,
          overrideId: serviceOverride.id,
        };
      }

      // 2. Staff-wide override active today
      const staffOverride = overrides.find((o) => {
        if (o.serviceId !== null) return false;
        const from = o.effectiveFrom.toISOString().split('T')[0];
        const to = o.effectiveTo ? o.effectiveTo.toISOString().split('T')[0] : null;
        return from <= todayStr && (!to || to >= todayStr);
      });

      if (staffOverride) {
        return {
          serviceId: sId,
          serviceName: sName,
          categoryName: catName,
          isEligible: true,
          effectiveType: staffOverride.commissionType,
          effectiveValue: Number(staffOverride.commissionValue),
          source: 'staff_override',
          sourceLabel: 'Staff-wide default override',
          isFuture: false,
          effectiveFrom: staffOverride.effectiveFrom,
          effectiveTo: staffOverride.effectiveTo,
          overrideId: staffOverride.id,
        };
      }

      // 3. Organization default (10.00% default baseline)
      return {
        serviceId: sId,
        serviceName: sName,
        categoryName: catName,
        isEligible: true,
        effectiveType: 'percentage',
        effectiveValue: 10.0,
        source: 'org_default',
        sourceLabel: 'Organization default (10%)',
        isFuture: false,
        effectiveFrom: null,
        effectiveTo: null,
      };
    });

    return {
      staffId: staff.id,
      fullName: staff.fullName,
      isCommissionEligible,
      overrides,
      resolvedServices,
    };
  }

  async setCommissionEligibility(
    organizationId: string,
    staffId: string,
    dto: SetCommissionEligibilityDto,
    currentUser?: AuthenticatedUser | string,
  ) {
    const staff = await this.validateStaff(staffId, organizationId);
    const userObj = typeof currentUser === 'object' ? currentUser : undefined;
    const currentUserId = typeof currentUser === 'string' ? currentUser : currentUser?.id;

    await this.validateAccess(staff, userObj, 'staff_commission.manage');
    this.preventSelfManagement(staff, userObj, 'change commission eligibility');

    // Update all existing overrides or create a staff-wide entry
    const existingStaffWide = await this.prisma.sms_staffCommissionRates.findFirst({
      where: { staffId, serviceId: null },
    });

    let result;
    if (existingStaffWide) {
      result = await this.prisma.sms_staffCommissionRates.updateMany({
        where: { staffId },
        data: {
          isCommissionEligible: dto.isCommissionEligible,
        },
      });
    } else {
      // Create baseline staff-wide entry
      result = await this.prisma.sms_staffCommissionRates.create({
        data: {
          staffId,
          serviceId: null,
          isCommissionEligible: dto.isCommissionEligible,
          commissionType: sms_commission_type.percentage,
          commissionValue: 10.0,
          effectiveFrom: new Date(),
          createdById: currentUserId || null,
        },
      });
    }

    await this.recordAuditLog(
      organizationId,
      currentUserId,
      'staff_commission.set_eligibility',
      { previousEligible: !dto.isCommissionEligible },
      { isCommissionEligible: dto.isCommissionEligible },
    );

    return {
      success: true,
      isCommissionEligible: dto.isCommissionEligible,
    };
  }

  async createCommissionOverride(
    organizationId: string,
    staffId: string,
    dto: CreateCommissionOverrideDto,
    currentUser?: AuthenticatedUser | string,
  ) {
    const staff = await this.validateStaff(staffId, organizationId);
    const userObj = typeof currentUser === 'object' ? currentUser : undefined;
    const currentUserId = typeof currentUser === 'string' ? currentUser : currentUser?.id;

    await this.validateAccess(staff, userObj, 'staff_commission.create');
    this.preventSelfManagement(staff, userObj, 'configure commission overrides');

    // Validate percentage limits
    if (dto.commissionType === sms_commission_type.percentage) {
      if (dto.commissionValue < 0 || dto.commissionValue > 100) {
        throw new BadRequestException({
          code: 'INVALID_COMMISSION_PERCENTAGE',
          message: 'Commission percentage must be between 0 and 100',
        });
      }
    }

    const fromDate = new Date(dto.effectiveFrom);
    const toDate = dto.effectiveTo ? new Date(dto.effectiveTo) : null;

    if (toDate && toDate < fromDate) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: 'Effective To date cannot be earlier than Effective From date',
      });
    }

    // If serviceId provided, validate service belongs to org
    if (dto.serviceId) {
      const srv = await this.prisma.sms_services.findFirst({
        where: { id: dto.serviceId, organizationId, deletedAt: null },
      });
      if (!srv) {
        throw new NotFoundException({
          code: 'SERVICE_NOT_FOUND',
          message: 'Target service not found in this organization',
        });
      }
    }

    // Check overlapping date ranges for the same scope
    const existingSameScope = await this.prisma.sms_staffCommissionRates.findMany({
      where: {
        staffId,
        serviceId: dto.serviceId || null,
      },
    });

    for (const ex of existingSameScope) {
      const exFrom = ex.effectiveFrom;
      const exTo = ex.effectiveTo;

      const overlaps =
        (!toDate || exFrom <= toDate) && (!exTo || exTo >= fromDate);

      if (overlaps) {
        throw new BadRequestException({
          code: 'COMMISSION_DATE_OVERLAP',
          message:
            'Overlapping effective-date ranges for the same commission scope are not allowed. Please close out the previous override first.',
        });
      }
    }

    const created = await this.prisma.sms_staffCommissionRates.create({
      data: {
        staffId,
        serviceId: dto.serviceId || null,
        commissionType: dto.commissionType,
        commissionValue: dto.commissionValue,
        effectiveFrom: fromDate,
        effectiveTo: toDate,
        createdById: currentUserId || null,
      },
      include: {
        service: true,
      },
    });

    await this.recordAuditLog(
      organizationId,
      currentUserId,
      'staff_commission.create_override',
      null,
      created,
    );

    return created;
  }

  async updateCommissionOverride(
    organizationId: string,
    staffId: string,
    overrideId: string,
    dto: UpdateCommissionOverrideDto,
    currentUser?: AuthenticatedUser | string,
  ) {
    const staff = await this.validateStaff(staffId, organizationId);
    const userObj = typeof currentUser === 'object' ? currentUser : undefined;
    const currentUserId = typeof currentUser === 'string' ? currentUser : currentUser?.id;

    await this.validateAccess(staff, userObj, 'staff_commission.update');
    this.preventSelfManagement(staff, userObj, 'modify commission overrides');

    const existing = await this.prisma.sms_staffCommissionRates.findFirst({
      where: { id: overrideId, staffId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'COMMISSION_OVERRIDE_NOT_FOUND',
        message: 'Commission override record not found',
      });
    }

    const type = dto.commissionType || existing.commissionType;
    const value = dto.commissionValue !== undefined ? dto.commissionValue : Number(existing.commissionValue);

    if (type === sms_commission_type.percentage && (value < 0 || value > 100)) {
      throw new BadRequestException({
        code: 'INVALID_COMMISSION_PERCENTAGE',
        message: 'Commission percentage must be between 0 and 100',
      });
    }

    const fromDate = dto.effectiveFrom ? new Date(dto.effectiveFrom) : existing.effectiveFrom;
    const toDate = dto.effectiveTo !== undefined ? (dto.effectiveTo ? new Date(dto.effectiveTo) : null) : existing.effectiveTo;

    if (toDate && toDate < fromDate) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: 'Effective To date cannot be earlier than Effective From date',
      });
    }

    const updated = await this.prisma.sms_staffCommissionRates.update({
      where: { id: overrideId },
      data: {
        commissionType: type,
        commissionValue: value,
        effectiveFrom: fromDate,
        effectiveTo: toDate,
        isCommissionEligible:
          dto.isCommissionEligible !== undefined
            ? dto.isCommissionEligible
            : existing.isCommissionEligible,
      },
      include: {
        service: true,
      },
    });

    await this.recordAuditLog(
      organizationId,
      currentUserId,
      'staff_commission.update_override',
      existing,
      updated,
    );

    return updated;
  }

  async deleteCommissionOverride(
    organizationId: string,
    staffId: string,
    overrideId: string,
    currentUser?: AuthenticatedUser | string,
  ) {
    const staff = await this.validateStaff(staffId, organizationId);
    const userObj = typeof currentUser === 'object' ? currentUser : undefined;
    const currentUserId = typeof currentUser === 'string' ? currentUser : currentUser?.id;

    await this.validateAccess(staff, userObj, 'staff_commission.delete');
    this.preventSelfManagement(staff, userObj, 'delete commission overrides');

    const existing = await this.prisma.sms_staffCommissionRates.findFirst({
      where: { id: overrideId, staffId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'COMMISSION_OVERRIDE_NOT_FOUND',
        message: 'Commission override record not found',
      });
    }

    await this.prisma.sms_staffCommissionRates.delete({
      where: { id: overrideId },
    });

    await this.recordAuditLog(
      organizationId,
      currentUserId,
      'staff_commission.delete_override',
      existing,
      null,
    );

    return { success: true, message: 'Commission override removed' };
  }
}

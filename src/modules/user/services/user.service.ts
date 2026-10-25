import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateUserInviteDto } from '../dto/create-user-invite.dto';
import { QueryUsersDto } from '../dto/query-users.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { AcceptInviteDto } from '../dto/accept-invite.dto';
import { ChangeUserStatusDto } from '../dto/change-user-status.dto';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  /**
   * Helper to resolve actor roles and branch assignments
   */
  async getActorRolesAndBranches(actorId: string): Promise<{
    isSuperAdmin: boolean;
    isOwner: boolean;
    isBranchManager: boolean;
    assignedBranchIds: string[];
  }> {
    const userRoles = await this.prisma.sms_userRoles.findMany({
      where: { userId: actorId, removedAt: null },
      include: { role: true },
    });
    const safeRoles = Array.isArray(userRoles) ? userRoles : [];
    const slugs = safeRoles
      .map((ur) => ur.role?.slug?.toLowerCase())
      .filter((s): s is string => Boolean(s));
    const names = safeRoles
      .map((ur) => ur.role?.name?.toUpperCase().replace(/\s+/g, '_'))
      .filter((n): n is string => Boolean(n));
    const all = [...slugs, ...names];

    const isSuperAdmin = all.some(
      (r) => r === 'super-admin' || r === 'SUPER_ADMIN' || r === 'SUPER ADMIN',
    );
    const isOwner = all.some((r) => r === 'owner' || r === 'OWNER');
    const isBranchManager = all.some(
      (r) => r === 'branch-manager' || r === 'BRANCH_MANAGER' || r === 'BRANCH MANAGER',
    );

    let assignedBranchIds: string[] = [];
    if (isBranchManager) {
      const bmBranches = await this.prisma.sms_userBranchAssignments.findMany({
        where: { userId: actorId },
        select: { branchId: true },
      });
      assignedBranchIds = Array.isArray(bmBranches) ? bmBranches.map((b) => b.branchId) : [];
    }

    return { isSuperAdmin, isOwner, isBranchManager, assignedBranchIds };
  }

  /**
   * List organization users with search, filtering, role/branch summaries, and pagination
   */
  async findAll(organizationId: string, query: QueryUsersDto, actorOrId?: AuthenticatedUser | string) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.sms_usersWhereInput = {
      organizationId,
      deletedAt: null,
    };

    // Enforce branch scope if actor is Branch Manager
    const actorId = typeof actorOrId === 'string' ? actorOrId : actorOrId?.id;
    if (actorId) {
      const actorContext = await this.getActorRolesAndBranches(actorId);
      if (!actorContext.isSuperAdmin && !actorContext.isOwner && actorContext.isBranchManager) {
        if (actorContext.assignedBranchIds.length === 0) {
          return {
            data: [],
            total: 0,
            page,
            limit,
            totalPages: 1,
          };
        }

        if (query.branchId) {
          if (!actorContext.assignedBranchIds.includes(query.branchId)) {
            return {
              data: [],
              total: 0,
              page,
              limit,
              totalPages: 1,
            };
          }
        } else {
          where.userBranchAssignmentsForMe = {
            some: {
              branchId: { in: actorContext.assignedBranchIds },
            },
          };
        }
      }
    }

    // Status filter
    if (query.status) {
      where.status = query.status;
    }

    // Role filter
    if (query.roleId) {
      where.userRolesAssignedToMe = {
        some: {
          roleId: query.roleId,
          removedAt: null,
        },
      };
    }

    // Branch filter
    if (query.branchId) {
      where.userBranchAssignmentsForMe = {
        some: {
          branchId: query.branchId,
        },
      };
    }

    // Search query
    if (query.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { displayName: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
        { phoneNumber: { contains: s, mode: 'insensitive' } },
      ];
    }

    // Sorting
    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';
    const orderBy: Prisma.sms_usersOrderByWithRelationInput = {
      [sortField]: sortOrder,
    };

    const [total, users] = await Promise.all([
      this.prisma.sms_users.count({ where }),
      this.prisma.sms_users.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          userRolesAssignedToMe: {
            where: { removedAt: null },
            include: { role: true },
          },
          userBranchAssignmentsForMe: {
            include: { branch: true },
          },
          createdBy: {
            select: { id: true, displayName: true, email: true },
          },
        },
      }),
    ]);

    const now = new Date();

    const formattedUsers = users.map((u) => {
      const activeRoles = u.userRolesAssignedToMe.map((ur) => ({
        id: ur.id,
        roleId: ur.role.id,
        name: ur.role.name,
        slug: ur.role.slug,
        isPrimary: ur.isPrimary,
        isRoleInactive: ur.role.status !== 'active',
        assignedAt: ur.assignedAt,
      }));

      const primaryRole =
        activeRoles.find((r) => r.isPrimary) || activeRoles[0] || null;

      const assignedBranches = u.userBranchAssignmentsForMe.map((ub) => ({
        id: ub.id,
        branchId: ub.branch.id,
        name: ub.branch.name,
        code: ub.branch.code,
        isHomeBranch: ub.isHomeBranch,
        effectiveFrom: ub.effectiveFrom,
        effectiveTo: ub.effectiveTo,
      }));

      const homeBranch =
        assignedBranches.find((b) => b.isHomeBranch) ||
        assignedBranches[0] ||
        null;

      const isInviteExpired =
        u.status === 'pending_invite' &&
        u.inviteExpiresAt !== null &&
        u.inviteExpiresAt < now;

      return {
        id: u.id,
        displayName: u.displayName,
        email: u.email,
        phoneCountryCode: u.phoneCountryCode,
        phoneNumber: u.phoneNumber,
        status: u.status,
        profilePhotoUrl: u.profilePhotoUrl,
        isInviteExpired,
        inviteExpiresAt: u.inviteExpiresAt,
        inviteAcceptedAt: u.inviteAcceptedAt,
        lastLoginAt: u.lastLoginAt,
        lastLoginIp: u.lastLoginIp,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        createdBy: u.createdBy,
        primaryRole,
        activeRolesCount: activeRoles.length,
        activeRoles,
        homeBranch,
        assignedBranchesCount: assignedBranches.length,
        assignedBranches,
      };
    });

    return {
      data: formattedUsers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Find a single user by ID within organization
   */
  async findOne(userId: string, organizationId: string, actor?: AuthenticatedUser) {
    const user = await this.prisma.sms_users.findFirst({
      where: {
        id: userId,
        organizationId,
        deletedAt: null,
      },
      include: {
        organization: {
          select: { id: true, name: true, slug: true },
        },
        userRolesAssignedToMe: {
          where: { removedAt: null },
          include: { role: true },
        },
        userBranchAssignmentsForMe: {
          include: { branch: true },
        },
        createdBy: {
          select: { id: true, displayName: true, email: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User does not exist in this organization',
      });
    }

    if (actor?.id) {
      const actorContext = await this.getActorRolesAndBranches(actor.id);
      if (!actorContext.isSuperAdmin && !actorContext.isOwner && actorContext.isBranchManager) {
        const targetBranchIds = user.userBranchAssignmentsForMe.map((ub) => ub.branch.id);
        const sharesBranch = targetBranchIds.some((bId) => actorContext.assignedBranchIds.includes(bId));
        if (!sharesBranch) {
          throw new NotFoundException({
            code: 'USER_NOT_FOUND',
            message: 'User does not exist in your authorized branch scope',
          });
        }
      }
    }

    const now = new Date();
    const activeRoles = user.userRolesAssignedToMe.map((ur) => ({
      id: ur.id,
      roleId: ur.role.id,
      name: ur.role.name,
      slug: ur.role.slug,
      isPrimary: ur.isPrimary,
      isRoleInactive: ur.role.status !== 'active',
      assignedAt: ur.assignedAt,
    }));
    const primaryRole =
      activeRoles.find((r) => r.isPrimary) || activeRoles[0] || null;

    const assignedBranches = user.userBranchAssignmentsForMe.map((ub) => ({
      id: ub.id,
      branchId: ub.branch.id,
      name: ub.branch.name,
      code: ub.branch.code,
      isHomeBranch: ub.isHomeBranch,
      effectiveFrom: ub.effectiveFrom,
      effectiveTo: ub.effectiveTo,
    }));
    const homeBranch =
      assignedBranches.find((b) => b.isHomeBranch) ||
      assignedBranches[0] ||
      null;

    const isInviteExpired =
      user.status === 'pending_invite' &&
      user.inviteExpiresAt !== null &&
      user.inviteExpiresAt < now;

    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      phoneCountryCode: user.phoneCountryCode,
      phoneNumber: user.phoneNumber,
      status: user.status,
      profilePhotoUrl: user.profilePhotoUrl,
      isInviteExpired,
      inviteExpiresAt: user.inviteExpiresAt,
      inviteAcceptedAt: user.inviteAcceptedAt,
      lastLoginAt: user.lastLoginAt,
      lastLoginIp: user.lastLoginIp,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      createdBy: user.createdBy,
      organization: user.organization,
      primaryRole,
      activeRoles,
      homeBranch,
      assignedBranches,
    };
  }

  /**
   * Invite a new user with single-use invitation token (7-day expiry)
   */
  async inviteUser(
    organizationId: string,
    actor: AuthenticatedUser,
    dto: CreateUserInviteDto,
  ) {
    // 1. Validate contact info: at least one of email or phoneNumber must be provided
    const email = dto.email?.trim().toLowerCase() || null;
    const phoneNumber = dto.phoneNumber?.trim() || null;
    const phoneCountryCode = dto.phoneCountryCode?.trim() || '+91';

    if (!email && !phoneNumber) {
      throw new BadRequestException({
        code: 'IDENTIFIER_REQUIRED',
        message: 'At least one contact identifier (email or phone number) is required',
      });
    }

    // 2. Validate email uniqueness per organization
    if (email) {
      const existingEmail = await this.prisma.sms_users.findFirst({
        where: {
          organizationId,
          email: { equals: email, mode: 'insensitive' },
          deletedAt: null,
        },
      });

      if (existingEmail) {
        throw new ConflictException({
          code: 'DUPLICATE_EMAIL',
          message: `An account with email "${email}" already exists in this organization`,
          existingUserId: existingEmail.id,
        });
      }
    }

    // 3. Validate phone uniqueness per organization
    if (phoneNumber) {
      const existingPhone = await this.prisma.sms_users.findFirst({
        where: {
          organizationId,
          phoneNumber,
          deletedAt: null,
        },
      });

      if (existingPhone) {
        throw new ConflictException({
          code: 'DUPLICATE_PHONE',
          message: `An account with phone number "${phoneNumber}" already exists in this organization`,
          existingUserId: existingPhone.id,
        });
      }
    }

    // 4. Validate role existence and active status
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
        message: 'The selected role does not exist or is not available for this organization',
      });
    }

    if (role.status !== 'active') {
      throw new BadRequestException({
        code: 'ROLE_INACTIVE',
        message: `Role "${role.name}" is inactive and cannot be assigned to new accounts`,
      });
    }

    // 5. Branch Manager scoping restriction (cross-tenant & privilege escalation protection)
    const actorRoles = await this.prisma.sms_userRoles.findMany({
      where: { userId: actor.id, removedAt: null },
      include: { role: true },
    });
    const actorSlugs = actorRoles.map((ur) => ur.role?.slug?.toLowerCase()).filter(Boolean);
    const actorNames = actorRoles.map((ur) => ur.role?.name?.toUpperCase().replace(/\s+/g, '_')).filter(Boolean);
    const allActorRoles = [...actorSlugs, ...actorNames];

    const isActorSuperAdmin = allActorRoles.some(
      (r) => r === 'super-admin' || r === 'SUPER_ADMIN' || r === 'SUPER ADMIN',
    );
    const isActorOwner = allActorRoles.some((r) => r === 'owner' || r === 'OWNER');
    const isActorBranchManager = allActorRoles.some(
      (r) => r === 'branch-manager' || r === 'BRANCH_MANAGER' || r === 'BRANCH MANAGER',
    );

    const targetRoleSlug = role.slug?.toLowerCase();
    const isTargetSuperAdmin =
      targetRoleSlug === 'super-admin' ||
      role.name?.toUpperCase() === 'SUPER ADMIN' ||
      role.name?.toUpperCase() === 'SUPER_ADMIN';

    // Prevent non-Super-Admins from inviting someone with Super Admin role
    if (isTargetSuperAdmin && !isActorSuperAdmin) {
      throw new ForbiddenException({
        code: 'PRIVILEGE_ESCALATION_BLOCKED',
        message: 'Only Super Admin can invite accounts with the Super Admin role',
      });
    }

    if (!isActorSuperAdmin && !isActorOwner) {
      if (isActorBranchManager) {
        // Branch Manager can ONLY invite Front Desk or Service Staff
        const allowedSlugs = ['front-desk', 'service-staff'];
        if (!targetRoleSlug || !allowedSlugs.includes(targetRoleSlug)) {
          throw new ForbiddenException({
            code: 'FORBIDDEN_ROLE_CREATION',
            message: 'Branch Managers may only invite Front Desk or Service Staff accounts',
          });
        }

        // Branch Manager MUST provide a branchId
        if (!dto.branchId) {
          throw new BadRequestException({
            code: 'BRANCH_REQUIRED',
            message: 'Branch Managers must assign invited users to an authorized branch',
          });
        }

        // Branch Manager must be assigned to this branch
        const bmAssignment = await this.prisma.sms_userBranchAssignments.findFirst({
          where: {
            userId: actor.id,
            branchId: dto.branchId,
          },
        });

        if (!bmAssignment) {
          throw new ForbiddenException({
            code: 'UNAUTHORIZED_BRANCH_ASSIGNMENT',
            message: 'You are not assigned to manage this branch',
          });
        }
      } else {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'You do not have permission to invite users',
        });
      }
    }

    // 6. Validate branch if provided
    let branch: any = null;
    if (dto.branchId) {
      branch = await this.prisma.sms_branches.findFirst({
        where: {
          id: dto.branchId,
          organizationId,
          deletedAt: null,
        },
      });

      if (!branch) {
        throw new NotFoundException({
          code: 'BRANCH_NOT_FOUND',
          message: 'The selected branch does not exist in this organization',
        });
      }

      if (branch.status === 'permanently_closed') {
        throw new BadRequestException({
          code: 'BRANCH_CLOSED',
          message: 'Cannot assign a user to a permanently closed branch',
        });
      }
    }

    // 7. Generate single-use invitation token (64 hex characters) and 7-day expiry
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // 8. Execute atomic account provisioning transaction
    const createdUser = await this.prisma.$transaction(async (tx) => {
      // Create user record
      const newUser = await tx.sms_users.create({
        data: {
          organizationId,
          displayName: dto.displayName.trim(),
          email,
          phoneCountryCode: email && !phoneNumber ? null : phoneCountryCode,
          phoneNumber,
          status: 'pending_invite',
          inviteToken,
          inviteExpiresAt,
          createdById: actor.id,
        },
      });

      // Assign primary role
      await tx.sms_userRoles.create({
        data: {
          userId: newUser.id,
          roleId: role.id,
          isPrimary: true,
          assignedById: actor.id,
          assignedAt: new Date(),
        },
      });

      // Assign home branch if provided
      if (branch) {
        await tx.sms_userBranchAssignments.create({
          data: {
            userId: newUser.id,
            branchId: branch.id,
            isHomeBranch: true,
            effectiveFrom: new Date(),
            assignedById: actor.id,
          },
        });
      }

      // Log status creation in sms_userStatusLogs
      await tx.sms_userStatusLogs.create({
        data: {
          userId: newUser.id,
          fromStatus: null,
          toStatus: 'pending_invite',
          reason: 'User account created via admin invitation',
          changedById: actor.id,
          changedAt: new Date(),
        },
      });

      return newUser;
    });

    return {
      id: createdUser.id,
      displayName: createdUser.displayName,
      email: createdUser.email,
      phoneCountryCode: createdUser.phoneCountryCode,
      phoneNumber: createdUser.phoneNumber,
      status: createdUser.status,
      inviteExpiresAt: createdUser.inviteExpiresAt,
      role: {
        id: role.id,
        name: role.name,
        slug: role.slug,
      },
      branch: branch
        ? {
            id: branch.id,
            name: branch.name,
            code: branch.code,
          }
        : null,
      inviteToken,
      inviteUrl: `/accept-invite?token=${inviteToken}`,
    };
  }

  /**
   * Resend invitation with a refreshed single-use token and renewed 7-day expiry
   */
  async resendInvite(
    userId: string,
    organizationId: string,
    actor: AuthenticatedUser,
  ) {
    const user = await this.prisma.sms_users.findFirst({
      where: {
        id: userId,
        organizationId,
        deletedAt: null,
      },
      include: {
        userBranchAssignmentsForMe: true,
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User does not exist in this organization',
      });
    }

    if (actor?.id) {
      const actorContext = await this.getActorRolesAndBranches(actor.id);
      if (!actorContext.isSuperAdmin && !actorContext.isOwner && actorContext.isBranchManager) {
        const targetBranchIds = user.userBranchAssignmentsForMe.map((ub) => ub.branchId);
        const sharesBranch = targetBranchIds.some((bId) => actorContext.assignedBranchIds.includes(bId));
        if (!sharesBranch) {
          throw new ForbiddenException({
            code: 'UNAUTHORIZED_BRANCH_SCOPE',
            message: 'You can only resend invitations for users assigned to your branches',
          });
        }
      }
    }

    if (user.status === 'active') {
      throw new BadRequestException({
        code: 'USER_ALREADY_ACTIVE',
        message: 'This user has already accepted their invitation and activated their account',
      });
    }

    if (user.status === 'suspended' || user.status === 'deactivated') {
      throw new BadRequestException({
        code: 'ACCOUNT_STATUS_INVALID',
        message: `Cannot resend an invitation to a ${user.status} account. Please reactivate first.`,
      });
    }

    // Generate new token & 7-day expiry
    const newInviteToken = crypto.randomBytes(32).toString('hex');
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.sms_users.update({
      where: { id: user.id },
      data: {
        inviteToken: newInviteToken,
        inviteExpiresAt: newExpiresAt,
      },
    });

    return {
      success: true,
      userId: user.id,
      displayName: user.displayName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      inviteExpiresAt: newExpiresAt,
      inviteToken: newInviteToken,
      inviteUrl: `/accept-invite?token=${newInviteToken}`,
    };
  }

  /**
   * Public verification of invitation token prior to password setup
   */
  async verifyInviteToken(token: string) {
    if (!token || !token.trim()) {
      throw new BadRequestException({
        code: 'TOKEN_REQUIRED',
        message: 'Invitation token is required',
      });
    }

    const user = await this.prisma.sms_users.findFirst({
      where: {
        inviteToken: token.trim(),
        deletedAt: null,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
          },
        },
      },
    });

    if (!user || user.inviteAcceptedAt) {
      throw new NotFoundException({
        code: 'INVALID_INVITE_TOKEN',
        message: 'This invitation link is invalid or has already been used',
      });
    }

    const now = new Date();
    if (user.inviteExpiresAt && user.inviteExpiresAt < now) {
      return {
        valid: false,
        expired: true,
        message:
          'This invitation link has expired (7-day validity). Please contact your salon owner to resend your invite.',
      };
    }

    return {
      valid: true,
      expired: false,
      user: {
        displayName: user.displayName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        organization: user.organization,
      },
    };
  }

  /**
   * Public acceptance of invitation: sets password and transitions account to active atomically
   */
  async acceptInvite(dto: AcceptInviteDto) {
    const token = dto.token.trim();

    const user = await this.prisma.sms_users.findFirst({
      where: {
        inviteToken: token,
        deletedAt: null,
      },
    });

    if (!user || user.inviteAcceptedAt) {
      throw new BadRequestException({
        code: 'INVALID_INVITE_TOKEN',
        message: 'This invitation link is invalid or has already been consumed',
      });
    }

    const now = new Date();
    if (user.inviteExpiresAt && user.inviteExpiresAt < now) {
      throw new BadRequestException({
        code: 'INVITE_EXPIRED',
        message: 'This invitation link has expired. Please ask your administrator to resend it.',
      });
    }

    // Hash password with 12 salt rounds
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Atomic transaction: update password, mark active, clear single-use token, create status log
    await this.prisma.$transaction(async (tx) => {
      await tx.sms_users.update({
        where: { id: user.id },
        data: {
          passwordHash,
          status: 'active',
          inviteAcceptedAt: now,
          inviteToken: null, // Clear single-use token
        },
      });

      await tx.sms_userStatusLogs.create({
        data: {
          userId: user.id,
          fromStatus: 'pending_invite',
          toStatus: 'active',
          reason: 'User accepted invitation and configured password credentials',
          changedById: user.id,
          changedAt: now,
        },
      });
    });

    return {
      success: true,
      message: 'Password created successfully. Your account is now active.',
      userId: user.id,
    };
  }

  /**
   * Update user profile information
   */
  async updateUser(
    userId: string,
    organizationId: string,
    actor: AuthenticatedUser,
    dto: UpdateUserDto,
  ) {
    const user = await this.prisma.sms_users.findFirst({
      where: {
        id: userId,
        organizationId,
        deletedAt: null,
      },
      include: {
        userRolesAssignedToMe: {
          where: { removedAt: null },
          include: { role: true },
        },
        userBranchAssignmentsForMe: true,
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User does not exist in this organization',
      });
    }

    if (actor?.id) {
      const actorContext = await this.getActorRolesAndBranches(actor.id);
      if (!actorContext.isSuperAdmin && !actorContext.isOwner && actorContext.isBranchManager) {
        const isTargetPrivileged = user.userRolesAssignedToMe.some((ur) => {
          const s = ur.role?.slug?.toLowerCase();
          const n = ur.role?.name?.toUpperCase();
          return s === 'super-admin' || s === 'owner' || n === 'OWNER' || n === 'SUPER_ADMIN';
        });

        if (isTargetPrivileged) {
          throw new ForbiddenException({
            code: 'PRIVILEGE_ESCALATION_BLOCKED',
            message: 'Branch Managers cannot edit Owner or Super Admin accounts',
          });
        }

        const targetBranchIds = user.userBranchAssignmentsForMe.map((ub) => ub.branchId);
        const sharesBranch = targetBranchIds.some((bId) => actorContext.assignedBranchIds.includes(bId));
        if (!sharesBranch) {
          throw new ForbiddenException({
            code: 'UNAUTHORIZED_BRANCH_SCOPE',
            message: 'You can only update users assigned to your branches',
          });
        }
      }
    }

    // Check duplicate email
    if (dto.email && dto.email.trim().toLowerCase() !== user.email?.toLowerCase()) {
      const email = dto.email.trim().toLowerCase();
      const existingEmail = await this.prisma.sms_users.findFirst({
        where: {
          organizationId,
          email: { equals: email, mode: 'insensitive' },
          deletedAt: null,
          id: { not: userId },
        },
      });

      if (existingEmail) {
        throw new ConflictException({
          code: 'DUPLICATE_EMAIL',
          message: `An account with email "${email}" already exists in this organization`,
        });
      }
    }

    // Check duplicate phone
    if (dto.phoneNumber && dto.phoneNumber.trim() !== user.phoneNumber) {
      const phoneNumber = dto.phoneNumber.trim();
      const existingPhone = await this.prisma.sms_users.findFirst({
        where: {
          organizationId,
          phoneNumber,
          deletedAt: null,
          id: { not: userId },
        },
      });

      if (existingPhone) {
        throw new ConflictException({
          code: 'DUPLICATE_PHONE',
          message: `An account with phone number "${phoneNumber}" already exists in this organization`,
        });
      }
    }

    const updated = await this.prisma.sms_users.update({
      where: { id: userId },
      data: {
        displayName: dto.displayName ? dto.displayName.trim() : undefined,
        email: dto.email ? dto.email.trim().toLowerCase() : undefined,
        phoneCountryCode: dto.phoneCountryCode !== undefined ? dto.phoneCountryCode : undefined,
        phoneNumber: dto.phoneNumber !== undefined ? dto.phoneNumber?.trim() || null : undefined,
        profilePhotoUrl: dto.profilePhotoUrl !== undefined ? dto.profilePhotoUrl : undefined,
      },
    });

    return {
      id: updated.id,
      displayName: updated.displayName,
      email: updated.email,
      phoneCountryCode: updated.phoneCountryCode,
      phoneNumber: updated.phoneNumber,
      profilePhotoUrl: updated.profilePhotoUrl,
      status: updated.status,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Change user account status (active, suspended, deactivated) with strict last-owner and self-protection safeguards
   */
  async changeUserStatus(
    userId: string,
    organizationId: string,
    actor: AuthenticatedUser,
    dto: ChangeUserStatusDto,
  ) {
    // 1. Verify user exists in organization
    const user = await this.prisma.sms_users.findFirst({
      where: {
        id: userId,
        organizationId,
        deletedAt: null,
      },
      include: {
        userRolesAssignedToMe: {
          where: { removedAt: null },
          include: { role: true },
        },
        userBranchAssignmentsForMe: true,
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User does not exist in this organization',
      });
    }

    // 2. Prevent self-deactivation or self-suspension
    if (userId === actor.id && dto.status !== 'active') {
      throw new BadRequestException({
        code: 'CANNOT_DEACTIVATE_SELF',
        message: 'You cannot deactivate or suspend your own account',
      });
    }

    // 3. Resolve actor roles and branch scope
    const actorContext = await this.getActorRolesAndBranches(actor.id);
    if (!actorContext.isSuperAdmin && !actorContext.isOwner) {
      if (actorContext.isBranchManager) {
        // Branch Manager cannot change status of Owner or Super Admin
        const isTargetPrivileged = user.userRolesAssignedToMe.some((ur) => {
          const s = ur.role?.slug?.toLowerCase();
          const n = ur.role?.name?.toUpperCase();
          return s === 'super-admin' || s === 'owner' || n === 'OWNER' || n === 'SUPER_ADMIN';
        });

        if (isTargetPrivileged) {
          throw new ForbiddenException({
            code: 'PRIVILEGE_ESCALATION_BLOCKED',
            message: 'Branch Managers cannot modify Owner or Super Admin accounts',
          });
        }

        // Branch Manager can only manage users in their assigned branch scope
        const targetBranchIds = user.userBranchAssignmentsForMe.map((ub) => ub.branchId);
        const sharesBranch = targetBranchIds.some((bid) => actorContext.assignedBranchIds.includes(bid));
        if (!sharesBranch) {
          throw new ForbiddenException({
            code: 'UNAUTHORIZED_BRANCH_SCOPE',
            message: 'You can only change status for users assigned to your branches',
          });
        }
      } else {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'You do not have permission to change user account status',
        });
      }
    }

    // 4. If target is Owner and transitioning to non-active status, check last active Owner protection
    const isTargetOwner = user.userRolesAssignedToMe.some((ur) => {
      const s = ur.role?.slug?.toLowerCase();
      const n = ur.role?.name?.toUpperCase();
      return s === 'owner' || n === 'OWNER';
    });

    if (isTargetOwner && dto.status !== 'active') {
      const otherActiveOwners = await this.prisma.sms_userRoles.count({
        where: {
          role: {
            OR: [{ slug: 'owner' }, { name: 'Owner' }],
          },
          removedAt: null,
          user: {
            organizationId,
            deletedAt: null,
            status: 'active',
            id: { not: userId },
          },
        },
      });

      if (otherActiveOwners === 0) {
        throw new BadRequestException({
          code: 'LAST_OWNER_PROTECTION',
          message:
            'Cannot deactivate the last active Owner of this organization. Please assign another active Owner first.',
        });
      }
    }

    // 5. If already in target status, return early
    if (user.status === dto.status) {
      return {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        status: user.status,
        message: `User is already ${dto.status}`,
      };
    }

    // 6. Execute atomic status update and audit log in transaction
    return await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.sms_users.update({
        where: { id: userId },
        data: {
          status: dto.status,
        },
      });

      await tx.sms_userStatusLogs.create({
        data: {
          userId: user.id,
          fromStatus: user.status,
          toStatus: dto.status,
          reason: dto.reason?.trim() || `Status updated to ${dto.status} by administrator`,
          changedById: actor.id,
          changedAt: new Date(),
        },
      });

      return {
        id: updatedUser.id,
        displayName: updatedUser.displayName,
        email: updatedUser.email,
        previousStatus: user.status,
        status: updatedUser.status,
        updatedAt: updatedUser.updatedAt,
        message: `Account status successfully updated to ${dto.status}`,
      };
    });
  }

  /**
   * Soft delete user account with strict dependency checks preventing deletion if historical records exist
   */
  async deleteUser(
    userId: string,
    organizationId: string,
    actor: AuthenticatedUser,
  ) {
    // 1. Verify user exists in organization
    const user = await this.prisma.sms_users.findFirst({
      where: {
        id: userId,
        organizationId,
        deletedAt: null,
      },
      include: {
        userRolesAssignedToMe: {
          where: { removedAt: null },
          include: { role: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User does not exist in this organization',
      });
    }

    // 2. Prevent self-deletion
    if (userId === actor.id) {
      throw new BadRequestException({
        code: 'CANNOT_DELETE_SELF',
        message: 'You cannot delete your own account',
      });
    }

    // 3. Prevent deleting the final organization owner
    const isTargetOwner = user.userRolesAssignedToMe.some((ur) => {
      const s = ur.role?.slug?.toLowerCase();
      const n = ur.role?.name?.toUpperCase();
      return s === 'owner' || n === 'OWNER';
    });

    if (isTargetOwner) {
      const otherActiveOwners = await this.prisma.sms_userRoles.count({
        where: {
          role: {
            OR: [
              { slug: 'owner' },
              { name: 'Owner' },
            ],
          },
          removedAt: null,
          user: {
            organizationId,
            deletedAt: null,
            status: 'active',
            id: { not: userId },
          },
        },
      });

      if (otherActiveOwners === 0) {
        throw new BadRequestException({
          code: 'LAST_OWNER_PROTECTION',
          message:
            'Cannot delete the last active Owner of this organization. Please assign another Owner before deleting.',
        });
      }
    }

    // 4. Check for historical transaction references across all dependent tables
    const [
      auditCount,
      branchesCount,
      rolesCount,
      statusLogsCount,
      staffCount,
      servicesCount,
      customersCount,
    ] = await Promise.all([
      this.prisma.sms_auditLogs.count({ where: { performedById: userId } }),
      this.prisma.sms_branches.count({ where: { createdById: userId } }),
      this.prisma.sms_roles.count({ where: { createdById: userId } }),
      this.prisma.sms_userStatusLogs.count({ where: { changedById: userId } }),
      this.prisma.sms_staff.count({
        where: {
          OR: [{ createdById: userId }, { userId }],
        },
      }),
      this.prisma.sms_services.count({ where: { createdById: userId } }),
      this.prisma.sms_customers.count({ where: { createdById: userId } }),
    ]);

    const totalDependencies =
      auditCount +
      branchesCount +
      rolesCount +
      statusLogsCount +
      staffCount +
      servicesCount +
      customersCount;

    if (totalDependencies > 0) {
      throw new ConflictException({
        code: 'HISTORICAL_RECORDS_EXIST',
        message:
          'Cannot delete user account because historical business records and audit trails depend on it. Please deactivate the account instead.',
        dependencies: {
          auditLogs: auditCount,
          branchesCreated: branchesCount,
          rolesCreated: rolesCount,
          statusLogsRecorded: statusLogsCount,
          staffRecords: staffCount,
          servicesCreated: servicesCount,
          customersCreated: customersCount,
        },
      });
    }

    // 5. Atomic soft deletion
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.sms_users.update({
        where: { id: userId },
        data: {
          deletedAt: now,
          status: 'deactivated',
        },
      });

      // Remove active role mappings
      await tx.sms_userRoles.updateMany({
        where: { userId, removedAt: null },
        data: { removedAt: now },
      });

      // Record in status log
      await tx.sms_userStatusLogs.create({
        data: {
          userId,
          fromStatus: user.status,
          toStatus: 'deactivated',
          reason: 'User account soft-deleted by administrator',
          changedById: actor.id,
          changedAt: now,
        },
      });
    });

    return {
      success: true,
      message: 'User account successfully deleted',
      userId,
    };
  }
}

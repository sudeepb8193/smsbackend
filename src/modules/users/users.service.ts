import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { AssignRoleDto } from './dto/role-assignment.dto';
import { Role, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuditService } from '../../common/services/audit.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  /**
   * Calculate exact invite status from database attributes
   */
  private computeStatus(user: {
    deletedAt?: Date | null;
    inviteAcceptedAt?: Date | null;
    inviteExpiresAt?: Date | null;
  }): 'active' | 'pending' | 'expired' | 'deactivated' {
    if (user.deletedAt) return 'deactivated';
    if (user.inviteAcceptedAt) return 'active';
    if (user.inviteExpiresAt && user.inviteExpiresAt < new Date()) return 'expired';
    return 'pending';
  }

  /**
   * Helper to format User object safely without sensitive passwordHash or raw tokens
   */
  private formatUser(user: any) {
    const { passwordHash, inviteToken, ...rest } = user;
    const computedStatus = this.computeStatus(user);
    return {
      ...rest,
      status: computedStatus,
      branches: user.userBranches
        ? user.userBranches.map((ub: any) => ub.branch || ub.branchId)
        : [],
    };
  }

  /**
   * Create a new pending user with invitation
   */
  async createUser(
    dto: CreateUserDto,
    creatorContext: { id: number; organizationId: number; role: Role },
  ) {
    const { displayName, email, phoneCountryCode, phoneNumber, role, branchIds } = dto;

    // Validate identifier requirement: At least ONE of email or phoneNumber must exist
    if (!email && !phoneNumber) {
      throw new BadRequestException('Provide an email address or phone number.');
    }

    const orgId = creatorContext.organizationId;

    // Branch Manager restriction on roles
    if (creatorContext.role === Role.BRANCH_MANAGER) {
      const allowedRoles: Role[] = [Role.FRONT_DESK, Role.SERVICE_STAFF];
      if (!allowedRoles.includes(role)) {
        throw new ForbiddenException(
          'Branch Managers are only permitted to create Front Desk or Service Staff accounts.',
        );
      }
    }

    // Email uniqueness within organization
    if (email) {
      const normalizedEmail = email.trim().toLowerCase();
      const existingEmail = await this.prisma.user.findFirst({
        where: {
          organizationId: orgId,
          email: { equals: normalizedEmail, mode: 'insensitive' },
        },
      });
      if (existingEmail) {
        throw new ConflictException(
          'A user with this email already exists in your organization.',
        );
      }
    }

    // Phone uniqueness within organization
    if (phoneNumber) {
      const normalizedPhone = phoneNumber.trim();
      const existingPhone = await this.prisma.user.findFirst({
        where: {
          organizationId: orgId,
          phoneNumber: normalizedPhone,
        },
      });
      if (existingPhone) {
        throw new ConflictException(
          'A user with this phone number already exists in your organization.',
        );
      }
    }

    // Generate secure 7-day invitation token
    const rawInviteToken = crypto.randomBytes(32).toString('hex');
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const user = await this.prisma.user.create({
      data: {
        organizationId: orgId,
        displayName: displayName.trim(),
        email: email ? email.trim().toLowerCase() : null,
        phoneCountryCode: phoneCountryCode || null,
        phoneNumber: phoneNumber ? phoneNumber.trim() : null,
        role: role,
        inviteToken: rawInviteToken,
        inviteExpiresAt: inviteExpiresAt,
        createdBy: creatorContext.id,
        userBranches:
          branchIds && branchIds.length > 0
            ? {
                create: branchIds.map((bId) => ({ branchId: bId })),
              }
            : undefined,
      },
      include: {
        userBranches: {
          include: { branch: true },
        },
      },
    });

    this.auditService.logEvent({
      organizationId: orgId,
      actorId: creatorContext.id,
      action: 'USER_CREATED_INVITED',
      targetId: user.id,
      details: { displayName: user.displayName, email: user.email, role: user.role },
    });

    const formatted = this.formatUser(user);
    // Include invitation link payload in administrative creation response for sending
    return {
      ...formatted,
      invitationUrl: `/accept-invite?token=${rawInviteToken}`,
    };
  }

  /**
   * Find and list users with search, role, status, branch, and pagination
   */
  async listUsers(organizationId: number, query: UserQueryDto) {
    const { search, role, status, branchId, page = 1, limit = 10 } = query;

    const where: Prisma.UserWhereInput = {
      organizationId,
    };

    // Filter by search query across name, email, phone
    if (search && search.trim() !== '') {
      const q = search.trim();
      where.OR = [
        { displayName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phoneNumber: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Filter by Role
    if (role) {
      where.role = role;
    }

    // Filter by Branch
    if (branchId) {
      where.userBranches = {
        some: { branchId: Number(branchId) },
      };
    }

    // Filter by Status (computed state filtering)
    const now = new Date();
    if (status === 'deactivated') {
      where.deletedAt = { not: null };
    } else if (status === 'active') {
      where.deletedAt = null;
      where.inviteAcceptedAt = { not: null };
    } else if (status === 'pending') {
      where.deletedAt = null;
      where.inviteAcceptedAt = null;
      where.inviteExpiresAt = { gte: now };
    } else if (status === 'expired') {
      where.deletedAt = null;
      where.inviteAcceptedAt = null;
      where.inviteExpiresAt = { lt: now };
    }

    const total = await this.prisma.user.count({ where });

    const users = await this.prisma.user.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        userBranches: {
          include: { branch: true },
        },
      },
    });

    const data = users.map((u) => this.formatUser(u));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get single user by ID
   */
  async getUserById(id: number, organizationId: number) {
    const user = await this.prisma.user.findFirst({
      where: { id, organizationId },
      include: {
        userBranches: {
          include: { branch: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return this.formatUser(user);
  }

  /**
   * Update existing user fields & branch assignments
   */
  async updateUser(
    id: number,
    dto: UpdateUserDto,
    updaterContext: { id: number; organizationId: number; role: Role },
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id, organizationId: updaterContext.organizationId },
    });

    if (!user) {
      throw new NotFoundException('User not found in your organization.');
    }

    // Check email uniqueness if modified
    if (dto.email && dto.email.trim().toLowerCase() !== user.email) {
      const normalizedEmail = dto.email.trim().toLowerCase();
      const existing = await this.prisma.user.findFirst({
        where: {
          organizationId: updaterContext.organizationId,
          email: { equals: normalizedEmail, mode: 'insensitive' },
          id: { not: id },
        },
      });
      if (existing) {
        throw new ConflictException(
          'A user with this email already exists in your organization.',
        );
      }
    }

    // Check phone uniqueness if modified
    if (dto.phoneNumber && dto.phoneNumber.trim() !== user.phoneNumber) {
      const normalizedPhone = dto.phoneNumber.trim();
      const existing = await this.prisma.user.findFirst({
        where: {
          organizationId: updaterContext.organizationId,
          phoneNumber: normalizedPhone,
          id: { not: id },
        },
      });
      if (existing) {
        throw new ConflictException(
          'A user with this phone number already exists in your organization.',
        );
      }
    }

    // Branch manager role edit check
    if (updaterContext.role === Role.BRANCH_MANAGER && dto.role) {
      const allowedRoles: Role[] = [Role.FRONT_DESK, Role.SERVICE_STAFF];
      if (!allowedRoles.includes(dto.role)) {
        throw new ForbiddenException(
          'Branch Managers cannot assign administrative roles.',
        );
      }
    }

    // Update branches if branchIds supplied
    if (dto.branchIds !== undefined) {
      await this.prisma.userBranch.deleteMany({
        where: { userId: id },
      });
      if (dto.branchIds.length > 0) {
        await this.prisma.userBranch.createMany({
          data: dto.branchIds.map((bId) => ({ userId: id, branchId: bId })),
        });
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        displayName: dto.displayName ? dto.displayName.trim() : undefined,
        email: dto.email ? dto.email.trim().toLowerCase() : undefined,
        phoneCountryCode: dto.phoneCountryCode !== undefined ? dto.phoneCountryCode : undefined,
        phoneNumber: dto.phoneNumber ? dto.phoneNumber.trim() : undefined,
        role: dto.role || undefined,
      },
      include: {
        userBranches: {
          include: { branch: true },
        },
      },
    });

    this.auditService.logEvent({
      organizationId: updaterContext.organizationId,
      actorId: updaterContext.id,
      action: 'USER_UPDATED',
      targetId: id,
      details: { dto },
    });

    return this.formatUser(updated);
  }

  /**
   * Resend invitation to pending or expired user
   */
  async resendInvitation(
    id: number,
    adminContext: { id: number; organizationId: number },
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id, organizationId: adminContext.organizationId },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (user.deletedAt) {
      throw new BadRequestException('Cannot resend invitation for a deactivated user.');
    }

    if (user.inviteAcceptedAt) {
      throw new BadRequestException('User has already accepted the invitation.');
    }

    const newInviteToken = crypto.randomBytes(32).toString('hex');
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        inviteToken: newInviteToken,
        inviteExpiresAt: newExpiresAt,
      },
    });

    this.auditService.logEvent({
      organizationId: adminContext.organizationId,
      actorId: adminContext.id,
      action: 'USER_INVITATION_RESENT',
      targetId: id,
    });

    return {
      message: 'Invitation resent successfully.',
      invitationUrl: `/accept-invite?token=${newInviteToken}`,
      inviteExpiresAt: newExpiresAt,
    };
  }

  /**
   * Accept invitation and set password
   */
  async acceptInvitation(dto: AcceptInviteDto) {
    const { token, password } = dto;

    const user = await this.prisma.user.findFirst({
      where: { inviteToken: token },
    });

    if (!user || user.deletedAt) {
      throw new BadRequestException('This invitation is invalid or no longer available.');
    }

    if (user.inviteAcceptedAt) {
      throw new BadRequestException('This invitation is no longer valid.');
    }

    if (user.inviteExpiresAt && user.inviteExpiresAt < new Date()) {
      throw new BadRequestException(
        'This invitation has expired. Ask an administrator to resend the invitation.',
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPassword,
        inviteAcceptedAt: new Date(),
        inviteToken: null,
      },
    });

    this.auditService.logEvent({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'INVITATION_ACCEPTED',
      targetId: user.id,
    });

    return {
      message: 'Invitation accepted successfully. You can now log in.',
      userId: updated.id,
      displayName: updated.displayName,
    };
  }

  /**
   * Deactivate user (soft delete)
   */
  async deactivateUser(
    id: number,
    adminContext: { id: number; organizationId: number },
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id, organizationId: adminContext.organizationId },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (user.id === adminContext.id) {
      throw new BadRequestException('You cannot deactivate your own user account.');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.auditService.logEvent({
      organizationId: adminContext.organizationId,
      actorId: adminContext.id,
      action: 'USER_DEACTIVATED',
      targetId: id,
    });

    return this.formatUser(updated);
  }

  /**
   * Reactivate deactivated user
   */
  async reactivateUser(
    id: number,
    adminContext: { id: number; organizationId: number },
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id, organizationId: adminContext.organizationId },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { deletedAt: null },
    });

    this.auditService.logEvent({
      organizationId: adminContext.organizationId,
      actorId: adminContext.id,
      action: 'USER_REACTIVATED',
      targetId: id,
    });

    return this.formatUser(updated);
  }

  /**
   * Self-service password change
   */
  async changePassword(
    userId: number,
    organizationId: number,
    dto: ChangePasswordDto,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
    });

    if (!user || user.deletedAt) {
      throw new NotFoundException('User account not found.');
    }

    if (user.passwordHash) {
      const match = await bcrypt.compare(dto.currentPassword, user.passwordHash);
      if (!match) {
        throw new BadRequestException('Current password does not match.');
      }
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    this.auditService.logEvent({
      organizationId,
      actorId: userId,
      action: 'PASSWORD_CHANGED',
      targetId: userId,
    });

    return { message: 'Password updated successfully.' };
  }

  /**
   * Get 2FA settings extension point
   */
  async get2FASettings(userId: number, organizationId: number) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
    });

    if (!user) throw new NotFoundException('User not found.');

    return {
      userId: user.id,
      is2FAEnabled: false, // Clean extension point for Module 2FA
      method: 'TOTP',
      pendingSetup: false,
    };
  }

  /**
   * Toggle 2FA setting extension point
   */
  async toggle2FA(userId: number, organizationId: number, enable: boolean) {
    this.auditService.logEvent({
      organizationId,
      actorId: userId,
      action: enable ? '2FA_ENABLED' : '2FA_DISABLED',
      targetId: userId,
    });

    return {
      message: `2FA authentication ${enable ? 'enabled' : 'disabled'} successfully.`,
      is2FAEnabled: enable,
    };
  }

  /**
   * Ensure standard system roles exist in sms_roles for organization
   */
  async ensureDefaultSystemRoles(organizationId: number) {
    const defaultRoles = [
      { code: 'SUPER_ADMIN', name: 'Super Admin', description: 'Full system control and configuration' },
      { code: 'BRANCH_MANAGER', name: 'Branch Manager', description: 'Manages branch operations, staff, and schedules' },
      { code: 'ACCOUNTANT', name: 'Accountant', description: 'Financial reports and billing management' },
      { code: 'FRONT_DESK', name: 'Front Desk', description: 'Appointments, customer check-in, and point of sale' },
      { code: 'SERVICE_STAFF', name: 'Service Staff', description: 'Provides salon services and views appointments' },
      { code: 'INVENTORY_MANAGER', name: 'Inventory Manager', description: 'Stock, suppliers, and purchase orders' },
      { code: 'MARKETING_MANAGER', name: 'Marketing Manager', description: 'Promotions, campaigns, and customer analytics' },
      { code: 'CUSTOMER', name: 'Customer', description: 'Self-service client portal access' },
    ];

    for (const roleDef of defaultRoles) {
      const existing = await this.prisma.smsRole.findFirst({
        where: { organizationId, code: roleDef.code },
      });
      if (!existing) {
        await this.prisma.smsRole.create({
          data: {
            organizationId,
            name: roleDef.name,
            code: roleDef.code,
            description: roleDef.description,
            status: 'active',
            isSystem: true,
          },
        });
      }
    }
  }

  /**
   * Ensure user has at least one sms_user_roles entry matching legacy user.role
   */
  private async ensureUserHasRoleAssignment(user: any) {
    await this.ensureDefaultSystemRoles(user.organizationId);

    const activeRoles = await this.prisma.smsUserRole.findMany({
      where: { userId: user.id, removedAt: null },
    });

    if (activeRoles.length === 0) {
      const targetRoleCode = user.role ? String(user.role) : 'FRONT_DESK';
      let sysRole = await this.prisma.smsRole.findFirst({
        where: { organizationId: user.organizationId, code: targetRoleCode },
      });

      if (!sysRole) {
        sysRole = await this.prisma.smsRole.create({
          data: {
            organizationId: user.organizationId,
            name: targetRoleCode.replace('_', ' '),
            code: targetRoleCode,
            status: 'active',
            isSystem: true,
          },
        });
      }

      await this.prisma.smsUserRole.create({
        data: {
          userId: user.id,
          roleId: sysRole.id,
          isPrimary: true,
          assignedAt: user.createdAt || new Date(),
        },
      });
    }
  }

  /**
   * Get fallback permission codes for standard system roles
   */
  private getDefaultPermissionsForRole(roleCode: string): string[] {
    const map: Record<string, string[]> = {
      SUPER_ADMIN: [
        'users.view', 'users.manage',
        'roles.view', 'roles.manage',
        'staff.schedule.view', 'staff.schedule.manage',
        'reports.branch.view',
        'appointment.view', 'appointment.manage',
        'service.session.manage',
        'inventory.view', 'inventory.manage',
        'billing.view', 'billing.manage',
      ],
      BRANCH_MANAGER: [
        'users.view', 'users.manage',
        'staff.schedule.view', 'staff.schedule.manage',
        'reports.branch.view',
        'appointment.view', 'appointment.manage',
        'service.session.manage',
        'inventory.view', 'billing.view',
      ],
      ACCOUNTANT: ['reports.branch.view', 'billing.view', 'billing.manage'],
      FRONT_DESK: ['appointment.view', 'appointment.manage', 'service.session.manage', 'billing.view'],
      SERVICE_STAFF: ['appointment.view', 'service.session.manage'],
      INVENTORY_MANAGER: ['inventory.view', 'inventory.manage'],
      MARKETING_MANAGER: ['reports.branch.view'],
      CUSTOMER: ['appointment.view'],
    };
    return map[roleCode] || ['appointment.view'];
  }

  /**
   * List available roles for organization
   */
  async listAvailableRoles(organizationId: number) {
    await this.ensureDefaultSystemRoles(organizationId);
    return this.prisma.smsRole.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { id: 'asc' },
    });
  }

  /**
   * Get user assigned roles (active & historical) with effective permissions
   */
  async getUserRoles(userId: number, organizationId: number) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
    });

    if (!user) {
      throw new NotFoundException('User not found in your organization.');
    }

    await this.ensureUserHasRoleAssignment(user);

    const userRoles = await this.prisma.smsUserRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
        assigner: {
          select: { id: true, displayName: true, email: true },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    const activeRoles = userRoles
      .filter((ur) => ur.removedAt === null)
      .map((ur) => ({
        id: ur.id,
        roleId: ur.roleId,
        roleName: ur.role.name,
        roleCode: ur.role.code,
        description: ur.role.description,
        status: ur.role.status,
        isPrimary: ur.isPrimary,
        assignedAt: ur.assignedAt,
        assignedBy: ur.assignedBy,
        assignedByName: ur.assigner ? ur.assigner.displayName : null,
      }));

    const historicalRoles = userRoles
      .filter((ur) => ur.removedAt !== null)
      .map((ur) => ({
        id: ur.id,
        roleId: ur.roleId,
        roleName: ur.role.name,
        roleCode: ur.role.code,
        description: ur.role.description,
        status: ur.role.status,
        isPrimary: false,
        assignedAt: ur.assignedAt,
        removedAt: ur.removedAt,
        assignedBy: ur.assignedBy,
        assignedByName: ur.assigner ? ur.assigner.displayName : null,
      }));

    const effectivePermissions = await this.getEffectivePermissions(userId, organizationId);

    return {
      userId: user.id,
      displayName: user.displayName,
      activeRoles,
      historicalRoles,
      effectivePermissions,
    };
  }

  /**
   * Calculate effective permissions as union of active assigned roles
   */
  async getEffectivePermissions(userId: number, organizationId: number): Promise<string[]> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
    });
    if (!user) return [];

    const activeUserRoles = await this.prisma.smsUserRole.findMany({
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

    const permissionSet = new Set<string>();

    for (const ur of activeUserRoles) {
      if (ur.role.status !== 'active' || ur.role.deletedAt) continue;

      if (ur.role.rolePermissions && ur.role.rolePermissions.length > 0) {
        for (const rp of ur.role.rolePermissions) {
          if (rp.permission && rp.permission.code) {
            permissionSet.add(rp.permission.code);
          }
        }
      } else {
        const defaults = this.getDefaultPermissionsForRole(ur.role.code);
        defaults.forEach((p) => permissionSet.add(p));
      }
    }

    return Array.from(permissionSet);
  }

  /**
   * Assign role to user
   */
  async assignRole(
    userId: number,
    dto: AssignRoleDto,
    actorContext: { id: number; organizationId: number; role: Role },
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId: actorContext.organizationId },
    });

    if (!user) {
      throw new NotFoundException('User not found in your organization.');
    }

    if (user.deletedAt) {
      throw new BadRequestException('Cannot assign roles to a deactivated user.');
    }

    if (userId === actorContext.id && actorContext.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('You are not authorized to alter your own role assignments.');
    }

    const targetRole = await this.prisma.smsRole.findFirst({
      where: { id: dto.roleId, organizationId: actorContext.organizationId, deletedAt: null },
    });

    if (!targetRole) {
      throw new NotFoundException('The selected role is not available for this organization.');
    }

    if (targetRole.status !== 'active') {
      throw new BadRequestException('This role is inactive and cannot be assigned.');
    }

    if (actorContext.role === Role.BRANCH_MANAGER) {
      const allowedCodes = ['FRONT_DESK', 'SERVICE_STAFF'];
      if (!allowedCodes.includes(targetRole.code)) {
        throw new ForbiddenException('Branch Managers can only assign Front Desk or Service Staff roles.');
      }
    }

    const existingActive = await this.prisma.smsUserRole.findFirst({
      where: { userId, roleId: dto.roleId, removedAt: null },
    });

    if (existingActive) {
      throw new ConflictException('This role is already assigned to this user.');
    }

    await this.ensureUserHasRoleAssignment(user);

    const currentActiveCount = await this.prisma.smsUserRole.count({
      where: { userId, removedAt: null },
    });

    const isMakePrimary = dto.isPrimary === true || currentActiveCount === 0;

    await this.prisma.$transaction(async (tx) => {
      if (isMakePrimary) {
        await tx.smsUserRole.updateMany({
          where: { userId, removedAt: null },
          data: { isPrimary: false },
        });
      }

      await tx.smsUserRole.create({
        data: {
          userId,
          roleId: dto.roleId,
          isPrimary: isMakePrimary,
          assignedBy: actorContext.id,
          assignedAt: new Date(),
        },
      });

      if (isMakePrimary) {
        const validEnum = Object.values(Role).includes(targetRole.code as Role)
          ? (targetRole.code as Role)
          : user.role;
        await tx.user.update({
          where: { id: userId },
          data: { role: validEnum },
        });
      }
    });

    this.auditService.logEvent({
      organizationId: actorContext.organizationId,
      actorId: actorContext.id,
      action: 'USER_ROLE_ASSIGNED',
      targetId: userId,
      details: { roleId: dto.roleId, roleCode: targetRole.code, isPrimary: isMakePrimary },
    });

    return this.getUserRoles(userId, actorContext.organizationId);
  }

  /**
   * Switch primary role for user atomically
   */
  async makeRolePrimary(
    userId: number,
    roleId: number,
    actorContext: { id: number; organizationId: number; role: Role },
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId: actorContext.organizationId },
    });

    if (!user || user.deletedAt) {
      throw new NotFoundException('User account not found.');
    }

    if (userId === actorContext.id && actorContext.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('You are not authorized to alter your own primary role.');
    }

    const targetAssignment = await this.prisma.smsUserRole.findFirst({
      where: { userId, roleId, removedAt: null },
      include: { role: true },
    });

    if (!targetAssignment) {
      throw new NotFoundException('Active role assignment not found for this user.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.smsUserRole.updateMany({
        where: { userId, removedAt: null },
        data: { isPrimary: false },
      });

      await tx.smsUserRole.update({
        where: { id: targetAssignment.id },
        data: { isPrimary: true },
      });

      const validEnum = Object.values(Role).includes(targetAssignment.role.code as Role)
        ? (targetAssignment.role.code as Role)
        : user.role;

      await tx.user.update({
        where: { id: userId },
        data: { role: validEnum },
      });
    });

    this.auditService.logEvent({
      organizationId: actorContext.organizationId,
      actorId: actorContext.id,
      action: 'USER_ROLE_PRIMARY_CHANGED',
      targetId: userId,
      details: { roleId, roleCode: targetAssignment.role.code },
    });

    return this.getUserRoles(userId, actorContext.organizationId);
  }

  /**
   * Get role removal impact summary
   */
  async getRoleRemovalImpact(userId: number, roleId: number, organizationId: number) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const activeAssignments = await this.prisma.smsUserRole.findMany({
      where: { userId, removedAt: null },
      include: {
        role: {
          include: {
            rolePermissions: { include: { permission: true } },
          },
        },
      },
    });

    const targetAssignment = activeAssignments.find((a) => a.roleId === roleId);
    if (!targetAssignment) {
      throw new NotFoundException('Role assignment not found for this user.');
    }

    const targetRoleCode = targetAssignment.role.code;
    let targetPermissions: string[] = [];
    if (targetAssignment.role.rolePermissions && targetAssignment.role.rolePermissions.length > 0) {
      targetPermissions = targetAssignment.role.rolePermissions
        .map((rp) => rp.permission?.code)
        .filter(Boolean) as string[];
    } else {
      targetPermissions = this.getDefaultPermissionsForRole(targetRoleCode);
    }

    const otherAssignments = activeAssignments.filter((a) => a.roleId !== roleId);
    const otherPermissionsSet = new Set<string>();

    for (const a of otherAssignments) {
      if (a.role.status !== 'active') continue;
      if (a.role.rolePermissions && a.role.rolePermissions.length > 0) {
        a.role.rolePermissions.forEach((rp) => {
          if (rp.permission?.code) otherPermissionsSet.add(rp.permission.code);
        });
      } else {
        const defaults = this.getDefaultPermissionsForRole(a.role.code);
        defaults.forEach((p) => otherPermissionsSet.add(p));
      }
    }

    const lostPermissions = targetPermissions.filter((p) => !otherPermissionsSet.has(p));
    const sharedPermissions = targetPermissions.filter((p) => otherPermissionsSet.has(p));

    return {
      roleId,
      roleName: targetAssignment.role.name,
      roleCode: targetRoleCode,
      isPrimary: targetAssignment.isPrimary,
      activeRolesCount: activeAssignments.length,
      lostPermissions,
      sharedPermissions,
      totalRolePermissions: targetPermissions.length,
    };
  }

  /**
   * Remove role assignment
   */
  async removeRole(
    userId: number,
    roleId: number,
    actorContext: { id: number; organizationId: number; role: Role },
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId: actorContext.organizationId },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (userId === actorContext.id && actorContext.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('You are not authorized to alter your own role assignments.');
    }

    const activeAssignments = await this.prisma.smsUserRole.findMany({
      where: { userId, removedAt: null },
      include: { role: true },
    });

    const targetAssignment = activeAssignments.find((a) => a.roleId === roleId);
    if (!targetAssignment) {
      throw new NotFoundException('Active role assignment not found for this user.');
    }

    if (activeAssignments.length <= 1) {
      throw new BadRequestException(
        'A user must have at least one active role. Deactivate the user if access should be removed completely.',
      );
    }

    if (targetAssignment.isPrimary) {
      throw new BadRequestException(
        'This role is currently the Primary role. Make another assigned role Primary before removing it.',
      );
    }

    if (actorContext.role === Role.BRANCH_MANAGER) {
      const allowedCodes = ['FRONT_DESK', 'SERVICE_STAFF'];
      if (!allowedCodes.includes(targetAssignment.role.code)) {
        throw new ForbiddenException('Branch Managers cannot remove administrative roles.');
      }
    }

    await this.prisma.smsUserRole.update({
      where: { id: targetAssignment.id },
      data: { removedAt: new Date() },
    });

    this.auditService.logEvent({
      organizationId: actorContext.organizationId,
      actorId: actorContext.id,
      action: 'USER_ROLE_REMOVED',
      targetId: userId,
      details: { roleId, roleCode: targetAssignment.role.code },
    });

    return this.getUserRoles(userId, actorContext.organizationId);
  }
}

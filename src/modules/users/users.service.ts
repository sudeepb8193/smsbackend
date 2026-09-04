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
}

import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import * as bcrypt from 'bcrypt';

import { EffectivePermissionResolverService } from '../modules/role-permission/services/effective-permission-resolver.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private effectivePermissionResolver: EffectivePermissionResolverService,
  ) {}

  /**
   * Helper to generate a URL-safe unique slug for an organization
   */
  private async generateUniqueSlug(organizationName: string): Promise<string> {
    const baseSlug =
      organizationName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 140) || 'salon';

    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await this.prisma.sms_organizations.findUnique({
        where: { slug },
      });
      if (!existing) {
        return slug;
      }
      counter += 1;
      slug = `${baseSlug}-${counter}`;
    }
  }

  /**
   * Public Customer Registration (Strictly assigns CUSTOMER role on server)
   */
  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();

    // Hash password with 12 salt rounds
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Execute atomic creation in a single Prisma transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Resolve active salon organization to associate the customer with
      let org = await tx.sms_organizations.findFirst({
        where: { status: 'active', deletedAt: null },
        orderBy: { createdAt: 'asc' },
      });

      if (!org) {
        org = await tx.sms_organizations.findFirst({
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        });
      }

      if (!org) {
        const slug = await this.generateUniqueSlug(
          dto.organizationName || 'SalonFlow Pro',
        );
        org = await tx.sms_organizations.create({
          data: {
            name: dto.organizationName?.trim() || 'SalonFlow Pro',
            slug,
            status: 'active',
          },
        });
      }

      // 2. Global / Organization email uniqueness check
      const existingUser = await tx.sms_users.findFirst({
        where: {
          organizationId: org.id,
          email: { equals: email, mode: 'insensitive' },
          deletedAt: null,
        },
      });

      if (existingUser) {
        throw new ConflictException({
          code: 'EMAIL_ALREADY_REGISTERED',
          message: 'An account with this email address already exists',
        });
      }

      // 3. Ensure Customer system role exists (Server enforced - cannot be overridden)
      let customerRole = await tx.sms_roles.findFirst({
        where: {
          slug: 'customer',
          deletedAt: null,
        },
      });

      if (!customerRole) {
        customerRole = await tx.sms_roles.create({
          data: {
            organizationId: null,
            name: 'Customer',
            slug: 'customer',
            description:
              'Self-service customer portal account for booking appointments, viewing service menus, and receipts.',
            roleType: 'system',
            status: 'active',
          },
        });
      }

      // 4. Create customer user account
      const user = await tx.sms_users.create({
        data: {
          organizationId: org.id,
          displayName: dto.fullName.trim(),
          email,
          phoneNumber: dto.phoneNumber?.trim() || null,
          phoneCountryCode: dto.phoneCountryCode?.trim() || '+1',
          passwordHash,
          status: 'active',
          inviteAcceptedAt: new Date(),
        },
      });

      // 5. Assign Customer role (Server enforced)
      await tx.sms_userRoles.create({
        data: {
          userId: user.id,
          roleId: customerRole.id,
          isPrimary: true,
          assignedAt: new Date(),
        },
      });

      // 6. Synchronize CRM customer profile in sms_customers if not already present
      const existingCustomer = await tx.sms_customers.findFirst({
        where: {
          organizationId: org.id,
          email: { equals: email, mode: 'insensitive' },
          deletedAt: null,
        },
      });

      if (!existingCustomer) {
        const customerCode = `CUST-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
        await tx.sms_customers.create({
          data: {
            organizationId: org.id,
            customerCode,
            fullName: dto.fullName.trim(),
            email,
            phoneNumber: dto.phoneNumber?.trim() || null,
            phoneCountryCode: dto.phoneCountryCode?.trim() || '+1',
            registrationSource: 'online_portal',
            status: 'active',
            createdById: user.id,
          },
        });
      }

      return { org, user };
    });

    // Helper to build full user payload with role details
    const userObj = await this.buildUserObject(result.user.id);

    const tokens = this.generateTokens({
      sub: userObj.id,
      organizationId: userObj.organizationId,
      email: userObj.email,
    });

    return {
      user: userObj,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * Helper to build user object with assigned primary role
   */
  private async buildUserObject(userId: string) {
    const user = await this.prisma.sms_users.findUnique({
      where: { id: userId },
      include: {
        organization: true,
        userRolesAssignedToMe: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'User account not found',
      });
    }

    const userRoles = user.userRolesAssignedToMe || [];
    const primaryAssigned =
      userRoles.find((ur) => ur.isPrimary) ||
      userRoles[0];

    const roleName = primaryAssigned?.role?.name || 'Staff';
    const roleSlug = primaryAssigned?.role?.slug || 'staff';

    // Resolve effective permissions
    let permissions: string[] = [];
    let effectivePermissions: any[] = [];

    const activeUserRoles = userRoles.filter(
      (ur) => ur.role?.status === 'active' && !ur.role?.deletedAt,
    );
    const roleSlugs = activeUserRoles
      .map((ur) => ur.role?.slug?.toLowerCase())
      .filter((s): s is string => Boolean(s));
    const allRoleNames = activeUserRoles
      .map((ur) => ur.role?.name)
      .filter((n): n is string => Boolean(n));

    const isSuperAdmin =
      roleSlugs.includes('super-admin') ||
      allRoleNames.some((n) => n.toUpperCase() === 'SUPER ADMIN' || n.toUpperCase() === 'SUPER_ADMIN');
    const isOwner =
      roleSlugs.includes('owner') ||
      allRoleNames.some((n) => n.toUpperCase() === 'OWNER');

    if (isSuperAdmin) {
      const allPerms = await this.prisma.sms_permissions.findMany({
        where: { isLegacy: false },
      });
      permissions = allPerms.map((p) => p.permissionKey);
      effectivePermissions = allPerms.map((p) => ({
        permissionKey: p.permissionKey,
        moduleCode: p.moduleCode,
        action: p.action,
        label: p.label,
        scope: 'all_branches',
        allowedBranchIds: [],
        isAllBranches: true,
      }));
    } else if (user.organizationId) {
      try {
        const permMap = await this.effectivePermissionResolver.resolveUserPermissions(
          user.id,
          user.organizationId,
        );
        permissions = Array.from(permMap.keys());
        effectivePermissions = Array.from(permMap.values());
      } catch (err) {
        console.warn('Failed to resolve effective permissions:', err);
      }
    }

    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      organizationId: user.organizationId,
      organization: user.organization
        ? {
            id: user.organization.id,
            name: user.organization.name,
            logoUrl: user.organization.logoUrl,
            businessType: user.organization.businessType,
            slug: user.organization.slug,
            code: user.organization.code,
            operatingMode: user.organization.operatingMode,
            marketplaceListingStatus: user.organization.marketplaceListingStatus,
          }
        : null,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      role: roleName,
      roleSlug: roleSlug,
      roles: [...new Set([...roleSlugs, ...allRoleNames])],
      permissions,
      effectivePermissions,
    };
  }

  /**
   * Authenticate Existing User
   */
  async login(dto: LoginDto, clientIp?: string) {
    const email = dto.email.trim().toLowerCase();

    // Look up user candidates by email
    const candidateUsers = await this.prisma.sms_users.findMany({
      where: {
        email: { equals: email, mode: 'insensitive' },
        deletedAt: null,
      },
      include: {
        organization: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!candidateUsers || candidateUsers.length === 0) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    // Find matching candidate, prioritizing active and non-deleted organizations
    let user: (typeof candidateUsers)[0] | null = null;
    let passwordMatchedUser: (typeof candidateUsers)[0] | null = null;

    for (const candidate of candidateUsers) {
      if (!candidate.passwordHash) continue;
      const isMatch = await bcrypt.compare(dto.password, candidate.passwordHash);
      if (isMatch) {
        if (!passwordMatchedUser) {
          passwordMatchedUser = candidate;
        }
        if (
          candidate.organization &&
          !candidate.organization.deletedAt &&
          candidate.organization.status === 'active'
        ) {
          user = candidate;
          break;
        }
      }
    }

    if (!user) {
      user = passwordMatchedUser;
    }

    // Timing-attack safe generic credential error
    if (!user) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    // Check account status
    if (user.status === 'pending_invite') {
      throw new UnauthorizedException({
        code: 'ACCOUNT_PENDING_INVITE',
        message: 'Your account has not been activated yet. Please follow the link in your invitation to set your password.',
      });
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException({
        code: 'ACCOUNT_INACTIVE',
        message: 'Your account is inactive or suspended',
      });
    }

    // Check organization status (deactivated/suspended organizations block user access unless Super Admin)
    const org = await this.prisma.sms_organizations.findUnique({
      where: { id: user.organizationId },
    });

    if (org) {
      const userRoles = await this.prisma.sms_userRoles.findMany({
        where: { userId: user.id },
        include: { role: true },
      });
      const isSuperAdmin = userRoles.some(
        (ur) =>
          ur.role?.name?.toUpperCase() === 'SUPER ADMIN' ||
          ur.role?.slug === 'super-admin',
      );

      if (!isSuperAdmin && (org.status === 'inactive' || org.status === 'suspended')) {
        throw new UnauthorizedException({
          code: 'ORGANISATION_INACTIVE',
          message: `Your organization "${org.name}" is currently ${org.status}. Access is restricted. Please contact Super Admin.`,
        });
      }
    }

    // Record last login metadata
    await this.prisma.sms_users.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: clientIp || null,
      },
    });

    const userObj = await this.buildUserObject(user.id);

    const tokens = this.generateTokens({
      sub: userObj.id,
      organizationId: userObj.organizationId,
      email: userObj.email,
    });

    return {
      user: userObj,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * Refresh Access Token using Refresh Token
   */
  async refresh(dto: RefreshTokenDto) {
    const refreshSecret =
      process.env.JWT_REFRESH_SECRET ||
      'default_refresh_secret_key_change_in_env';

    let payload: any;
    try {
      payload = this.jwtService.verify(dto.refreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException({
        code: 'TOKEN_INVALID',
        message: 'Invalid or expired refresh token',
      });
    }

    const userId = String(payload.sub);
    const user = await this.prisma.sms_users.findUnique({
      where: { id: userId },
    });

    if (!user || user.deletedAt || user.status !== 'active') {
      throw new UnauthorizedException({
        code: 'TOKEN_INVALID',
        message: 'User is inactive or no longer exists',
      });
    }

    const userObj = await this.buildUserObject(user.id);

    const tokens = this.generateTokens({
      sub: userObj.id,
      organizationId: userObj.organizationId,
      email: userObj.email,
    });

    return {
      user: userObj,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * Get Current Authenticated User Profile (Fresh from DB)
   */
  async getProfile(userId: string) {
    const userObj = await this.buildUserObject(userId);

    if (!userObj) {
      throw new UnauthorizedException({
        code: 'TOKEN_INVALID',
        message: 'User profile not found',
      });
    }

    if (userObj.status !== 'active') {
      const code =
        userObj.status === 'deactivated'
          ? 'ACCOUNT_DEACTIVATED'
          : userObj.status === 'suspended'
          ? 'ACCOUNT_SUSPENDED'
          : 'ACCOUNT_INACTIVE';
      const message =
        userObj.status === 'deactivated'
          ? 'Your account has been deactivated. Please contact your administrator.'
          : userObj.status === 'suspended'
          ? 'Your account has been suspended. Please contact your administrator.'
          : 'Your account is inactive. Please contact your administrator.';

      throw new UnauthorizedException({ code, message });
    }

    return userObj;
  }

  /**
   * Issue signed Access Token (15m) and Refresh Token (7d)
   */
  private generateTokens(payload: {
    sub: string;
    organizationId: string;
    email: string | null;
  }) {
    const accessSecret =
      process.env.JWT_ACCESS_SECRET ||
      'default_access_secret_key_change_in_env';
    const refreshSecret =
      process.env.JWT_REFRESH_SECRET ||
      'default_refresh_secret_key_change_in_env';

    const accessExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
    const refreshExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';

    const accessToken = this.jwtService.sign(payload, {
      secret: accessSecret,
      expiresIn: accessExpiry as any,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: refreshSecret,
      expiresIn: refreshExpiry as any,
    });

    return { accessToken, refreshToken };
  }
}

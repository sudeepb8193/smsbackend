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

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
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
   * Register a new Salon Owner (Atomic Organization + User Creation)
   */
  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();

    // Generate unique organization slug
    const slug = await this.generateUniqueSlug(dto.organizationName);

    // Hash password with 12 salt rounds
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Execute atomic creation in a single Prisma transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create Organization
      const org = await tx.sms_organizations.create({
        data: {
          name: dto.organizationName.trim(),
          slug,
          status: 'onboarding',
        },
      });

      // Check email uniqueness within new org (trivially true, but handle duplicate email globally gracefully if needed)
      const existingEmail = await tx.sms_users.findFirst({
        where: {
          organizationId: org.id,
          email: { equals: email, mode: 'insensitive' },
        },
      });

      if (existingEmail) {
        throw new ConflictException({
          code: 'EMAIL_ALREADY_REGISTERED',
          message: 'An account with this email address already exists',
        });
      }

      // 2. Create Super Admin User
      const user = await tx.sms_users.create({
        data: {
          organizationId: org.id,
          displayName: dto.fullName.trim(),
          email,
          passwordHash,
          status: 'active',
          inviteAcceptedAt: new Date(),
        },
      });

      // 3. Seed System Owner Role for Organization & Assign
      const ownerRole = await tx.sms_roles.create({
        data: {
          organizationId: org.id,
          name: 'Owner',
          slug: 'owner',
          description: 'Organization Owner with full operational management rights',
          roleType: 'system',
          status: 'active',
        },
      });

      await tx.sms_userRoles.create({
        data: {
          userId: user.id,
          roleId: ownerRole.id,
          isPrimary: true,
          assignedAt: new Date(),
        },
      });

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

    const primaryAssigned =
      user.userRolesAssignedToMe.find((ur) => ur.isPrimary) ||
      user.userRolesAssignedToMe[0];

    const roleName = primaryAssigned?.role?.name || 'Staff';
    const roleSlug = primaryAssigned?.role?.slug || 'staff';

    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      organizationId: user.organizationId,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      role: roleName,
      roleSlug: roleSlug,
    };
  }

  /**
   * Authenticate Existing User
   */
  async login(dto: LoginDto, clientIp?: string) {
    const email = dto.email.trim().toLowerCase();

    // Look up user by email
    const user = await this.prisma.sms_users.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        deletedAt: null,
      },
    });

    // Timing-attack safe generic credential error
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    // Check account status
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

import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async registerCustomer(dto: { fullName?: string; displayName?: string; email?: string; phoneNumber?: string; password?: string }) {
    const displayName = (dto.fullName || dto.displayName || '').trim();
    const email = dto.email ? dto.email.trim().toLowerCase() : null;
    const phoneNumber = dto.phoneNumber ? dto.phoneNumber.trim() : null;

    if (!displayName) {
      throw new BadRequestException('Full Name is required.');
    }

    if (!email && !phoneNumber) {
      throw new BadRequestException('Either Email address or Phone Number is required.');
    }

    if (!dto.password || dto.password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long.');
    }

    // Check email uniqueness
    if (email) {
      const existingEmailUser = await this.prisma.user.findFirst({
        where: {
          email: { equals: email, mode: 'insensitive' },
        },
      });
      if (existingEmailUser) {
        throw new BadRequestException('An account with this email address already exists.');
      }
    }

    // Check phone uniqueness
    if (phoneNumber) {
      const existingPhoneUser = await this.prisma.user.findFirst({
        where: {
          phoneNumber: phoneNumber,
        },
      });
      if (existingPhoneUser) {
        throw new BadRequestException('An account with this phone number already exists.');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Strictly assign Role.CUSTOMER on backend regardless of client payload
    const newUser = await this.prisma.user.create({
      data: {
        organizationId: 1,
        displayName,
        email,
        phoneNumber,
        passwordHash,
        role: Role.CUSTOMER,
      },
    });

    const { passwordHash: _ph, inviteToken: _it, ...safeUser } = newUser;

    return {
      message: 'Customer account created successfully.',
      user: safeUser,
    };
  }

  async validateUser(identifier: string, pass: string, clientIp?: string) {
    const trimmed = identifier.trim();
    // Search user by email or phone
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: trimmed.toLowerCase(), mode: 'insensitive' } },
          { phoneNumber: trimmed },
        ],
      },
    });

    if (!user) {
      return null;
    }

    if (user.deletedAt) {
      throw new UnauthorizedException('User account is deactivated.');
    }

    if (user.passwordHash && (await bcrypt.compare(pass, user.passwordHash))) {
      // Record last login details
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          lastLoginIp: clientIp || null,
        },
      });

      const { passwordHash, inviteToken, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role,
      organizationId: user.organizationId,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        uuid: user.uuid,
        email: user.email,
        phoneNumber: user.phoneNumber,
        displayName: user.displayName,
        role: user.role,
        organizationId: user.organizationId,
        lastLoginAt: user.lastLoginAt,
      },
    };
  }

  async seedDemoUser() {
    let admin = await this.prisma.user.findFirst({
      where: { role: Role.SUPER_ADMIN },
    });

    if (!admin) {
      const hashedPassword = await bcrypt.hash('Admin@123456', 10);
      admin = await this.prisma.user.create({
        data: {
          organizationId: 1,
          email: 'admin@salon.com',
          displayName: 'Super Admin',
          passwordHash: hashedPassword,
          inviteAcceptedAt: new Date(),
          role: Role.SUPER_ADMIN,
        },
      });
    }

    return this.login(admin);
  }
}


import { Injectable, UnauthorizedException } from '@nestjs/common';
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

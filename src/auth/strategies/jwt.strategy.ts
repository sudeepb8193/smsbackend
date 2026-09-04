import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'salon_secret_key_change_in_prod',
    });
  }

  async validate(payload: { sub: string | number; email: string; role: any; organizationId?: number }) {
    const userId = typeof payload.sub === 'number' ? payload.sub : parseInt(payload.sub, 10);
    if (isNaN(userId)) {
      throw new UnauthorizedException('Invalid user token payload.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User account no longer exists.');
    }

    return {
      id: user.id,
      uuid: user.uuid,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      organizationId: user.organizationId,
    };
  }
}

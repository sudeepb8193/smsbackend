import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        process.env.JWT_ACCESS_SECRET ||
        'default_access_secret_key_change_in_env',
    });
  }

  async validate(payload: {
    sub: string;
    organizationId: string;
    email: string;
  }) {
    const userId = String(payload.sub);
    if (!userId) {
      throw new UnauthorizedException({
        code: 'TOKEN_INVALID',
        message: 'Invalid access token payload',
      });
    }

    const user = await this.prisma.sms_users.findUnique({
      where: { id: userId },
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException({
        code: 'TOKEN_INVALID',
        message: 'User account no longer exists or is deactivated',
      });
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      organizationId: user.organizationId,
      status: user.status,
    };
  }
}

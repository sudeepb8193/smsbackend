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

    if (user.status !== 'active') {
      const code =
        user.status === 'deactivated'
          ? 'ACCOUNT_DEACTIVATED'
          : user.status === 'suspended'
          ? 'ACCOUNT_SUSPENDED'
          : 'ACCOUNT_INACTIVE';

      const message =
        user.status === 'deactivated'
          ? 'Your account has been deactivated. Please contact your administrator.'
          : user.status === 'suspended'
          ? 'Your account has been suspended. Please contact your administrator.'
          : 'Your account is inactive. Please contact your administrator.';

      throw new UnauthorizedException({
        code,
        message,
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

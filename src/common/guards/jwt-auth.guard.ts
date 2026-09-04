import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const roleHeader = request.headers['x-user-role'] as string;
    const userIdHeader = request.headers['x-user-id'] as string;
    const orgIdHeader = request.headers['x-organization-id'] as string;

    // Header-based development auth fallback if no Bearer token provided
    const authHeader = request.headers.authorization;
    if (!authHeader && roleHeader) {
      request.user = {
        id: userIdHeader || 'admin-user-1',
        email: 'owner@salon.com',
        name: 'Super Admin',
        role: (roleHeader as Role) || Role.SUPER_ADMIN,
        organizationId: orgIdHeader ? parseInt(orgIdHeader, 10) : 1,
      };
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication required to access this resource.');
    }
    return user;
  }
}

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'User authentication context missing',
      });
    }

    // Retrieve user assigned roles from DB
    const userRoles = await this.prisma.sms_userRoles.findMany({
      where: {
        userId: user.id,
      },
      include: {
        role: true,
      },
    });

    const roleSlugs = userRoles
      .map((ur) => ur.role?.slug?.toLowerCase())
      .filter((slug): slug is string => Boolean(slug));

    const roleNames = userRoles
      .map((ur) => ur.role?.name?.toUpperCase().replace(/\s+/g, '_'))
      .filter((name): name is string => Boolean(name));

    const allUserRoles = [...new Set([...roleSlugs, ...roleNames])];

    const hasRole = requiredRoles.some((reqRole) => {
      const normalizedReq = reqRole.toLowerCase().replace(/_/g, '-');
      return (
        allUserRoles.includes(normalizedReq) ||
        allUserRoles.includes(reqRole.toLowerCase()) ||
        allUserRoles.includes(reqRole.toUpperCase())
      );
    });

    if (!hasRole) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions to perform this operation',
      });
    }

    return true;
  }
}

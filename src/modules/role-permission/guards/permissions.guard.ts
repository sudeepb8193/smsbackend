import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import { EffectivePermissionResolverService } from '../services/effective-permission-resolver.service';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionResolver: EffectivePermissionResolverService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id || !user.organizationId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Authentication context missing or invalid organization',
      });
    }

    // Super Admin platform role bypass check
    const userRoles = await this.prisma.sms_userRoles.findMany({
      where: { userId: user.id, removedAt: null },
      include: { role: true },
    });
    const isSuperAdmin = userRoles.some(
      (ur) =>
        ur.role?.slug?.toLowerCase() === 'super-admin' ||
        ur.role?.name?.toUpperCase() === 'SUPER_ADMIN',
    );

    if (isSuperAdmin) {
      return true;
    }

    // Extract target branchId if available from params, query, or body
    const branchId =
      request.params?.branchId ||
      request.query?.branchId ||
      request.body?.branchId ||
      undefined;

    // Check each required permission
    for (const permKey of requiredPermissions) {
      const result = await this.permissionResolver.can(
        user.id,
        user.organizationId,
        permKey,
        branchId,
      );

      if (!result.authorized) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: result.reason || 'Insufficient permissions to perform this operation',
          requiredPermission: permKey,
          targetBranchId: branchId || null,
        });
      }
    }

    return true;
  }
}

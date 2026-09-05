import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { UsersService } from '../../modules/users/users.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.id) {
      throw new ForbiddenException('User identity not found in request context.');
    }

    const effectivePermissions = await this.usersService.getEffectivePermissions(
      Number(user.id),
      Number(user.organizationId || 1),
    );

    const hasPermission = requiredPermissions.every((permission) =>
      effectivePermissions.includes(permission),
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        'You do not have the required permissions to perform this operation.',
      );
    }

    return true;
  }
}

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Role } from '@prisma/client';

@Injectable()
export class BranchScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const body = request.body;

    if (!user) {
      throw new ForbiddenException('User authentication context is required.');
    }

    // Super Admin has full administrative access
    if (user.role === Role.SUPER_ADMIN) {
      return true;
    }

    // Branch Manager specific restrictions
    if (user.role === Role.BRANCH_MANAGER) {
      // If role assignment is being performed in the request body
      if (body && body.role) {
        const allowedRoles: Role[] = [Role.FRONT_DESK, Role.SERVICE_STAFF];
        if (!allowedRoles.includes(body.role)) {
          throw new ForbiddenException(
            `Branch Managers are only permitted to manage ${allowedRoles.join(', ')} roles.`,
          );
        }
      }

      // If branch assignment is specified, verify branch scope
      if (body && Array.isArray(body.branchIds) && body.branchIds.length > 0) {
        const userBranchIds: number[] = user.branchIds || [];
        // If user has assigned branches, ensure all targeted branchIds fall within allowed set
        if (userBranchIds.length > 0) {
          const unauthorized = body.branchIds.some(
            (bId: number) => !userBranchIds.includes(bId),
          );
          if (unauthorized) {
            throw new ForbiddenException(
              'You do not have permission to assign users to branches outside your authorized scope.',
            );
          }
        }
      }
    }

    return true;
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserRoleService } from '../services/user-role.service';
import { PrismaService } from '../../../database/prisma.service';
import { AssignRoleDto } from '../dto/assign-role.dto';
import { BulkAssignRoleDto } from '../dto/bulk-assign-role.dto';
import { SetPrimaryRoleDto } from '../dto/set-primary-role.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserRoleController {
  constructor(
    private readonly userRoleService: UserRoleService,
    private readonly prisma: PrismaService,
  ) {}

  private async getEffectiveOrgId(
    user: AuthenticatedUser,
    explicitOrgId?: string,
    headerOrgId?: string,
  ): Promise<string> {
    const roles = (user.roles || []).map((r) => r.toLowerCase().replace(/_/g, '-'));
    let isSuperAdmin = roles.includes('super-admin');

    if (!isSuperAdmin) {
      const userRoles = await this.prisma.sms_userRoles.findMany({
        where: { userId: user.id, removedAt: null },
        include: { role: true },
      });
      isSuperAdmin = userRoles.some((ur) => {
        const s = ur.role?.slug?.toLowerCase();
        const n = ur.role?.name?.toUpperCase();
        return s === 'super-admin' || n === 'SUPER ADMIN' || n === 'SUPER_ADMIN';
      });
    }

    if (isSuperAdmin) {
      const targetOrg = explicitOrgId || headerOrgId;
      if (targetOrg && typeof targetOrg === 'string' && targetOrg.trim() !== '') {
        return targetOrg.trim();
      }
    }

    return user.organizationId;
  }

  /**
   * List all organization users with active roles summary
   */
  @Roles('SUPER_ADMIN', 'super-admin', 'OWNER', 'owner', 'BRANCH_MANAGER', 'branch-manager')
  @Get('with-roles')
  @HttpCode(HttpStatus.OK)
  async getUsersWithRoles(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('x-organization-id') headerOrgId?: string,
  ) {
    const orgId = await this.getEffectiveOrgId(user, undefined, headerOrgId);
    return this.userRoleService.getUsersWithRoles(orgId);
  }

  /**
   * Get all roles available for assignment in the organization
   */
  @Roles('SUPER_ADMIN', 'super-admin', 'OWNER', 'owner', 'BRANCH_MANAGER', 'branch-manager')
  @Get('available-roles')
  @HttpCode(HttpStatus.OK)
  async getAvailableRoles(
    @CurrentUser() user: AuthenticatedUser,
    @Query('organizationId') queryOrgId?: string,
    @Headers('x-organization-id') headerOrgId?: string,
  ) {
    const orgId = await this.getEffectiveOrgId(user, queryOrgId, headerOrgId);
    return this.userRoleService.getAvailableRoles(orgId, user);
  }

  /**
   * Bulk assign a role to multiple users (Super Admin / Owner only)
   */
  @Roles('SUPER_ADMIN', 'super-admin', 'OWNER', 'owner')
  @Post('bulk-assign-role')
  @HttpCode(HttpStatus.OK)
  async bulkAssignRoles(
    @Body() dto: BulkAssignRoleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('x-organization-id') headerOrgId?: string,
  ) {
    const orgId = await this.getEffectiveOrgId(user, undefined, headerOrgId);
    return this.userRoleService.bulkAssignRoles(
      orgId,
      user.id,
      dto,
    );
  }

  /**
   * Get user role details, audit history, and effective permissions
   */
  @Roles('SUPER_ADMIN', 'super-admin', 'OWNER', 'owner', 'BRANCH_MANAGER', 'branch-manager')
  @Get(':id/roles')
  @HttpCode(HttpStatus.OK)
  async getUserRoleDetails(
    @Param('id') userId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('x-organization-id') headerOrgId?: string,
  ) {
    const orgId = await this.getEffectiveOrgId(user, undefined, headerOrgId);
    return this.userRoleService.getUserRoleDetails(userId, orgId);
  }

  /**
   * Assign a role to a user (Super Admin / Owner only)
   */
  @Roles('SUPER_ADMIN', 'super-admin', 'OWNER', 'owner')
  @Post(':id/roles')
  @HttpCode(HttpStatus.CREATED)
  async assignRole(
    @Param('id') userId: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('x-organization-id') headerOrgId?: string,
  ) {
    const orgId = await this.getEffectiveOrgId(user, undefined, headerOrgId);
    return this.userRoleService.assignRole(
      userId,
      orgId,
      user.id,
      dto,
    );
  }

  /**
   * Set a user's assigned role as Primary (Super Admin / Owner only)
   */
  @Roles('SUPER_ADMIN', 'super-admin', 'OWNER', 'owner')
  @Patch(':id/roles/:roleId/primary')
  @HttpCode(HttpStatus.OK)
  async setPrimaryRole(
    @Param('id') userId: string,
    @Param('roleId') roleId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('x-organization-id') headerOrgId?: string,
  ) {
    const orgId = await this.getEffectiveOrgId(user, undefined, headerOrgId);
    return this.userRoleService.setPrimaryRole(
      userId,
      roleId,
      orgId,
    );
  }

  /**
   * Preview permissions lost impact before removing a role (Super Admin / Owner only)
   */
  @Roles('SUPER_ADMIN', 'super-admin', 'OWNER', 'owner')
  @Get(':id/roles/:roleId/impact')
  @HttpCode(HttpStatus.OK)
  async getRoleRemovalImpact(
    @Param('id') userId: string,
    @Param('roleId') roleId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('x-organization-id') headerOrgId?: string,
  ) {
    const orgId = await this.getEffectiveOrgId(user, undefined, headerOrgId);
    return this.userRoleService.getRoleRemovalImpact(
      userId,
      roleId,
      orgId,
    );
  }

  /**
   * Remove a role assignment from a user (Super Admin / Owner only; Blocked if last role)
   */
  @Roles('SUPER_ADMIN', 'super-admin', 'OWNER', 'owner')
  @Delete(':id/roles/:roleId')
  @HttpCode(HttpStatus.OK)
  async removeRole(
    @Param('id') userId: string,
    @Param('roleId') roleId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('x-organization-id') headerOrgId?: string,
  ) {
    const orgId = await this.getEffectiveOrgId(user, undefined, headerOrgId);
    return this.userRoleService.removeRole(
      userId,
      roleId,
      orgId,
    );
  }

  /**
   * Get calculated effective permissions union for user
   */
  @Roles('SUPER_ADMIN', 'super-admin', 'OWNER', 'owner', 'BRANCH_MANAGER', 'branch-manager')
  @Get(':id/effective-permissions')
  @HttpCode(HttpStatus.OK)
  async getEffectivePermissions(
    @Param('id') userId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('x-organization-id') headerOrgId?: string,
  ) {
    const orgId = await this.getEffectiveOrgId(user, undefined, headerOrgId);
    return this.userRoleService.getEffectivePermissions(
      userId,
      orgId,
    );
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserRoleService } from '../services/user-role.service';
import { AssignRoleDto } from '../dto/assign-role.dto';
import { BulkAssignRoleDto } from '../dto/bulk-assign-role.dto';
import { SetPrimaryRoleDto } from '../dto/set-primary-role.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserRoleController {
  constructor(private readonly userRoleService: UserRoleService) {}

  /**
   * List all organization users with active roles summary
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async getUsersWithRoles(@CurrentUser() user: AuthenticatedUser) {
    return this.userRoleService.getUsersWithRoles(user.organizationId);
  }

  /**
   * Get all roles available for assignment in the organization
   */
  @Get('available-roles')
  @HttpCode(HttpStatus.OK)
  async getAvailableRoles(@CurrentUser() user: AuthenticatedUser) {
    return this.userRoleService.getAvailableRoles(user.organizationId);
  }

  /**
   * Bulk assign a role to multiple users (Super Admin / Admin)
   */
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'super-admin', 'BRANCH_MANAGER', 'branch-manager')
  @Post('bulk-assign-role')
  @HttpCode(HttpStatus.OK)
  async bulkAssignRoles(
    @Body() dto: BulkAssignRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.userRoleService.bulkAssignRoles(
      user.organizationId,
      user.id,
      dto,
    );
  }

  /**
   * Get user role details, audit history, and effective permissions
   */
  @Get(':id/roles')
  @HttpCode(HttpStatus.OK)
  async getUserRoleDetails(
    @Param('id') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.userRoleService.getUserRoleDetails(userId, user.organizationId);
  }

  /**
   * Assign a role to a user (Super Admin / Branch Manager)
   */
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'super-admin', 'BRANCH_MANAGER', 'branch-manager')
  @Post(':id/roles')
  @HttpCode(HttpStatus.CREATED)
  async assignRole(
    @Param('id') userId: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.userRoleService.assignRole(
      userId,
      user.organizationId,
      user.id,
      dto,
    );
  }

  /**
   * Set a user's assigned role as Primary
   */
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'super-admin', 'BRANCH_MANAGER', 'branch-manager')
  @Patch(':id/roles/:roleId/primary')
  @HttpCode(HttpStatus.OK)
  async setPrimaryRole(
    @Param('id') userId: string,
    @Param('roleId') roleId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.userRoleService.setPrimaryRole(
      userId,
      roleId,
      user.organizationId,
    );
  }

  /**
   * Preview permissions lost impact before removing a role
   */
  @Get(':id/roles/:roleId/impact')
  @HttpCode(HttpStatus.OK)
  async getRoleRemovalImpact(
    @Param('id') userId: string,
    @Param('roleId') roleId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.userRoleService.getRoleRemovalImpact(
      userId,
      roleId,
      user.organizationId,
    );
  }

  /**
   * Remove a role assignment from a user (Blocked if last role)
   */
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'super-admin', 'BRANCH_MANAGER', 'branch-manager')
  @Delete(':id/roles/:roleId')
  @HttpCode(HttpStatus.OK)
  async removeRole(
    @Param('id') userId: string,
    @Param('roleId') roleId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.userRoleService.removeRole(
      userId,
      roleId,
      user.organizationId,
    );
  }

  /**
   * Get calculated effective permissions union for user
   */
  @Get(':id/effective-permissions')
  @HttpCode(HttpStatus.OK)
  async getEffectivePermissions(
    @Param('id') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.userRoleService.getEffectivePermissions(
      userId,
      user.organizationId,
    );
  }
}

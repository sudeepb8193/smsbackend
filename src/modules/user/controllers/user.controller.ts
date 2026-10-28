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
  ParseUUIDPipe,
} from '@nestjs/common';
import { UserService } from '../services/user.service';
import { UserRoleService } from '../services/user-role.service';
import { PrismaService } from '../../../database/prisma.service';
import { CreateUserInviteDto } from '../dto/create-user-invite.dto';
import { QueryUsersDto } from '../dto/query-users.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { AcceptInviteDto } from '../dto/accept-invite.dto';
import { ChangeUserStatusDto } from '../dto/change-user-status.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../role-permission/guards/permissions.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../role-permission/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { Throttle } from '@nestjs/throttler';

@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly userRoleService: UserRoleService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Helper: Resolves effective organization ID.
   * - For SUPER ADMIN: scopes to selected organization (via DTO, query, or x-organization-id header).
   * - For OWNER / other roles: strictly scoped to their own organization (user.organizationId).
   */
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
   * Public: Verify an invitation token before setting password
   */
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Get('verify-invite')
  @HttpCode(HttpStatus.OK)
  async verifyInvite(@Query('token') token: string) {
    return this.userService.verifyInviteToken(token);
  }

  /**
   * Public: Accept invitation, establish password, and activate account
   */
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('accept-invite')
  @HttpCode(HttpStatus.OK)
  async acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.userService.acceptInvite(dto);
  }

  /**
   * List users in organization with search, filters, and pagination
   */
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions('users.view')
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryUsersDto,
    @Headers('x-organization-id') headerOrgId?: string,
  ) {
    const orgId = await this.getEffectiveOrgId(user, query.organizationId, headerOrgId);
    return this.userService.findAll(orgId, query, user);
  }

  /**
   * Get all active roles available for assignment in the organization
   */
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions('users.view')
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
   * Invite a new user to the organization (Owner, Super Admin, Branch Manager)
   */
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions('users.create')
  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  async inviteUser(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateUserInviteDto,
    @Headers('x-organization-id') headerOrgId?: string,
  ) {
    const orgId = await this.getEffectiveOrgId(user, dto.organizationId, headerOrgId);
    return this.userService.inviteUser(orgId, user, dto);
  }

  /**
   * Resend invitation with a refreshed single-use token and renewed 7-day expiry
   */
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions('users.create')
  @Post(':id/resend-invite')
  @HttpCode(HttpStatus.OK)
  async resendInvite(
    @Param('id', new ParseUUIDPipe({ version: '4' })) userId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('x-organization-id') headerOrgId?: string,
  ) {
    const orgId = await this.getEffectiveOrgId(user, undefined, headerOrgId);
    return this.userService.resendInvite(userId, orgId, user);
  }

  /**
   * Get single user details by ID
   */
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions('users.view')
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) userId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('x-organization-id') headerOrgId?: string,
  ) {
    const orgId = await this.getEffectiveOrgId(user, undefined, headerOrgId);
    return this.userService.findOne(userId, orgId, user);
  }

  /**
   * Update user profile information
   */
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions('users.edit')
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateUser(
    @Param('id', new ParseUUIDPipe({ version: '4' })) userId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateUserDto,
    @Headers('x-organization-id') headerOrgId?: string,
  ) {
    const orgId = await this.getEffectiveOrgId(user, undefined, headerOrgId);
    return this.userService.updateUser(userId, orgId, user, dto);
  }

  /**
   * Change user account status (active, suspended, deactivated)
   */
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions('users.edit')
  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  async changeUserStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) userId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangeUserStatusDto,
    @Headers('x-organization-id') headerOrgId?: string,
  ) {
    const orgId = await this.getEffectiveOrgId(user, undefined, headerOrgId);
    return this.userService.changeUserStatus(userId, orgId, user, dto);
  }

  /**
   * Soft delete user account (blocked if historical transactions exist)
   */
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions('users.delete')
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteUser(
    @Param('id', new ParseUUIDPipe({ version: '4' })) userId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('x-organization-id') headerOrgId?: string,
  ) {
    const orgId = await this.getEffectiveOrgId(user, undefined, headerOrgId);
    return this.userService.deleteUser(userId, orgId, user);
  }
}

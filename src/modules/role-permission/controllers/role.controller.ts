import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { RoleService } from '../services/role.service';
import { RolePermissionService } from '../services/role-permission.service';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { AssignRolePermissionsDto } from '../dto/assign-role-permissions.dto';
import { QueryRolesDto } from '../dto/query-roles.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RequirePermissions } from '../decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import type { Request } from 'express';

@Controller('api/roles')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class RoleController {
  constructor(
    private readonly roleService: RoleService,
    private readonly rolePermissionService: RolePermissionService,
  ) {}

  /**
   * Get organization branches for branch-scope restrictions
   */
  @Get('meta/branches')
  @RequirePermissions('roles.view')
  @HttpCode(HttpStatus.OK)
  async getBranches(
    @CurrentUser() user: AuthenticatedUser,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = queryOrgId || user.organizationId;
    return this.rolePermissionService['prisma'].sms_branches.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: { id: true, name: true, code: true, status: true },
      orderBy: { name: 'asc' },
    });
  }

  private isSuperAdmin(user: AuthenticatedUser): boolean {
    const roles = user.roles || [];
    return roles.some((r) =>
      ['super_admin', 'super-admin'].includes(r.toLowerCase().replace(/_/g, '-')),
    );
  }

  /**
   * List organization roles
   */
  @Get()
  @RequirePermissions('roles.view')
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query() query: QueryRolesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const isSuperAdmin = this.isSuperAdmin(user);
    return this.roleService.findAll(user.organizationId, query, isSuperAdmin);
  }

  /**
   * Get single role details
   */
  @Get(':id')
  @RequirePermissions('roles.view')
  @HttpCode(HttpStatus.OK)
  async findOne(
    @Param('id') roleId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const isSuperAdmin = this.isSuperAdmin(user);
    return this.roleService.findOne(roleId, user.organizationId, isSuperAdmin);
  }

  /**
   * Create new custom role
   */
  @Post()
  @RequirePermissions('roles.create')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateRoleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const clientIp = req.ip || req.socket?.remoteAddress;
    return this.roleService.createRole(
      dto,
      user.id,
      user.organizationId,
      clientIp,
    );
  }

  /**
   * Update role metadata
   */
  @Put(':id')
  @RequirePermissions('roles.edit')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') roleId: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const isSuperAdmin = this.isSuperAdmin(user);
    const clientIp = req.ip || req.socket?.remoteAddress;
    return this.roleService.updateRole(
      roleId,
      dto,
      user.id,
      user.organizationId,
      isSuperAdmin,
      clientIp,
    );
  }

  /**
   * Soft delete custom role
   */
  @Delete(':id')
  @RequirePermissions('roles.delete')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id') roleId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const isSuperAdmin = this.isSuperAdmin(user);
    const clientIp = req.ip || req.socket?.remoteAddress;
    return this.roleService.deleteRole(
      roleId,
      user.id,
      user.organizationId,
      isSuperAdmin,
      clientIp,
    );
  }

  /**
   * Get affected users for a role
   */
  @Get(':id/affected-users')
  @RequirePermissions('roles.view')
  @HttpCode(HttpStatus.OK)
  async getAffectedUsers(
    @Param('id') roleId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const isSuperAdmin = this.isSuperAdmin(user);
    return this.roleService.getAffectedUsers(roleId, user.organizationId, isSuperAdmin);
  }

  /**
   * Get role's assigned permissions and branch restrictions
   */
  @Get(':id/permissions')
  @RequirePermissions('roles.view')
  @HttpCode(HttpStatus.OK)
  async getRolePermissions(
    @Param('id') roleId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const isSuperAdmin = this.isSuperAdmin(user);
    return this.rolePermissionService.getRolePermissions(
      roleId,
      user.organizationId,
      isSuperAdmin,
    );
  }

  /**
   * Save role permission assignments and branch scopes with optimistic concurrency
   */
  @Put(':id/permissions')
  @RequirePermissions('roles.edit')
  @HttpCode(HttpStatus.OK)
  async updateRolePermissions(
    @Param('id') roleId: string,
    @Body() dto: AssignRolePermissionsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const isSuperAdmin = this.isSuperAdmin(user);
    const clientIp = req.ip || req.socket?.remoteAddress;
    return this.rolePermissionService.updateRolePermissions(
      roleId,
      dto,
      user.id,
      user.organizationId,
      isSuperAdmin,
      clientIp,
    );
  }
}

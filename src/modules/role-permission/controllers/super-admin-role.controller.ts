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
import { PermissionService } from '../services/permission.service';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { AssignRolePermissionsDto } from '../dto/assign-role-permissions.dto';
import { QueryRolesDto } from '../dto/query-roles.dto';
import { QueryPermissionsDto } from '../dto/query-permissions.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import type { Request } from 'express';
import { PrismaService } from '../../../database/prisma.service';

@Controller('api/super-admin/roles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'super-admin')
export class SuperAdminRoleController {
  constructor(
    private readonly roleService: RoleService,
    private readonly rolePermissionService: RolePermissionService,
    private readonly permissionService: PermissionService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * List roles with organization filters for Super Admin
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: QueryRolesDto) {
    return this.roleService.findAll(query.organizationId || null, query, true);
  }

  /**
   * Get single role details
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') roleId: string) {
    return this.roleService.findOne(roleId, null, true);
  }

  /**
   * Create role for specified organization (or default)
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateRoleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const targetOrgId = dto.organizationId || user.organizationId;
    const clientIp = req.ip || req.socket?.remoteAddress;
    return this.roleService.createRole(dto, user.id, targetOrgId, clientIp);
  }

  /**
   * Update role
   */
  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') roleId: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const clientIp = req.ip || req.socket?.remoteAddress;
    return this.roleService.updateRole(roleId, dto, user.id, null, true, clientIp);
  }

  /**
   * Delete custom role
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id') roleId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const clientIp = req.ip || req.socket?.remoteAddress;
    return this.roleService.deleteRole(roleId, user.id, null, true, clientIp);
  }

  /**
   * Get role permissions
   */
  @Get(':id/permissions')
  @HttpCode(HttpStatus.OK)
  async getRolePermissions(@Param('id') roleId: string) {
    return this.rolePermissionService.getRolePermissions(roleId, null, true);
  }

  /**
   * Save role permissions
   */
  @Put(':id/permissions')
  @HttpCode(HttpStatus.OK)
  async updateRolePermissions(
    @Param('id') roleId: string,
    @Body() dto: AssignRolePermissionsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const clientIp = req.ip || req.socket?.remoteAddress;
    return this.rolePermissionService.updateRolePermissions(
      roleId,
      dto,
      user.id,
      null,
      true,
      clientIp,
    );
  }
}



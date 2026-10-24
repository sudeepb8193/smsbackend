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
import { BranchService } from '../services/branch.service';
import { CreateBranchDto } from '../dto/create-branch.dto';
import { UpdateBranchDto } from '../dto/update-branch.dto';
import { QueryBranchDto } from '../dto/query-branch.dto';
import { CopyBranchSettingsDto } from '../dto/copy-branch-settings.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import type { Request } from 'express';

import { Patch } from '@nestjs/common';

@Controller(['branches', 'organizations/:orgId/branches'])
@UseGuards(JwtAuthGuard, RolesGuard)
export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  /**
   * 1. Check branch code availability and get next available suggestion
   * GET /branches/check-code?code=BLR-01
   */
  @Get('check-code')
  @Roles('SUPER_ADMIN', 'OWNER', 'super-admin', 'owner')
  @HttpCode(HttpStatus.OK)
  async checkCode(
    @Query('code') code: string,
    @Query('organizationId') queryOrgId?: string,
    @CurrentUser() user?: AuthenticatedUser,
    @Param('orgId') paramOrgId?: string,
  ) {
    const effectiveUser = (user || (typeof queryOrgId === 'object' ? queryOrgId : undefined)) as AuthenticatedUser;
    const actualQueryOrgId = typeof queryOrgId === 'string' ? queryOrgId : undefined;
    const roles = (effectiveUser?.roles || []).map((r) => r.toLowerCase().replace(/_/g, '-'));
    const isSuperAdmin = roles.includes('super-admin');
    const orgId = (isSuperAdmin && actualQueryOrgId) || paramOrgId || actualQueryOrgId || effectiveUser?.organizationId;
    return this.branchService.checkCodeAvailability(
      orgId,
      code,
    );
  }

  /**
   * 2. List Branches (Searchable, filterable, paginated)
   * GET /branches or GET /organizations/:orgId/branches
   */
  @Get()
  @Roles(
    'SUPER_ADMIN',
    'OWNER',
    'BRANCH_MANAGER',
    'ACCOUNTANT',
    'FRONT_DESK',
    'super-admin',
    'owner',
    'branch-manager',
    'accountant',
    'front-desk',
  )
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query() query: QueryBranchDto,
    @CurrentUser() user: AuthenticatedUser,
    @Param('orgId') paramOrgId?: string,
  ) {
    const roles = (user?.roles || []).map((r) => r.toLowerCase().replace(/_/g, '-'));
    const isSuperAdmin = roles.includes('super-admin');
    const effectiveOrgId = (isSuperAdmin && query.organizationId) || paramOrgId || user?.organizationId;
    const effectiveUser = effectiveOrgId ? { ...user, organizationId: effectiveOrgId } : user;
    return this.branchService.findAll(query, effectiveUser);
  }

  /**
   * 3. Create a Branch (Draft or Active)
   * POST /branches or POST /organizations/:orgId/branches
   */
  @Post()
  @Roles('SUPER_ADMIN', 'OWNER', 'super-admin', 'owner')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateBranchDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Param('orgId') paramOrgId?: string,
  ) {
    if (paramOrgId && !dto.organizationId) {
      dto.organizationId = paramOrgId;
    }
    const clientIp = req?.ip || req?.socket?.remoteAddress;
    return this.branchService.create(dto, user, clientIp);
  }

  /**
   * 4. Inspect Deletion Blockers for a Branch
   * GET /branches/:id/blockers
   */
  @Get(':id/blockers')
  @Roles('SUPER_ADMIN', 'OWNER', 'super-admin', 'owner')
  @HttpCode(HttpStatus.OK)
  async getBlockers(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.branchService.getBlockers(id, user);
  }

  /**
   * 5. Copy Settings from an Existing Branch
   * POST /branches/:id/copy-settings
   */
  @Post(':id/copy-settings')
  @Roles('SUPER_ADMIN', 'OWNER', 'super-admin', 'owner')
  @HttpCode(HttpStatus.OK)
  async copySettings(
    @Param('id') id: string,
    @Body() dto: CopyBranchSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.branchService.copySettings(id, dto, user);
  }

  /**
   * 6. View Branch Detail & Profile
   * GET /branches/:id
   */
  @Get(':id')
  @Roles(
    'SUPER_ADMIN',
    'OWNER',
    'BRANCH_MANAGER',
    'ACCOUNTANT',
    'FRONT_DESK',
    'super-admin',
    'owner',
    'branch-manager',
    'accountant',
    'front-desk',
  )
  @HttpCode(HttpStatus.OK)
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.branchService.findOne(id, user);
  }

  /**
   * 7. Update Branch Profile & Status
   * PUT /branches/:id or PATCH /branches/:id
   */
  @Put(':id')
  @Patch(':id')
  @Roles('SUPER_ADMIN', 'OWNER', 'BRANCH_MANAGER', 'super-admin', 'owner', 'branch-manager')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const clientIp = req.ip || req.socket.remoteAddress;
    return this.branchService.update(id, dto, user, clientIp);
  }

  /**
   * 8. Soft Delete a Branch
   * DELETE /branches/:id
   */
  @Delete(':id')
  @Roles('SUPER_ADMIN', 'OWNER', 'super-admin', 'owner')
  @HttpCode(HttpStatus.OK)
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const clientIp = req.ip || req.socket.remoteAddress;
    return this.branchService.delete(id, user, clientIp);
  }
}

import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { OrganisationService } from './organisation.service';
import { CreateOrganisationDto } from '../dto/create-organisation.dto';
import { UpdateOrganisationDto } from '../dto/update-organisation.dto';
import { UpdateOrganisationStatusDto } from '../dto/update-organisation-status.dto';
import { QueryOrganisationDto } from '../dto/query-organisation.dto';
import { UpdateOrganisationSetupDto } from '../dto/update-organisation-setup.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { PermissionsGuard } from '../../role-permission/guards/permissions.guard';
import { RequirePermissions } from '../../role-permission/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import type { Request } from 'express';

@Controller('super-admin/organisations')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('SUPER_ADMIN', 'super-admin')
export class OrganisationController {
  constructor(private readonly organisationService: OrganisationService) {}

  /**
   * 1. List Organisations (Paginated, filtered, searchable)
   * GET /super-admin/organisations
   */
  @Get()
  @RequirePermissions('organizations.view')
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: QueryOrganisationDto) {
    return this.organisationService.findAll(query);
  }

  /**
   * 2. Create Organisation (Super Admin only or authorized permission)
   * POST /super-admin/organisations
   */
  @Post()
  @RequirePermissions('organizations.create')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateOrganisationDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const clientIp = req.ip || req.socket.remoteAddress;
    return this.organisationService.create(dto, user.id, clientIp);
  }

  /**
   * 3. View Organisation details & statistics
   * GET /super-admin/organisations/:organisationId
   */
  @Get(':organisationId')
  @RequirePermissions('organizations.view')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('organisationId') organisationId: string) {
    return this.organisationService.findOne(organisationId);
  }

  @Get(':organisationId/slug-availability')
  @RequirePermissions('organizations.view')
  @HttpCode(HttpStatus.OK)
  async checkSlugAvailability(
    @Param('organisationId') organisationId: string,
    @Query('slug') slug: string,
  ) {
    return this.organisationService.checkSlugAvailability(organisationId, slug);
  }

  @Put(':organisationId/setup')
  @RequirePermissions('organizations.edit')
  @HttpCode(HttpStatus.OK)
  async updateSetup(
    @Param('organisationId') organisationId: string,
    @Body() dto: UpdateOrganisationSetupDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const clientIp = req.ip || req.socket.remoteAddress;
    return this.organisationService.updateSetup(
      organisationId,
      dto,
      user.id,
      clientIp,
    );
  }

  /**
   * 4. Update Organisation
   * PUT/PATCH /super-admin/organisations/:organisationId
   */
  @Put(':organisationId')
  @RequirePermissions('organizations.edit')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('organisationId') organisationId: string,
    @Body() dto: UpdateOrganisationDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const clientIp = req.ip || req.socket.remoteAddress;
    return this.organisationService.update(
      organisationId,
      dto,
      user.id,
      clientIp,
    );
  }

  @Patch(':organisationId')
  @RequirePermissions('organizations.edit')
  @HttpCode(HttpStatus.OK)
  async patchUpdate(
    @Param('organisationId') organisationId: string,
    @Body() dto: UpdateOrganisationDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const clientIp = req.ip || req.socket.remoteAddress;
    return this.organisationService.update(
      organisationId,
      dto,
      user.id,
      clientIp,
    );
  }

  /**
   * 5. Activate / Deactivate / Suspend Organisation
   * PATCH /super-admin/organisations/:organisationId/status
   */
  @Patch(':organisationId/status')
  @RequirePermissions('organizations.edit')
  @HttpCode(HttpStatus.OK)
  async updateStatus(
    @Param('organisationId') organisationId: string,
    @Body() dto: UpdateOrganisationStatusDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const clientIp = req.ip || req.socket.remoteAddress;
    return this.organisationService.updateStatus(
      organisationId,
      dto,
      user.id,
      clientIp,
    );
  }

  /**
   * 6. Delete Organisation (Soft Delete)
   * DELETE /super-admin/organisations/:organisationId
   */
  @Delete(':organisationId')
  @RequirePermissions('organizations.delete')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('organisationId') organisationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const clientIp = req.ip || req.socket.remoteAddress;
    return this.organisationService.remove(organisationId, user.id, clientIp);
  }
}

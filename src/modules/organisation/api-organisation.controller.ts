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
import { OrganisationService } from './core/organisation.service';
import { CreateOrganisationDto } from './dto/create-organisation.dto';
import { UpdateOrganisationDto } from './dto/update-organisation.dto';
import { UpdateOrganisationStatusDto } from './dto/update-organisation-status.dto';
import { QueryOrganisationDto } from './dto/query-organisation.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PermissionsGuard } from '../role-permission/guards/permissions.guard';
import { RequirePermissions } from '../role-permission/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import type { Request } from 'express';

@Controller('api/super-admin/organisations')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('SUPER_ADMIN', 'super-admin')
export class ApiOrganisationController {
  constructor(private readonly organisationService: OrganisationService) {}

  @Get()
  @RequirePermissions('organizations.view')
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: QueryOrganisationDto) {
    return this.organisationService.findAll(query);
  }

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

  @Get(':organisationId')
  @RequirePermissions('organizations.view')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('organisationId') organisationId: string) {
    return this.organisationService.findOne(organisationId);
  }

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

  @Delete(':organisationId')
  @RequirePermissions('organizations.delete')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('organisationId') organisationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const clientIp = req.ip || req.socket.remoteAddress;
    return this.organisationService.remove(
      organisationId,
      user.id,
      clientIp,
    );
  }
}

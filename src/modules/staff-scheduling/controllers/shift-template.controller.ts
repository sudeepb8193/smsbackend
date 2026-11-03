import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ShiftTemplateService } from '../services/shift-template.service';
import {
  CreateShiftTemplateDto,
  UpdateShiftTemplateDto,
  QueryShiftTemplateDto,
} from '../dto/shift-template.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../role-permission/guards/permissions.guard';
import { RequirePermissions } from '../../role-permission/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { SchedulingAccessHelper } from '../utils/scheduling-access.util';

@Controller('scheduling/templates')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ShiftTemplateController {
  constructor(private readonly shiftTemplateService: ShiftTemplateService) {}

  @Get()
  @RequirePermissions('staff_schedule.view')
  async getTemplates(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryShiftTemplateDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = SchedulingAccessHelper.resolveOrgId(user, queryOrgId || query.organizationId);
    return this.shiftTemplateService.getTemplates(orgId, query, user);
  }

  @Post()
  @RequirePermissions('staff_schedule.create')
  @HttpCode(HttpStatus.CREATED)
  async createTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateShiftTemplateDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = SchedulingAccessHelper.resolveOrgId(user, queryOrgId);
    return this.shiftTemplateService.createTemplate(orgId, dto, user);
  }

  @Get(':id')
  @RequirePermissions('staff_schedule.view')
  async getTemplateById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = SchedulingAccessHelper.resolveOrgId(user, queryOrgId);
    return this.shiftTemplateService.getTemplateById(orgId, id, user);
  }

  @Patch(':id')
  @RequirePermissions('staff_schedule.update')
  async updateTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateShiftTemplateDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = SchedulingAccessHelper.resolveOrgId(user, queryOrgId);
    return this.shiftTemplateService.updateTemplate(orgId, id, dto, user);
  }

  @Patch(':id/retire')
  @RequirePermissions('staff_schedule.update')
  async retireTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = SchedulingAccessHelper.resolveOrgId(user, queryOrgId);
    return this.shiftTemplateService.retireTemplate(orgId, id, user);
  }

  @Patch(':id/reactivate')
  @RequirePermissions('staff_schedule.update')
  async reactivateTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = SchedulingAccessHelper.resolveOrgId(user, queryOrgId);
    return this.shiftTemplateService.reactivateTemplate(orgId, id, user);
  }

  @Delete(':id')
  @RequirePermissions('staff_schedule.delete')
  async deleteTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = SchedulingAccessHelper.resolveOrgId(user, queryOrgId);
    return this.shiftTemplateService.deleteTemplate(orgId, id, user);
  }
}


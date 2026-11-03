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
  BadRequestException,
} from '@nestjs/common';
import { AvailabilityPreferenceService } from '../services/availability-preference.service';
import {
  CreateAvailabilityPreferenceDto,
  UpdateAvailabilityPreferenceDto,
  QueryAvailabilityPreferenceDto,
} from '../dto/availability-preference.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../role-permission/guards/permissions.guard';
import { RequirePermissions } from '../../role-permission/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { SchedulingAccessHelper } from '../utils/scheduling-access.util';

@Controller('scheduling/preferences')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AvailabilityPreferenceController {
  constructor(
    private readonly preferenceService: AvailabilityPreferenceService,
  ) {}

  @Get()
  @RequirePermissions('staff_schedule.view')
  async getPreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryAvailabilityPreferenceDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = SchedulingAccessHelper.resolveOrgId(user, queryOrgId || query.organizationId);
    return this.preferenceService.getPreferences(orgId, query, user);
  }

  @Post()
  @RequirePermissions('staff_schedule.create')
  @HttpCode(HttpStatus.CREATED)
  async createPreference(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAvailabilityPreferenceDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = SchedulingAccessHelper.resolveOrgId(user, queryOrgId);
    return this.preferenceService.createPreference(orgId, dto, user);
  }

  @Patch(':id')
  @RequirePermissions('staff_schedule.update')
  async updatePreference(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAvailabilityPreferenceDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = SchedulingAccessHelper.resolveOrgId(user, queryOrgId);
    return this.preferenceService.updatePreference(orgId, id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions('staff_schedule.update')
  async deletePreference(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = SchedulingAccessHelper.resolveOrgId(user, queryOrgId);
    return this.preferenceService.deletePreference(orgId, id, user);
  }

  @Get('check-conflict')
  @RequirePermissions('staff_schedule.view')
  async checkConflict(
    @Query('staffId') staffId: string,
    @Query('dayOfWeek') dayOfWeekStr: string,
    @Query('startTime') startTime: string,
    @Query('endTime') endTime: string,
  ) {
    if (!staffId || dayOfWeekStr === undefined || !startTime || !endTime) {
      throw new BadRequestException('staffId, dayOfWeek, startTime, and endTime are required');
    }
    const dayOfWeek = parseInt(dayOfWeekStr, 10);
    return this.preferenceService.checkSchedulingConflict(
      staffId,
      dayOfWeek,
      startTime,
      endTime,
    );
  }
}


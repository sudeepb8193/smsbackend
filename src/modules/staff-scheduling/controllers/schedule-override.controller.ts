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
import { ScheduleOverrideService } from '../services/schedule-override.service';
import {
  CreateScheduleOverrideDto,
  CreateShiftSwapDto,
  ReviewOverrideDto,
  QueryScheduleOverrideDto,
} from '../dto/schedule-override.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../role-permission/guards/permissions.guard';
import { RequirePermissions } from '../../role-permission/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { SchedulingAccessHelper } from '../utils/scheduling-access.util';

@Controller('scheduling/overrides')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ScheduleOverrideController {
  constructor(private readonly overrideService: ScheduleOverrideService) {}

  @Get()
  @RequirePermissions('staff_schedule.view')
  async getOverrides(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryScheduleOverrideDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = SchedulingAccessHelper.resolveOrgId(user, queryOrgId || query.organizationId);
    return this.overrideService.getOverrides(orgId, query, user);
  }

  @Post()
  @RequirePermissions('staff_schedule.create')
  @HttpCode(HttpStatus.CREATED)
  async createOverride(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateScheduleOverrideDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = SchedulingAccessHelper.resolveOrgId(user, queryOrgId);
    return this.overrideService.createOverride(orgId, dto, user);
  }

  @Post('swap')
  @RequirePermissions('staff_schedule.manage')
  @HttpCode(HttpStatus.OK)
  async createShiftSwap(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateShiftSwapDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = SchedulingAccessHelper.resolveOrgId(user, queryOrgId);
    return this.overrideService.createShiftSwap(orgId, dto, user);
  }

  @Patch(':id/review')
  @RequirePermissions('staff_schedule.approve')
  async reviewOverride(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewOverrideDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = SchedulingAccessHelper.resolveOrgId(user, queryOrgId);
    return this.overrideService.reviewOverride(orgId, id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions('staff_schedule.delete')
  async cancelOverride(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = SchedulingAccessHelper.resolveOrgId(user, queryOrgId);
    return this.overrideService.cancelOverride(orgId, id, user);
  }
}


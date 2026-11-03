import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { WeeklyScheduleService } from '../services/weekly-schedule.service';
import {
  SaveWeeklyScheduleDto,
  CopyWeeklyScheduleDto,
  QueryWeeklyScheduleDto,
} from '../dto/weekly-schedule.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../role-permission/guards/permissions.guard';
import { RequirePermissions } from '../../role-permission/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { SchedulingAccessHelper } from '../utils/scheduling-access.util';

@Controller('scheduling/weekly')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class WeeklyScheduleController {
  constructor(private readonly weeklyScheduleService: WeeklyScheduleService) {}

  @Post()
  @RequirePermissions('staff_schedule.create')
  @HttpCode(HttpStatus.OK)
  async saveWeeklySchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveWeeklyScheduleDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = SchedulingAccessHelper.resolveOrgId(user, queryOrgId);
    return this.weeklyScheduleService.saveWeeklySchedule(orgId, dto, user);
  }

  @Post('copy')
  @RequirePermissions('staff_schedule.create')
  @HttpCode(HttpStatus.OK)
  async copySchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CopyWeeklyScheduleDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = SchedulingAccessHelper.resolveOrgId(user, queryOrgId);
    return this.weeklyScheduleService.copySchedule(orgId, dto, user);
  }

  @Get('staff/:staffId')
  @RequirePermissions('staff_schedule.view')
  async getStaffSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('staffId') staffId: string,
    @Query('date') date?: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = SchedulingAccessHelper.resolveOrgId(user, queryOrgId);
    return this.weeklyScheduleService.getStaffWeeklySchedule(
      orgId,
      staffId,
      date,
      user,
    );
  }

  @Get('team')
  @RequirePermissions('staff_schedule.view')
  async getBranchTeamSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId: string,
    @Query('weekStartDate') weekStartDate: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    if (!branchId) {
      throw new BadRequestException('branchId query parameter is required');
    }
    const targetWeekStart = weekStartDate || new Date().toISOString().substring(0, 10);
    const orgId = SchedulingAccessHelper.resolveOrgId(user, queryOrgId);
    return this.weeklyScheduleService.getBranchTeamSchedule(
      orgId,
      branchId,
      targetWeekStart,
      user,
    );
  }
}


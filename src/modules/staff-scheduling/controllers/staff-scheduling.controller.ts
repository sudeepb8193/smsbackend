import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AvailabilityEngineService } from '../services/availability-engine.service';
import { StaffSchedulingOverviewService } from '../services/staff-scheduling-overview.service';
import {
  StaffAvailabilityQueryDto,
  BranchAvailabilityQueryDto,
} from '../dto/availability-query.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../role-permission/guards/permissions.guard';
import { RequirePermissions } from '../../role-permission/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { SchedulingAccessHelper } from '../utils/scheduling-access.util';

@Controller('scheduling')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class StaffSchedulingController {
  constructor(
    private readonly availabilityEngine: AvailabilityEngineService,
    private readonly overviewService: StaffSchedulingOverviewService,
  ) {}

  @Get('overview')
  @RequirePermissions('staff_schedule.view')
  async getOverview(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
    @Query('date') date?: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = SchedulingAccessHelper.resolveOrgId(user, queryOrgId);
    return this.overviewService.getOverviewMetrics(orgId, branchId, date, user);
  }

  @Get('availability/staff/:staffId')
  @RequirePermissions('staff_schedule.view')
  async getStaffAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Param('staffId') staffId: string,
    @Query() query: StaffAvailabilityQueryDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = SchedulingAccessHelper.resolveOrgId(user, queryOrgId || query.organizationId);
    return this.availabilityEngine.getStaffAvailability(
      orgId,
      staffId,
      query,
      user,
    );
  }

  @Get('availability/branch/:branchId')
  @RequirePermissions('staff_schedule.view')
  async getBranchAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Param('branchId') branchId: string,
    @Query() query: BranchAvailabilityQueryDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = SchedulingAccessHelper.resolveOrgId(user, queryOrgId || query.organizationId);
    return this.availabilityEngine.getBranchStaffAvailability(
      orgId,
      branchId,
      query,
      user,
    );
  }
}


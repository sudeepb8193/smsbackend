import {
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AttendanceSummaryService } from '../services/attendance-summary.service';
import { QueryAttendanceSummaryDto } from '../dto/query-summary.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../role-permission/guards/permissions.guard';
import { RequirePermissions } from '../../role-permission/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { AttendanceAccessHelper } from '../utils/attendance-access.util';

@Controller('attendance/summary')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AttendanceSummaryController {
  constructor(private readonly summaryService: AttendanceSummaryService) {}

  @Get('overview')
  @RequirePermissions('staff_attendance.view')
  async getOverviewMetrics(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
    @Query('date') date?: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = AttendanceAccessHelper.resolveOrgId(user, queryOrgId);
    return this.summaryService.getOverviewMetrics(user, orgId, branchId, date);
  }

  @Get('monthly')
  @RequirePermissions('staff_attendance.view')
  async getMonthlySummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryAttendanceSummaryDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = AttendanceAccessHelper.resolveOrgId(user, queryOrgId);
    return this.summaryService.getMonthlySummary(
      user,
      orgId,
      query.branchId || '',
      query.year,
      query.month,
    );
  }

  @Post('monthly/recalculate')
  @RequirePermissions('staff_attendance.manage')
  async recalculateMonthlySummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryAttendanceSummaryDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = AttendanceAccessHelper.resolveOrgId(user, queryOrgId);
    return this.summaryService.recalculateMonthlySummary(
      user,
      orgId,
      query.branchId || '',
      query.year,
      query.month,
    );
  }

  @Get('monthly/export')
  @RequirePermissions('staff_attendance.export')
  async exportMonthlySummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryAttendanceSummaryDto,
    @Query('organizationId') queryOrgId?: string,
    @Res() res?: Response,
  ) {
    const orgId = AttendanceAccessHelper.resolveOrgId(user, queryOrgId);
    const csvContent = await this.summaryService.exportSummaryCsv(
      user,
      orgId,
      query.branchId || '',
      query.year,
      query.month,
    );

    if (res) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="attendance-summary-${query.year}-${String(query.month).padStart(2, '0')}.csv"`,
      );
      return res.send(csvContent);
    }

    return { csv: csvContent };
  }
}

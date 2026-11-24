import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../role-permission/guards/permissions.guard';
import { RequirePermissions } from '../../role-permission/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { LeaveReportService } from '../services/leave-report.service';
import { QueryLeaveReportDto } from '../dto/query-leave-report.dto';

@Controller('leave/reports')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class LeaveReportController {
  constructor(private readonly reportService: LeaveReportService) {}

  @Get('summary')
  @RequirePermissions('staff_leave.view')
  async getLeaveUsageSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryLeaveReportDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    return this.reportService.getLeaveUsageSummary(user, query, queryOrgId);
  }

  @Get('export-csv')
  @RequirePermissions('staff_leave.export')
  async exportLeaveCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryLeaveReportDto,
    @Res() res: Response,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const csvContent = await this.reportService.generateLeaveCsv(user, query, queryOrgId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="staff_leave_report_${query.year || new Date().getFullYear()}.csv"`,
    );
    res.send(csvContent);
  }
}

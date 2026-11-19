import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AttendanceApprovalService } from '../services/attendance-approval.service';
import { ApproveAttendancePeriodDto } from '../dto/period-approval.dto';
import { ReopenAttendancePeriodDto } from '../dto/reopen-period.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../role-permission/guards/permissions.guard';
import { RequirePermissions } from '../../role-permission/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { AttendanceAccessHelper } from '../utils/attendance-access.util';

@Controller('attendance/approvals')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AttendanceApprovalController {
  constructor(private readonly approvalService: AttendanceApprovalService) {}

  @Get('period-review')
  @RequirePermissions('staff_attendance.view')
  async getPeriodReview(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId: string,
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = AttendanceAccessHelper.resolveOrgId(user, queryOrgId);
    return this.approvalService.getPeriodReview(
      user,
      orgId,
      branchId,
      periodStart,
      periodEnd,
    );
  }

  @Post('period/approve')
  @RequirePermissions('staff_attendance.approve')
  async approvePeriod(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ApproveAttendancePeriodDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    return this.approvalService.approvePeriod(user, dto, queryOrgId);
  }

  @Post('period/approve-all-clean')
  @RequirePermissions('staff_attendance.approve')
  async approveAllClean(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId: string,
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = AttendanceAccessHelper.resolveOrgId(user, queryOrgId);
    return this.approvalService.approveAllClean(
      user,
      orgId,
      branchId,
      periodStart,
      periodEnd,
    );
  }

  @Post('period/:id/reopen')
  @RequirePermissions('staff_attendance.reject')
  async reopenPeriod(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReopenAttendancePeriodDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    return this.approvalService.reopenPeriod(user, id, dto, queryOrgId);
  }

  /**
   * Financial-integrity gate for Module 38 Payroll
   */
  @Get('payroll-ready')
  @RequirePermissions('staff_attendance.view')
  async getPayrollReadyAttendance(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId: string,
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = AttendanceAccessHelper.resolveOrgId(user, queryOrgId);
    return this.approvalService.getPayrollReadyAttendance(
      user,
      orgId,
      branchId,
      periodStart,
      periodEnd,
    );
  }
}

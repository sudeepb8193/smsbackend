import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../role-permission/guards/permissions.guard';
import { RequirePermissions } from '../../role-permission/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { LeaveApprovalService } from '../services/leave-approval.service';
import { ReviewLeaveDto } from '../dto/review-leave.dto';
import { QueryApprovalQueueDto } from '../dto/query-approvals.dto';

@Controller('leave/approvals')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class LeaveApprovalController {
  constructor(private readonly leaveApprovalService: LeaveApprovalService) {}

  @Get('pending')
  @RequirePermissions('staff_leave.approve')
  async getPendingApprovalQueue(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryApprovalQueueDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    return this.leaveApprovalService.getPendingApprovalQueue(user, query, queryOrgId);
  }

  @Post(':id/approve')
  @RequirePermissions('staff_leave.approve')
  async approveLeaveRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewLeaveDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    return this.leaveApprovalService.approveLeaveRequest(user, id, dto, queryOrgId);
  }

  @Post(':id/reject')
  @RequirePermissions('staff_leave.reject')
  async rejectLeaveRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewLeaveDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    return this.leaveApprovalService.rejectLeaveRequest(user, id, dto, queryOrgId);
  }

  @Post(':id/review')
  @RequirePermissions('staff_leave.approve')
  async reviewLeaveRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewLeaveDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    if (dto.action === 'reject') {
      return this.leaveApprovalService.rejectLeaveRequest(user, id, dto, queryOrgId);
    }
    return this.leaveApprovalService.approveLeaveRequest(user, id, dto, queryOrgId);
  }

  @Get(':id/history')
  @RequirePermissions('staff_leave.view')
  async getApprovalHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    return this.leaveApprovalService.getApprovalHistory(user, id, queryOrgId);
  }
}

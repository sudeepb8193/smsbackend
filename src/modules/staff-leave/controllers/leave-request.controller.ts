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
import { LeaveRequestService } from '../services/leave-request.service';
import { ApplyLeaveDto } from '../dto/apply-leave.dto';
import { CancelLeaveDto } from '../dto/cancel-leave.dto';
import { QueryLeaveRequestDto } from '../dto/query-leave-request.dto';

@Controller('leave/requests')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class LeaveRequestController {
  constructor(private readonly leaveRequestService: LeaveRequestService) {}

  @Post()
  @RequirePermissions('staff_leave.create')
  async applyForLeave(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ApplyLeaveDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    return this.leaveRequestService.applyForLeave(user, dto, queryOrgId);
  }

  @Get('my-requests')
  @RequirePermissions('staff_leave.view')
  async getMyRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryLeaveRequestDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    return this.leaveRequestService.getMyRequests(user, query, queryOrgId);
  }

  @Get()
  @RequirePermissions('staff_leave.view')
  async listLeaveRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryLeaveRequestDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    return this.leaveRequestService.listLeaveRequests(user, query, queryOrgId);
  }

  @Get(':id')
  @RequirePermissions('staff_leave.view')
  async getLeaveRequestById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    return this.leaveRequestService.getLeaveRequestById(user, id, queryOrgId);
  }

  @Post(':id/cancel')
  @RequirePermissions('staff_leave.update')
  async cancelLeaveRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CancelLeaveDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    return this.leaveRequestService.cancelLeaveRequest(user, id, dto, queryOrgId);
  }
}

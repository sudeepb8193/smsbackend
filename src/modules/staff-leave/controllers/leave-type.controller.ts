import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
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
import { LeaveTypeService } from '../services/leave-type.service';
import { CreateLeaveTypeDto } from '../dto/create-leave-type.dto';
import { UpdateLeaveTypeDto } from '../dto/update-leave-type.dto';
import { QueryLeaveTypeDto } from '../dto/query-leave-type.dto';
import { sms_activeInactive } from '@prisma/client';

@Controller('leave/types')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class LeaveTypeController {
  constructor(private readonly leaveTypeService: LeaveTypeService) {}

  @Post()
  @RequirePermissions('staff_leave.manage')
  async createLeaveType(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLeaveTypeDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    return this.leaveTypeService.createLeaveType(user, dto, queryOrgId);
  }

  @Get()
  @RequirePermissions('staff_leave.view')
  async listLeaveTypes(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryLeaveTypeDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    return this.leaveTypeService.listLeaveTypes(user, query, queryOrgId);
  }

  @Post('seed-defaults')
  @RequirePermissions('staff_leave.manage')
  async seedDefaults(
    @CurrentUser() user: AuthenticatedUser,
    @Query('organizationId') queryOrgId?: string,
  ) {
    return this.leaveTypeService.seedDefaultLeaveTypes(user, queryOrgId);
  }

  @Get(':id')
  @RequirePermissions('staff_leave.view')
  async getLeaveTypeById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    return this.leaveTypeService.getLeaveTypeById(user, id, queryOrgId);
  }

  @Patch(':id')
  @RequirePermissions('staff_leave.manage')
  async patchLeaveType(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateLeaveTypeDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    return this.leaveTypeService.updateLeaveType(user, id, dto, queryOrgId);
  }

  @Put(':id')
  @RequirePermissions('staff_leave.manage')
  async updateLeaveType(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateLeaveTypeDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    return this.leaveTypeService.updateLeaveType(user, id, dto, queryOrgId);
  }

  @Patch(':id/status')
  @RequirePermissions('staff_leave.manage')
  async setStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: any,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const status: sms_activeInactive =
      body?.status || (body?.isActive ? 'active' : 'inactive');
    return this.leaveTypeService.setLeaveTypeStatus(user, id, status, queryOrgId);
  }
}

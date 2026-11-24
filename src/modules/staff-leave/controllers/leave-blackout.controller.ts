import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
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
import { LeaveBlackoutService } from '../services/leave-blackout.service';
import { CreateBlackoutPeriodDto } from '../dto/create-blackout.dto';
import { UpdateBlackoutPeriodDto } from '../dto/update-blackout.dto';
import { QueryBlackoutPeriodDto } from '../dto/query-blackout.dto';

@Controller('leave/blackout')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class LeaveBlackoutController {
  constructor(private readonly blackoutService: LeaveBlackoutService) {}

  @Post()
  @RequirePermissions('staff_leave.manage')
  async createBlackoutPeriod(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBlackoutPeriodDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    return this.blackoutService.createBlackoutPeriod(user, dto, queryOrgId);
  }

  @Get()
  @RequirePermissions('staff_leave.view')
  async listBlackoutPeriods(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryBlackoutPeriodDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    return this.blackoutService.listBlackoutPeriods(user, query, queryOrgId);
  }

  @Put(':id')
  @RequirePermissions('staff_leave.manage')
  async updateBlackoutPeriod(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateBlackoutPeriodDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    return this.blackoutService.updateBlackoutPeriod(user, id, dto, queryOrgId);
  }

  @Delete(':id')
  @RequirePermissions('staff_leave.manage')
  async deleteBlackoutPeriod(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    return this.blackoutService.deleteBlackoutPeriod(user, id, queryOrgId);
  }
}

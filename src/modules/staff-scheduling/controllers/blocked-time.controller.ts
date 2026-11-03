import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BlockedTimeService } from '../services/blocked-time.service';
import {
  CreateBlockedTimeDto,
  BulkCreateBlockedTimeDto,
  QueryBlockedTimeDto,
} from '../dto/blocked-time.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../role-permission/guards/permissions.guard';
import { RequirePermissions } from '../../role-permission/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { SchedulingAccessHelper } from '../utils/scheduling-access.util';

@Controller('scheduling/blocked-time')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class BlockedTimeController {
  constructor(private readonly blockedTimeService: BlockedTimeService) {}

  @Get()
  @RequirePermissions('staff_schedule.view')
  async getBlockedTimes(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryBlockedTimeDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = SchedulingAccessHelper.resolveOrgId(user, queryOrgId || query.organizationId);
    return this.blockedTimeService.getBlockedTimes(orgId, query, user);
  }

  @Post()
  @RequirePermissions('staff_schedule.create')
  @HttpCode(HttpStatus.CREATED)
  async createBlockedTime(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBlockedTimeDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = SchedulingAccessHelper.resolveOrgId(user, queryOrgId);
    return this.blockedTimeService.createBlockedTime(orgId, dto, user);
  }

  @Post('bulk')
  @RequirePermissions('staff_schedule.create')
  @HttpCode(HttpStatus.CREATED)
  async bulkCreateBlockedTime(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BulkCreateBlockedTimeDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = SchedulingAccessHelper.resolveOrgId(user, queryOrgId);
    return this.blockedTimeService.bulkCreateBlockedTime(orgId, dto, user);
  }

  @Delete(':id')
  @RequirePermissions('staff_schedule.delete')
  async cancelBlockedTime(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = SchedulingAccessHelper.resolveOrgId(user, queryOrgId);
    return this.blockedTimeService.cancelBlockedTime(orgId, id, user);
  }
}


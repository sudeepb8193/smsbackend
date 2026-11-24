import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../role-permission/guards/permissions.guard';
import { RequirePermissions } from '../../role-permission/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { LeaveCalendarService } from '../services/leave-calendar.service';
import { QueryCalendarDto } from '../dto/query-calendar.dto';

@Controller('leave/calendar')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class LeaveCalendarController {
  constructor(private readonly calendarService: LeaveCalendarService) {}

  @Get()
  @RequirePermissions('staff_leave.view')
  async getCalendarEvents(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryCalendarDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    return this.calendarService.getCalendarEvents(user, query, queryOrgId);
  }
}

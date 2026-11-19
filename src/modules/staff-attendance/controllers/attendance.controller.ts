import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AttendanceService } from '../services/attendance.service';
import { CheckInDto } from '../dto/check-in.dto';
import { CheckOutDto } from '../dto/check-out.dto';
import { ManualAttendanceEntryDto } from '../dto/manual-attendance.dto';
import { KioskPunchDto } from '../dto/kiosk-punch.dto';
import { QueryAttendanceDto } from '../dto/query-attendance.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../role-permission/guards/permissions.guard';
import { RequirePermissions } from '../../role-permission/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { AttendanceAccessHelper } from '../utils/attendance-access.util';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('check-in')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions('staff_attendance.create')
  async checkIn(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CheckInDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    return this.attendanceService.checkIn(user, dto, queryOrgId);
  }

  @Post('check-out')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions('staff_attendance.update')
  async checkOut(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CheckOutDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    return this.attendanceService.checkOut(user, dto, queryOrgId);
  }

  @Post('kiosk/punch')
  async kioskPunch(@Body() dto: KioskPunchDto, @Req() req: any) {
    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress;
    return this.attendanceService.kioskPunch(dto, clientIp);
  }

  @Post('manual')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions('staff_attendance.create')
  async manualEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ManualAttendanceEntryDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    return this.attendanceService.manualAttendanceEntry(user, dto, queryOrgId);
  }

  @Get('daily')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions('staff_attendance.view')
  async getDailyAttendance(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryAttendanceDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = AttendanceAccessHelper.resolveOrgId(user, queryOrgId);
    return this.attendanceService.getDailyAttendance(user, orgId, query);
  }

  @Get('currently-checked-in')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions('staff_attendance.view')
  async getCurrentlyCheckedIn(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = AttendanceAccessHelper.resolveOrgId(user, queryOrgId);
    return this.attendanceService.getCurrentlyCheckedIn(user, orgId, branchId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions('staff_attendance.view')
  async getMyAttendance(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryAttendanceDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = AttendanceAccessHelper.resolveOrgId(user, queryOrgId);
    return this.attendanceService.getMyAttendance(user, orgId, query);
  }
}

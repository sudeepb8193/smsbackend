import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AttendanceCorrectionService } from '../services/attendance-correction.service';
import { SubmitAttendanceCorrectionDto } from '../dto/correction-request.dto';
import { ReviewAttendanceCorrectionDto } from '../dto/review-correction.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../role-permission/guards/permissions.guard';
import { RequirePermissions } from '../../role-permission/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { AttendanceAccessHelper } from '../utils/attendance-access.util';

@Controller('attendance/corrections')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AttendanceCorrectionController {
  constructor(private readonly correctionService: AttendanceCorrectionService) {}

  @Post('request')
  @RequirePermissions('staff_attendance.update')
  async submitCorrection(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitAttendanceCorrectionDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    return this.correctionService.submitCorrection(user, dto, queryOrgId);
  }

  @Get('pending')
  @RequirePermissions('staff_attendance.view')
  async getPendingCorrections(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = AttendanceAccessHelper.resolveOrgId(user, queryOrgId);
    return this.correctionService.getPendingCorrections(user, orgId, branchId, {
      search,
      page,
      limit,
    });
  }

  @Get('my')
  @RequirePermissions('staff_attendance.view')
  async getMyCorrections(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = AttendanceAccessHelper.resolveOrgId(user, queryOrgId);
    return this.correctionService.getMyCorrections(user, orgId, { page, limit });
  }

  @Patch(':id/approve')
  @RequirePermissions('staff_attendance.approve')
  async approveCorrection(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewAttendanceCorrectionDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    return this.correctionService.approveCorrection(user, id, dto, queryOrgId);
  }

  @Patch(':id/reject')
  @RequirePermissions('staff_attendance.reject')
  async rejectCorrection(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewAttendanceCorrectionDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    return this.correctionService.rejectCorrection(user, id, dto, queryOrgId);
  }
}

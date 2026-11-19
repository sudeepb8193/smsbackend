import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AttendancePolicyService } from '../services/attendance-policy.service';
import { SaveAttendancePolicyDto } from '../dto/attendance-policy.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../role-permission/guards/permissions.guard';
import { RequirePermissions } from '../../role-permission/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { AttendanceAccessHelper } from '../utils/attendance-access.util';

@Controller('attendance/policies')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AttendancePolicyController {
  constructor(private readonly policyService: AttendancePolicyService) {}

  @Get('effective')
  @RequirePermissions('staff_attendance.view')
  async getEffectivePolicy(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = AttendanceAccessHelper.resolveOrgId(user, queryOrgId);
    return this.policyService.getEffectivePolicy(orgId, branchId);
  }

  @Post('organization')
  @RequirePermissions('staff_attendance.manage')
  async saveOrganizationPolicy(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveAttendancePolicyDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = AttendanceAccessHelper.resolveOrgId(user, queryOrgId);
    return this.policyService.saveOrganizationPolicy(orgId, dto, user);
  }

  @Post('branch/:branchId')
  @RequirePermissions('staff_attendance.manage')
  async saveBranchPolicy(
    @CurrentUser() user: AuthenticatedUser,
    @Param('branchId') branchId: string,
    @Body() dto: SaveAttendancePolicyDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = AttendanceAccessHelper.resolveOrgId(user, queryOrgId);
    return this.policyService.saveBranchPolicy(orgId, branchId, dto, user);
  }

  @Delete('branch/:branchId')
  @RequirePermissions('staff_attendance.manage')
  async deleteBranchPolicy(
    @CurrentUser() user: AuthenticatedUser,
    @Param('branchId') branchId: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = AttendanceAccessHelper.resolveOrgId(user, queryOrgId);
    return this.policyService.deleteBranchPolicy(orgId, branchId, user);
  }
}

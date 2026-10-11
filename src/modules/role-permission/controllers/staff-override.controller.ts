import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { StaffOverrideService } from '../services/staff-override.service';
import { EffectivePermissionResolverService } from '../services/effective-permission-resolver.service';
import { CreateStaffOverrideDto } from '../dto/create-staff-override.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import type { Request } from 'express';

@Controller('api/staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'super-admin')
export class StaffOverrideController {
  constructor(
    private readonly staffOverrideService: StaffOverrideService,
    private readonly permissionResolver: EffectivePermissionResolverService,
  ) {}

  /**
   * List overrides for a staff member (Super Admin only)
   */
  @Get(':staffId/overrides')
  @Roles('SUPER_ADMIN', 'super-admin')
  @HttpCode(HttpStatus.OK)
  async getStaffOverrides(
    @Param('staffId') staffId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.staffOverrideService.getStaffOverrides(
      staffId,
      user.organizationId,
      false,
    );
  }

  /**
   * Create staff permission override (Super Admin only)
   */
  @Post(':staffId/overrides')
  @Roles('SUPER_ADMIN', 'super-admin')
  @HttpCode(HttpStatus.CREATED)
  async createOverride(
    @Param('staffId') staffId: string,
    @Body() dto: CreateStaffOverrideDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const clientIp = req.ip || req.socket?.remoteAddress;
    return this.staffOverrideService.createOverride(
      staffId,
      dto,
      user.id,
      user.organizationId,
      false,
      clientIp,
    );
  }

  /**
   * Remove staff permission override (Super Admin only)
   */
  @Delete(':staffId/overrides/:overrideId')
  @Roles('SUPER_ADMIN', 'super-admin')
  @HttpCode(HttpStatus.OK)
  async removeOverride(
    @Param('staffId') staffId: string,
    @Param('overrideId') overrideId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const clientIp = req.ip || req.socket?.remoteAddress;
    return this.staffOverrideService.removeOverride(
      staffId,
      overrideId,
      user.id,
      user.organizationId,
      false,
      clientIp,
    );
  }

  /**
   * Preview effective permissions summary for staff member's linked user (Super Admin only)
   */
  @Get(':staffId/effective-permissions')
  @Roles('SUPER_ADMIN', 'super-admin')
  @HttpCode(HttpStatus.OK)
  async getStaffEffectivePermissions(
    @Param('staffId') staffId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const overridesData = await this.staffOverrideService.getStaffOverrides(
      staffId,
      user.organizationId,
      false,
    );

    let effectivePermissions: any[] = [];
    if (overridesData.linkedUser?.id) {
      effectivePermissions = await this.permissionResolver.getEffectivePermissionsSummary(
        overridesData.linkedUser.id,
        user.organizationId,
      );
    }

    return {
      staffId,
      employeeCode: overridesData.employeeCode,
      fullName: overridesData.fullName,
      linkedUser: overridesData.linkedUser,
      homeBranch: overridesData.homeBranch,
      effectivePermissions,
      overrides: overridesData.overrides,
    };
  }
}

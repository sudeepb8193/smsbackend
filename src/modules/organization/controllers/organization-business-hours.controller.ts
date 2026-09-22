import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OrganizationBusinessHoursService } from '../services/organization-business-hours.service';
import { UpdateBusinessHoursDto } from '../dto/update-business-hours.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@Controller('organizations/me')
export class OrganizationBusinessHoursController {
  constructor(
    private readonly businessHoursService: OrganizationBusinessHoursService,
  ) {}

  /**
   * Get Organization Default Business Hours (Super Admin, Branch Manager, Accountant)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    'SUPER_ADMIN',
    'BRANCH_MANAGER',
    'ACCOUNTANT',
    'super-admin',
    'branch-manager',
    'accountant',
  )
  @Get('business-hours')
  @HttpCode(HttpStatus.OK)
  async getOrganizationBusinessHours(@CurrentUser() user: AuthenticatedUser) {
    return this.businessHoursService.getBusinessHours(
      user.organizationId,
      null,
    );
  }

  /**
   * Update Organization Default Business Hours (Super Admin)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'super-admin')
  @Put('business-hours')
  @HttpCode(HttpStatus.OK)
  async updateOrganizationBusinessHours(
    @Body() dto: UpdateBusinessHoursDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.businessHoursService.updateBusinessHours(
      user.organizationId,
      null,
      dto,
    );
  }

  /**
   * Get Branch-Specific Business Hours (Super Admin, Branch Manager, Accountant)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    'SUPER_ADMIN',
    'BRANCH_MANAGER',
    'ACCOUNTANT',
    'super-admin',
    'branch-manager',
    'accountant',
  )
  @Get('branches/:branchId/business-hours')
  @HttpCode(HttpStatus.OK)
  async getBranchBusinessHours(
    @Param('branchId') branchId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.businessHoursService.getBusinessHours(
      user.organizationId,
      branchId,
    );
  }

  /**
   * Update Branch-Specific Business Hours (Super Admin, Branch Manager)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'super-admin', 'branch-manager')
  @Put('branches/:branchId/business-hours')
  @HttpCode(HttpStatus.OK)
  async updateBranchBusinessHours(
    @Param('branchId') branchId: string,
    @Body() dto: UpdateBusinessHoursDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.businessHoursService.updateBusinessHours(
      user.organizationId,
      branchId,
      dto,
    );
  }
}

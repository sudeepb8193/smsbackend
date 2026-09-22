import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OrganizationHolidayService } from '../services/organization-holiday.service';
import { CreateHolidayDto } from '../dto/create-holiday.dto';
import { UpdateHolidayDto } from '../dto/update-holiday.dto';
import { QueryHolidayDto } from '../dto/query-holiday.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@Controller('organizations/me')
export class OrganizationHolidayController {
  constructor(private readonly holidayService: OrganizationHolidayService) {}

  /**
   * Create Organization-wide Holiday (Super Admin)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'super-admin')
  @Post('holidays')
  @HttpCode(HttpStatus.CREATED)
  async createOrgHoliday(
    @Body() dto: CreateHolidayDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.holidayService.createHoliday(user.organizationId, user.id, {
      ...dto,
      branchId: undefined,
    });
  }

  /**
   * List Organization Holidays (Super Admin, Branch Manager, Accountant)
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
  @Get('holidays')
  @HttpCode(HttpStatus.OK)
  async getOrgHolidays(
    @Query() query: QueryHolidayDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.holidayService.getHolidays(user.organizationId, query);
  }

  /**
   * Create Branch-Specific Holiday (Super Admin, Branch Manager)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'super-admin', 'branch-manager')
  @Post('branches/:branchId/holidays')
  @HttpCode(HttpStatus.CREATED)
  async createBranchHoliday(
    @Param('branchId') branchId: string,
    @Body() dto: CreateHolidayDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.holidayService.createHoliday(user.organizationId, user.id, {
      ...dto,
      branchId,
    });
  }

  /**
   * List Branch-Specific Holidays (Super Admin, Branch Manager, Accountant)
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
  @Get('branches/:branchId/holidays')
  @HttpCode(HttpStatus.OK)
  async getBranchHolidays(
    @Param('branchId') branchId: string,
    @Query() query: QueryHolidayDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.holidayService.getHolidays(user.organizationId, {
      ...query,
      branchId,
    });
  }

  /**
   * Get Single Holiday Details (Super Admin, Branch Manager, Accountant)
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
  @Get('holidays/:id')
  @HttpCode(HttpStatus.OK)
  async getHolidayById(
    @Param('id') holidayId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.holidayService.getHolidayById(user.organizationId, holidayId);
  }

  /**
   * Update Holiday Details (Super Admin, Branch Manager)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'super-admin', 'branch-manager')
  @Patch('holidays/:id')
  @HttpCode(HttpStatus.OK)
  async updateHoliday(
    @Param('id') holidayId: string,
    @Body() dto: UpdateHolidayDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.holidayService.updateHoliday(
      user.organizationId,
      holidayId,
      dto,
    );
  }

  /**
   * Cancel Holiday Status (Super Admin, Branch Manager)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'super-admin', 'branch-manager')
  @Patch('holidays/:id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelHoliday(
    @Param('id') holidayId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.holidayService.cancelHoliday(user.organizationId, holidayId);
  }

  /**
   * Soft Delete Holiday Record (Super Admin)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'super-admin')
  @Delete('holidays/:id')
  @HttpCode(HttpStatus.OK)
  async deleteHoliday(
    @Param('id') holidayId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.holidayService.deleteHoliday(user.organizationId, holidayId);
  }
}

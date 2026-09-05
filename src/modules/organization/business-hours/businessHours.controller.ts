import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { BusinessHoursService } from './businessHours.service';
import {
  UpdateWeeklyHoursDto,
  CopyDayScheduleDto,
} from './dto/update-business-hours.dto';

@Controller('organizations/:organizationId/business-hours')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BusinessHoursController {
  constructor(private readonly businessHoursService: BusinessHoursService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.BRANCH_MANAGER, Role.ACCOUNTANT)
  async getWeeklyHours(
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Query('branchId') branchId?: string,
  ) {
    const branchIdNum = branchId ? parseInt(branchId, 10) : undefined;
    return this.businessHoursService.getWeeklyHours(organizationId, branchIdNum);
  }

  @Get('effective')
  @Roles(Role.SUPER_ADMIN, Role.BRANCH_MANAGER, Role.ACCOUNTANT)
  async getEffectiveBusinessHours(
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Query('dayOfWeek', ParseIntPipe) dayOfWeek: number,
    @Query('branchId') branchId?: string,
  ) {
    const branchIdNum = branchId ? parseInt(branchId, 10) : null;
    return this.businessHoursService.getEffectiveBusinessHours(
      organizationId,
      branchIdNum,
      dayOfWeek,
    );
  }

  @Put()
  @Roles(Role.SUPER_ADMIN)
  async updateWeeklyHours(
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Body() dto: UpdateWeeklyHoursDto,
  ) {
    return this.businessHoursService.updateWeeklyHours(organizationId, dto);
  }

  @Post('copy-day')
  @Roles(Role.SUPER_ADMIN)
  async copyDaySchedule(
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Body() dto: CopyDayScheduleDto,
  ) {
    return this.businessHoursService.copyDaySchedule(organizationId, dto);
  }

  @Delete('branch-override/:branchId')
  @Roles(Role.SUPER_ADMIN)
  async resetBranchOverride(
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Param('branchId', ParseIntPipe) branchId: number,
  ) {
    return this.businessHoursService.resetBranchOverride(organizationId, branchId);
  }
}

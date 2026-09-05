import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { HolidayService } from './holiday.service';
import { CreateHolidayDto, UpdateHolidayDto, OverrideYearHolidayDto } from './dto/create-holiday.dto';

@Controller('organizations/:organizationId/holidays')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HolidayController {
  constructor(private readonly holidayService: HolidayService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.BRANCH_MANAGER, Role.ACCOUNTANT)
  async findByOrganization(
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Query('branchId') branchId?: string,
  ) {
    const branchIdNum = branchId ? parseInt(branchId, 10) : undefined;
    return this.holidayService.findByOrganization(organizationId, branchIdNum);
  }

  @Get('check-date')
  @Roles(Role.SUPER_ADMIN, Role.BRANCH_MANAGER, Role.ACCOUNTANT)
  async checkDate(
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Query('date') date: string,
    @Query('branchId') branchId?: string,
  ) {
    const branchIdNum = branchId ? parseInt(branchId, 10) : null;
    return this.holidayService.isHoliday(organizationId, branchIdNum, date);
  }

  @Get('effective')
  @Roles(Role.SUPER_ADMIN, Role.BRANCH_MANAGER, Role.ACCOUNTANT)
  async getEffectiveHolidays(
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('branchId') branchId?: string,
  ) {
    const branchIdNum = branchId ? parseInt(branchId, 10) : null;
    return this.holidayService.getEffectiveHolidays(
      organizationId,
      branchIdNum,
      startDate,
      endDate,
    );
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.BRANCH_MANAGER)
  async create(
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Body() dto: CreateHolidayDto,
    @CurrentUser('id') userId?: number,
  ) {
    return this.holidayService.createHoliday(organizationId, dto, userId);
  }

  @Patch(':holidayId')
  @Roles(Role.SUPER_ADMIN, Role.BRANCH_MANAGER)
  async update(
    @Param('holidayId', ParseIntPipe) holidayId: number,
    @Body() dto: UpdateHolidayDto,
  ) {
    return this.holidayService.updateHoliday(holidayId, dto);
  }

  @Post(':holidayId/cancel')
  @Roles(Role.SUPER_ADMIN, Role.BRANCH_MANAGER)
  async cancel(@Param('holidayId', ParseIntPipe) holidayId: number) {
    return this.holidayService.cancelHoliday(holidayId);
  }

  @Post(':holidayId/override-year')
  @Roles(Role.SUPER_ADMIN, Role.BRANCH_MANAGER)
  async overrideYear(
    @Param('holidayId', ParseIntPipe) holidayId: number,
    @Body() dto: OverrideYearHolidayDto,
  ) {
    return this.holidayService.overrideYear(
      holidayId,
      dto.year,
      dto.isCancelled !== undefined ? dto.isCancelled : true,
    );
  }
}

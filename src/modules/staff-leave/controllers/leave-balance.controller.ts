import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../role-permission/guards/permissions.guard';
import { RequirePermissions } from '../../role-permission/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { LeaveBalanceService } from '../services/leave-balance.service';
import { LeaveAccrualService } from '../services/leave-accrual.service';
import { InitializeBalanceDto } from '../dto/initialize-balance.dto';
import { AdjustBalanceDto } from '../dto/adjust-balance.dto';
import { QueryBalanceDto } from '../dto/query-balance.dto';
import { ProcessAccrualDto } from '../dto/process-accrual.dto';
import { ProcessCarryForwardDto } from '../dto/process-carry-forward.dto';

@Controller('leave/balances')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class LeaveBalanceController {
  constructor(
    private readonly balanceService: LeaveBalanceService,
    private readonly accrualService: LeaveAccrualService,
  ) {}

  @Get()
  @RequirePermissions('staff_leave.view')
  async listStaffBalances(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryBalanceDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    return this.balanceService.listStaffBalances(user, query, queryOrgId);
  }

  @Get('my-balances')
  @RequirePermissions('staff_leave.view')
  async getMyBalances(
    @CurrentUser() user: AuthenticatedUser,
    @Query('year') year?: number,
    @Query('organizationId') queryOrgId?: string,
  ) {
    return this.balanceService.getMyBalances(user, year ? Number(year) : undefined, queryOrgId);
  }

  @Post('initialize')
  @RequirePermissions('staff_leave.manage')
  async initializeStaffBalances(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InitializeBalanceDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    return this.balanceService.initializeStaffBalances(user, dto, queryOrgId);
  }

  @Post('adjust')
  @RequirePermissions('staff_leave.manage')
  async adjustStaffBalance(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AdjustBalanceDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    return this.balanceService.adjustStaffBalance(user, dto, queryOrgId);
  }

  @Post('process-monthly-accrual')
  @RequirePermissions('staff_leave.manage')
  async processMonthlyAccrual(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ProcessAccrualDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    return this.accrualService.processMonthlyAccrual(user, dto, queryOrgId);
  }

  @Post('process-year-end-carry-forward')
  @RequirePermissions('staff_leave.manage')
  async processYearEndCarryForward(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ProcessCarryForwardDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    return this.accrualService.processYearEndCarryForward(user, dto, queryOrgId);
  }

  @Get('transactions')
  @RequirePermissions('staff_leave.view')
  async getBalanceTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('staffId') staffId?: string,
    @Query('leaveTypeId') leaveTypeId?: string,
    @Query('year') year?: number,
    @Query('organizationId') queryOrgId?: string,
  ) {
    return this.balanceService.getBalanceTransactions(
      user,
      { staffId, leaveTypeId, year: year ? Number(year) : undefined },
      queryOrgId,
    );
  }
}

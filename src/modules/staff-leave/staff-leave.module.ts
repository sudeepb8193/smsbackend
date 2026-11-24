import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';

// Controllers
import { LeaveTypeController } from './controllers/leave-type.controller';
import { LeaveBalanceController } from './controllers/leave-balance.controller';
import { LeaveRequestController } from './controllers/leave-request.controller';
import { LeaveApprovalController } from './controllers/leave-approval.controller';
import { LeaveCalendarController } from './controllers/leave-calendar.controller';
import { LeaveBlackoutController } from './controllers/leave-blackout.controller';
import { LeaveReportController } from './controllers/leave-report.controller';

// Services
import { LeaveTypeService } from './services/leave-type.service';
import { LeaveBalanceService } from './services/leave-balance.service';
import { LeaveAccrualService } from './services/leave-accrual.service';
import { LeaveRequestService } from './services/leave-request.service';
import { LeaveApprovalService } from './services/leave-approval.service';
import { LeaveCalendarService } from './services/leave-calendar.service';
import { LeaveBlackoutService } from './services/leave-blackout.service';
import { LeaveReportService } from './services/leave-report.service';
import { LeaveNotificationService } from './services/leave-notification.service';

@Module({
  imports: [PrismaModule, RolePermissionModule],
  controllers: [
    LeaveTypeController,
    LeaveBalanceController,
    LeaveRequestController,
    LeaveApprovalController,
    LeaveCalendarController,
    LeaveBlackoutController,
    LeaveReportController,
  ],
  providers: [
    LeaveTypeService,
    LeaveBalanceService,
    LeaveAccrualService,
    LeaveRequestService,
    LeaveApprovalService,
    LeaveCalendarService,
    LeaveBlackoutService,
    LeaveReportService,
    LeaveNotificationService,
  ],
  exports: [
    LeaveTypeService,
    LeaveBalanceService,
    LeaveAccrualService,
    LeaveRequestService,
    LeaveApprovalService,
    LeaveCalendarService,
    LeaveBlackoutService,
    LeaveReportService,
    LeaveNotificationService,
  ],
})
export class StaffLeaveModule {}

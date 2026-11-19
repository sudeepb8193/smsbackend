import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { AttendanceController } from './controllers/attendance.controller';
import { AttendancePolicyController } from './controllers/attendance-policy.controller';
import { AttendanceCorrectionController } from './controllers/attendance-correction.controller';
import { AttendanceApprovalController } from './controllers/attendance-approval.controller';
import { AttendanceSummaryController } from './controllers/attendance-summary.controller';
import { AttendanceCalculatorService } from './services/attendance-calculator.service';
import { AttendancePolicyService } from './services/attendance-policy.service';
import { AttendanceService } from './services/attendance.service';
import { AttendanceCorrectionService } from './services/attendance-correction.service';
import { AttendanceApprovalService } from './services/attendance-approval.service';
import { AttendanceSummaryService } from './services/attendance-summary.service';

@Module({
  imports: [PrismaModule, RolePermissionModule],
  controllers: [
    AttendanceController,
    AttendancePolicyController,
    AttendanceCorrectionController,
    AttendanceApprovalController,
    AttendanceSummaryController,
  ],
  providers: [
    AttendanceCalculatorService,
    AttendancePolicyService,
    AttendanceService,
    AttendanceCorrectionService,
    AttendanceApprovalService,
    AttendanceSummaryService,
  ],
  exports: [
    AttendanceService,
    AttendancePolicyService,
    AttendanceApprovalService,
    AttendanceSummaryService,
  ],
})
export class StaffAttendanceModule {}

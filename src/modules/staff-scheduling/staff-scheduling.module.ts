import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';

// Controllers
import { ShiftTemplateController } from './controllers/shift-template.controller';
import { WeeklyScheduleController } from './controllers/weekly-schedule.controller';
import { AvailabilityPreferenceController } from './controllers/availability-preference.controller';
import { ScheduleOverrideController } from './controllers/schedule-override.controller';
import { BlockedTimeController } from './controllers/blocked-time.controller';
import { StaffSchedulingController } from './controllers/staff-scheduling.controller';

// Services
import { ShiftTemplateService } from './services/shift-template.service';
import { WeeklyScheduleService } from './services/weekly-schedule.service';
import { AvailabilityPreferenceService } from './services/availability-preference.service';
import { ScheduleOverrideService } from './services/schedule-override.service';
import { BlockedTimeService } from './services/blocked-time.service';
import { AvailabilityEngineService } from './services/availability-engine.service';
import { StaffSchedulingOverviewService } from './services/staff-scheduling-overview.service';

@Module({
  imports: [PrismaModule, RolePermissionModule],
  controllers: [
    ShiftTemplateController,
    WeeklyScheduleController,
    AvailabilityPreferenceController,
    ScheduleOverrideController,
    BlockedTimeController,
    StaffSchedulingController,
  ],
  providers: [
    ShiftTemplateService,
    WeeklyScheduleService,
    AvailabilityPreferenceService,
    ScheduleOverrideService,
    BlockedTimeService,
    AvailabilityEngineService,
    StaffSchedulingOverviewService,
  ],
  exports: [
    ShiftTemplateService,
    WeeklyScheduleService,
    AvailabilityPreferenceService,
    ScheduleOverrideService,
    BlockedTimeService,
    AvailabilityEngineService,
    StaffSchedulingOverviewService,
  ],
})
export class StaffSchedulingModule {}


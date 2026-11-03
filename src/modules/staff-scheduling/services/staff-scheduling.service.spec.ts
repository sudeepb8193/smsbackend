import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ShiftTemplateService } from './shift-template.service';
import { WeeklyScheduleService } from './weekly-schedule.service';
import { AvailabilityPreferenceService } from './availability-preference.service';
import { ScheduleOverrideService } from './schedule-override.service';
import { BlockedTimeService } from './blocked-time.service';
import { AvailabilityEngineService } from './availability-engine.service';
import { StaffSchedulingOverviewService } from './staff-scheduling-overview.service';
import { PrismaService } from '../../../database/prisma.service';
import { EffectivePermissionResolverService } from '../../role-permission/services/effective-permission-resolver.service';
import {
  timeToMinutes,
  minutesToTime,
  subtractIntervals,
  generateSlots,
  validateShiftAndBreakTimes,
} from '../utils/time-range.util';

describe('Module 07: Staff Scheduling Service Suite', () => {
  let shiftTemplateService: ShiftTemplateService;
  let weeklyScheduleService: WeeklyScheduleService;
  let preferenceService: AvailabilityPreferenceService;
  let overrideService: ScheduleOverrideService;
  let blockedTimeService: BlockedTimeService;
  let availabilityEngine: AvailabilityEngineService;
  let overviewService: StaffSchedulingOverviewService;

  const mockPrisma = {
    sms_shiftTemplates: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    sms_staffWeeklySchedules: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    sms_staffAvailabilityPreferences: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    sms_staffScheduleOverrides: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    sms_staffBlockedTime: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    sms_staff: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    sms_branches: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    sms_staffServices: {
      findFirst: jest.fn(),
    },
    sms_staffLeaveRequests: {
      findFirst: jest.fn(),
    },
    sms_auditLogs: {
      create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    },
    $transaction: jest.fn((cb) => cb(mockPrisma)),
  };

  const mockPermissionResolver = {
    can: jest.fn().mockResolvedValue({ authorized: true, effectiveScope: 'all_branches' }),
    resolveUserPermissions: jest.fn().mockResolvedValue(new Map()),
  };

  const ownerUser = {
    id: 'user-owner',
    email: 'owner@salon.com',
    displayName: 'Owner User',
    organizationId: 'org-1',
    roles: ['OWNER'],
    status: 'active',
  };

  const branchManagerUser = {
    id: 'user-bm',
    email: 'manager@salon.com',
    displayName: 'Branch Manager',
    organizationId: 'org-1',
    roles: ['BRANCH_MANAGER'],
    status: 'active',
  };

  const serviceStaffUser = {
    id: 'user-stylist',
    email: 'stylist@salon.com',
    displayName: 'Stylist User',
    organizationId: 'org-1',
    roles: ['SERVICE_STAFF'],
    status: 'active',
  };

  const sampleStaff = {
    id: 'staff-1',
    organizationId: 'org-1',
    userId: 'user-stylist',
    fullName: 'Sarah Reddy',
    employeeCode: 'EMP001',
    employmentStatus: 'active',
    homeBranchId: 'branch-1',
    homeBranch: { id: 'branch-1', name: 'Indiranagar Flagship', code: 'IND-01', status: 'active' },
    staffBranchAssignments: [],
    staffContacts: { personalEmail: 'stylist@salon.com' },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShiftTemplateService,
        WeeklyScheduleService,
        AvailabilityPreferenceService,
        ScheduleOverrideService,
        BlockedTimeService,
        AvailabilityEngineService,
        StaffSchedulingOverviewService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EffectivePermissionResolverService, useValue: mockPermissionResolver },
      ],
    }).compile();

    shiftTemplateService = module.get<ShiftTemplateService>(ShiftTemplateService);
    weeklyScheduleService = module.get<WeeklyScheduleService>(WeeklyScheduleService);
    preferenceService = module.get<AvailabilityPreferenceService>(AvailabilityPreferenceService);
    overrideService = module.get<ScheduleOverrideService>(ScheduleOverrideService);
    blockedTimeService = module.get<BlockedTimeService>(BlockedTimeService);
    availabilityEngine = module.get<AvailabilityEngineService>(AvailabilityEngineService);
    overviewService = module.get<StaffSchedulingOverviewService>(StaffSchedulingOverviewService);
  });

  // =========================================================================
  // TASK 7.1: SHIFT TEMPLATES
  // =========================================================================
  describe('Task 7.1: Shift Templates', () => {
    it('should validate that shift end time is after start time', async () => {
      await expect(
        shiftTemplateService.createTemplate(
          'org-1',
          {
            name: 'Invalid Shift',
            startTime: '17:00',
            endTime: '09:00',
          },
          ownerUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate that break period is within shift period', async () => {
      await expect(
        shiftTemplateService.createTemplate(
          'org-1',
          {
            name: 'Invalid Break Shift',
            startTime: '09:00',
            endTime: '17:00',
            breakStartTime: '17:30',
            breakEndTime: '18:00',
          },
          ownerUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should prevent duplicate template names within the same organization and scope', async () => {
      mockPrisma.sms_shiftTemplates.findFirst.mockResolvedValueOnce({
        id: 'tmpl-1',
        name: 'Morning Shift',
      });

      await expect(
        shiftTemplateService.createTemplate(
          'org-1',
          {
            name: 'Morning Shift',
            startTime: '09:00',
            endTime: '17:00',
          },
          ownerUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should successfully create an organization-wide shift template', async () => {
      mockPrisma.sms_shiftTemplates.findFirst.mockResolvedValueOnce(null);
      mockPrisma.sms_shiftTemplates.create.mockResolvedValueOnce({
        id: 'tmpl-new',
        organizationId: 'org-1',
        branchId: null,
        name: 'Morning Shift',
        startTime: new Date('1970-01-01T09:00:00Z'),
        endTime: new Date('1970-01-01T17:00:00Z'),
        breakStartTime: new Date('1970-01-01T13:00:00Z'),
        breakEndTime: new Date('1970-01-01T14:00:00Z'),
        colorTag: 'blue',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await shiftTemplateService.createTemplate(
        'org-1',
        {
          name: 'Morning Shift',
          startTime: '09:00',
          endTime: '17:00',
          breakStartTime: '13:00',
          breakEndTime: '14:00',
          colorTag: 'blue',
        },
        ownerUser,
      );

      expect(result.name).toBe('Morning Shift');
      expect(result.startTime).toBe('09:00');
      expect(result.endTime).toBe('17:00');
      expect(result.colorTag).toBe('blue');
    });

    it('should redirect template deletion to retire flow when in active use', async () => {
      mockPrisma.sms_shiftTemplates.findFirst.mockResolvedValueOnce({
        id: 'tmpl-used',
        organizationId: 'org-1',
        name: 'General Shift',
        startTime: new Date('1970-01-01T10:00:00Z'),
        endTime: new Date('1970-01-01T18:00:00Z'),
        status: 'active',
        _count: { staffWeeklySchedules: 5 },
      });

      mockPrisma.sms_shiftTemplates.update.mockResolvedValueOnce({
        id: 'tmpl-used',
        organizationId: 'org-1',
        name: 'General Shift',
        startTime: new Date('1970-01-01T10:00:00Z'),
        endTime: new Date('1970-01-01T18:00:00Z'),
        status: 'inactive',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await shiftTemplateService.deleteTemplate('org-1', 'tmpl-used', ownerUser);
      expect(res.action).toBe('retired');
      expect(res.template.status).toBe('inactive');
      expect(mockPrisma.sms_shiftTemplates.delete).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // TASK 7.2: WEEKLY SCHEDULES
  // =========================================================================
  describe('Task 7.2: Weekly Schedules', () => {
    it('should prevent Service Staff from self-modifying actual shifts', async () => {
      mockPrisma.sms_staff.findFirst.mockResolvedValueOnce(sampleStaff);

      await expect(
        weeklyScheduleService.saveWeeklySchedule(
          'org-1',
          {
            staffId: 'staff-1',
            effectiveFrom: '2026-11-01',
            days: [] as any,
          },
          serviceStaffUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should require all 7 weekdays to be specified', async () => {
      mockPrisma.sms_staff.findFirst.mockResolvedValueOnce(sampleStaff);

      await expect(
        weeklyScheduleService.saveWeeklySchedule(
          'org-1',
          {
            staffId: 'staff-1',
            effectiveFrom: '2026-11-01',
            days: [
              { dayOfWeek: 1, isWorking: true, customStartTime: '09:00', customEndTime: '17:00' },
            ],
          },
          ownerUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject a working day marked with zero hours', async () => {
      mockPrisma.sms_staff.findFirst.mockResolvedValueOnce(sampleStaff);

      const days = Array.from({ length: 7 }, (_, i) => ({
        dayOfWeek: i,
        isWorking: i === 1, // Day 1 working but no template or custom hours!
      }));

      await expect(
        weeklyScheduleService.saveWeeklySchedule(
          'org-1',
          {
            staffId: 'staff-1',
            effectiveFrom: '2026-11-01',
            days,
          },
          ownerUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // TASK 7.3: AVAILABILITY PREFERENCES
  // =========================================================================
  describe('Task 7.3: Availability Preferences', () => {
    it('should allow Service Staff to submit their own availability preferences', async () => {
      mockPrisma.sms_staff.findFirst.mockResolvedValue(sampleStaff);
      mockPrisma.sms_staffAvailabilityPreferences.create.mockResolvedValueOnce({
        id: 'pref-1',
        staffId: 'staff-1',
        dayOfWeek: 6, // Saturday
        startTime: new Date('1970-01-01T17:00:00Z'),
        endTime: new Date('1970-01-01T21:00:00Z'),
        preferenceType: 'unavailable',
        note: 'College evening class',
        createdAt: new Date(),
        updatedAt: new Date(),
        staff: { id: 'staff-1', fullName: 'Sarah Reddy', employeeCode: 'EMP001' },
      });

      const res = await preferenceService.createPreference(
        'org-1',
        {
          dayOfWeek: 6,
          startTime: '17:00',
          endTime: '21:00',
          preferenceType: 'unavailable',
          note: 'College evening class',
        },
        serviceStaffUser,
      );

      expect(res.preferenceType).toBe('unavailable');
      expect(res.dayOfWeek).toBe(6);
      expect(res.startTime).toBe('17:00');
      expect(res.endTime).toBe('21:00');
    });

    it('should flag conflict when manager schedules shift overlapping Unavailable preference', async () => {
      mockPrisma.sms_staffAvailabilityPreferences.findMany.mockResolvedValueOnce([
        {
          id: 'pref-1',
          staffId: 'staff-1',
          dayOfWeek: 6,
          startTime: new Date('1970-01-01T17:00:00Z'),
          endTime: new Date('1970-01-01T21:00:00Z'),
          preferenceType: 'unavailable',
          note: 'Evening class',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const check = await preferenceService.checkSchedulingConflict(
        'staff-1',
        6,
        '16:00',
        '20:00',
      );

      expect(check.hasConflict).toBe(true);
      expect(check.conflicts[0].type).toBe('UNAVAILABLE');
    });
  });

  // =========================================================================
  // TASK 7.4: SCHEDULE OVERRIDES & SHIFT SWAPS
  // =========================================================================
  describe('Task 7.4: Schedule Overrides', () => {
    it('should reject schedule override if reason is missing', async () => {
      await expect(
        overrideService.createOverride(
          'org-1',
          {
            staffId: 'staff-1',
            overrideDate: '2026-11-15',
            overrideType: 'extra_shift',
            startTime: '09:00',
            endTime: '17:00',
            reason: '',
          },
          ownerUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject extra shift if staff has approved leave on that date', async () => {
      mockPrisma.sms_staff.findFirst.mockResolvedValueOnce(sampleStaff);
      mockPrisma.sms_staffLeaveRequests.findFirst.mockResolvedValueOnce({
        id: 'leave-1',
        staffId: 'staff-1',
        status: 'approved',
        startDate: new Date('2026-11-10'),
        endDate: new Date('2026-11-20'),
        leaveType: { name: 'Annual Vacation' },
      });

      await expect(
        overrideService.createOverride(
          'org-1',
          {
            staffId: 'staff-1',
            overrideDate: '2026-11-15',
            overrideType: 'extra_shift',
            startTime: '09:00',
            endTime: '17:00',
            reason: 'Wedding season support',
          },
          ownerUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should prevent employee from self-approving their own override', async () => {
      mockPrisma.sms_staffScheduleOverrides.findUnique.mockResolvedValueOnce({
        id: 'ovr-1',
        staffId: 'staff-1',
        approvalStatus: 'pending',
        staff: {
          id: 'staff-1',
          organizationId: 'org-1',
          userId: 'user-stylist',
          homeBranchId: 'branch-1',
        },
      });

      await expect(
        overrideService.reviewOverride(
          'org-1',
          'ovr-1',
          { status: 'approved' },
          serviceStaffUser, // Same userId as staff.userId!
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // =========================================================================
  // TASK 7.5: BLOCKED TIME
  // =========================================================================
  describe('Task 7.5: Blocked Time', () => {
    it('should reject blocked time if end time is before start time', async () => {
      mockPrisma.sms_staff.findFirst.mockResolvedValueOnce(sampleStaff);

      await expect(
        blockedTimeService.createBlockedTime(
          'org-1',
          {
            staffId: 'staff-1',
            branchId: 'branch-1',
            blockDate: '2026-11-15',
            startTime: '15:00',
            endTime: '13:00',
            reasonCategory: 'training',
          },
          ownerUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully bulk-block time for multiple employees', async () => {
      mockPrisma.sms_staff.findFirst.mockResolvedValue(sampleStaff);
      mockPrisma.sms_staffBlockedTime.create.mockResolvedValue({
        id: 'block-bulk-1',
        staffId: 'staff-1',
        branchId: 'branch-1',
        blockDate: new Date('2026-11-15'),
        startTime: new Date('1970-01-01T13:00:00Z'),
        endTime: new Date('1970-01-01T15:00:00Z'),
        reasonCategory: 'training',
        note: 'New Color Technique Workshop',
        isRecurring: false,
        recurrenceEndDate: null,
        createdById: 'user-owner',
        createdAt: new Date(),
        updatedAt: new Date(),
        staff: { id: 'staff-1', fullName: 'Sarah Reddy', employeeCode: 'EMP001' },
        branch: { id: 'branch-1', name: 'Indiranagar Flagship', code: 'IND-01' },
      });

      const res = await blockedTimeService.bulkCreateBlockedTime(
        'org-1',
        {
          staffIds: ['staff-1'],
          branchId: 'branch-1',
          blockDate: '2026-11-15',
          startTime: '13:00',
          endTime: '15:00',
          reasonCategory: 'training',
          note: 'New Color Technique Workshop',
        },
        ownerUser,
      );

      expect(res.count).toBe(1);
      expect(res.blockedTimes[0].reasonCategory).toBe('training');
      expect(res.blockedTimes[0].startTime).toBe('13:00');
      expect(res.blockedTimes[0].endTime).toBe('15:00');
    });
  });

  // =========================================================================
  // TASK 7.6: AVAILABILITY ENGINE
  // =========================================================================
  describe('Task 7.6: Effective Staff Availability Engine', () => {
    it('should compute exact interval subtraction with breaks and blocked time', () => {
      // Base shift: 09:00 (540) to 17:00 (1020)
      // Break: 13:00 (780) to 14:00 (840)
      // Block: 15:00 (900) to 16:00 (960)
      const baseStart = 540;
      const baseEnd = 1020;
      const busy = [
        { startMin: 780, endMin: 840 },
        { startMin: 900, endMin: 960 },
      ];

      const free = subtractIntervals(baseStart, baseEnd, busy);

      // Expected free intervals:
      // 09:00 - 13:00 (540 - 780)
      // 14:00 - 15:00 (840 - 900)
      // 16:00 - 17:00 (960 - 1020)
      expect(free).toEqual([
        { startMin: 540, endMin: 780 },
        { startMin: 840, endMin: 900 },
        { startMin: 960, endMin: 1020 },
      ]);

      const formatted = free.map((f) => ({
        start: minutesToTime(f.startMin),
        end: minutesToTime(f.endMin),
      }));

      expect(formatted).toEqual([
        { start: '09:00', end: '13:00' },
        { start: '14:00', end: '15:00' },
        { start: '16:00', end: '17:00' },
      ]);
    });

    it('should generate discrete booking slots for a requested service duration', () => {
      const free = [{ startMin: 540, endMin: 660 }]; // 09:00 to 11:00 (120 min)
      const slots = generateSlots(free, 60, 30); // 60 min slots every 30 min

      expect(slots).toEqual([
        { start: '09:00', end: '10:00', durationMinutes: 60 },
        { start: '09:30', end: '10:30', durationMinutes: 60 },
        { start: '10:00', end: '11:00', durationMinutes: 60 },
      ]);
    });

    it('should mark employee unavailable on recurring day off unless extra shift approved', async () => {
      mockPrisma.sms_staff.findFirst.mockResolvedValueOnce(sampleStaff);
      // Sunday (dayOfWeek 0): isWorking: false
      mockPrisma.sms_staffWeeklySchedules.findFirst.mockResolvedValueOnce({
        id: 'sched-sun',
        staffId: 'staff-1',
        dayOfWeek: 0,
        isWorking: false,
      });
      mockPrisma.sms_staffScheduleOverrides.findFirst.mockResolvedValueOnce(null);
      mockPrisma.sms_staffLeaveRequests.findFirst.mockResolvedValueOnce(null);
      mockPrisma.sms_staffBlockedTime.findMany.mockResolvedValueOnce([]);

      const res = await availabilityEngine.getStaffAvailability('org-1', 'staff-1', {
        date: '2026-11-08', // A Sunday
      });

      expect(res.isBookable).toBe(false);
      expect(res.unavailabilityReasons).toContain('Employee is scheduled off (recurring day off)');
      expect(res.availableIntervals).toHaveLength(0);
    });

    it('should make an otherwise off employee available during an approved extra shift', async () => {
      mockPrisma.sms_staff.findFirst.mockResolvedValueOnce(sampleStaff);
      // Sunday is normally off
      mockPrisma.sms_staffWeeklySchedules.findFirst.mockResolvedValueOnce({
        id: 'sched-sun',
        staffId: 'staff-1',
        dayOfWeek: 0,
        isWorking: false,
      });
      // But has approved extra_shift: 10:00 to 16:00
      mockPrisma.sms_staffScheduleOverrides.findFirst.mockResolvedValueOnce({
        id: 'ovr-extra',
        staffId: 'staff-1',
        overrideType: 'extra_shift',
        startTime: new Date('1970-01-01T10:00:00Z'),
        endTime: new Date('1970-01-01T16:00:00Z'),
        reason: 'Wedding rush',
        approvalStatus: 'approved',
      });
      mockPrisma.sms_staffLeaveRequests.findFirst.mockResolvedValueOnce(null);
      mockPrisma.sms_staffBlockedTime.findMany.mockResolvedValueOnce([]);

      const res = await availabilityEngine.getStaffAvailability('org-1', 'staff-1', {
        date: '2026-11-08',
      });

      expect(res.isBookable).toBe(true);
      expect(res.overrideApplied?.type).toBe('extra_shift');
      expect(res.workingIntervals).toEqual([{ start: '10:00', end: '16:00' }]);
      expect(res.availableIntervals).toEqual([{ start: '10:00', end: '16:00' }]);
    });
  });
});


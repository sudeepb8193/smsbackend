import { Test, TestingModule } from '@nestjs/testing';
import { LeaveTypeService } from './services/leave-type.service';
import { LeaveBalanceService } from './services/leave-balance.service';
import { LeaveAccrualService } from './services/leave-accrual.service';
import { LeaveRequestService } from './services/leave-request.service';
import { LeaveApprovalService } from './services/leave-approval.service';
import { LeaveCalendarService } from './services/leave-calendar.service';
import { LeaveBlackoutService } from './services/leave-blackout.service';
import { LeaveReportService } from './services/leave-report.service';
import { LeaveNotificationService } from './services/leave-notification.service';
import { PrismaService } from '../../database/prisma.service';
import { EffectivePermissionResolverService } from '../role-permission/services/effective-permission-resolver.service';
import { LeaveCalculatorUtil } from './utils/leave-calculator.util';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('Module 09: Staff Leave Management Tests', () => {
  let leaveTypeService: LeaveTypeService;
  let balanceService: LeaveBalanceService;
  let accrualService: LeaveAccrualService;
  let requestService: LeaveRequestService;
  let approvalService: LeaveApprovalService;
  let blackoutService: LeaveBlackoutService;
  let calendarService: LeaveCalendarService;
  let reportService: LeaveReportService;

  const mockPrisma = {
    sms_leaveTypes: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    sms_staffLeaveBalances: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    sms_staffLeaveRequests: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    sms_leaveApprovalLogs: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    sms_leaveBlackoutPeriods: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    sms_staff: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    sms_holidays: {
      findMany: jest.fn(),
    },
    sms_staffWeeklySchedules: {
      findMany: jest.fn(),
    },
    sms_staffScheduleOverrides: {
      findFirst: jest.fn(),
    },
    sms_staffEmploymentHistory: {
      findFirst: jest.fn(),
    },
    sms_branchManagerAssignments: {
      findMany: jest.fn(),
    },
    sms_auditLogs: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => {
      if (typeof callback === 'function') {
        return callback(mockPrisma);
      }
      return Promise.all(callback);
    }),
    $executeRawUnsafe: jest.fn().mockResolvedValue(1),
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
  };

  const mockPermissionResolver = {
    can: jest.fn().mockResolvedValue({ authorized: true }),
  };

  const sampleUser: any = {
    id: 'user-uuid-1',
    organizationId: 'org-uuid-1',
    roles: ['OWNER'],
  };

  const sampleStaff: any = {
    id: 'staff-uuid-1',
    organizationId: 'org-uuid-1',
    userId: 'user-uuid-1',
    fullName: 'Jane Doe',
    employeeCode: 'EMP001',
    gender: 'female',
    homeBranchId: 'branch-uuid-1',
    createdAt: new Date('2026-01-15T00:00:00.000Z'),
    homeBranch: { id: 'branch-uuid-1', name: 'Downtown Branch', code: 'DT01' },
    staffBranchAssignments: [],
  };

  const sampleLeaveType: any = {
    id: 'lt-uuid-1',
    organizationId: 'org-uuid-1',
    name: 'Casual Leave',
    code: 'CL',
    isPaid: true,
    accrualMethod: 'annual_grant',
    annualEntitlementDays: new Prisma.Decimal(12),
    monthlyAccrualDays: new Prisma.Decimal(1),
    maxCarryForwardDays: new Prisma.Decimal(5),
    documentRequiredAfterDays: new Prisma.Decimal(3),
    minNoticeDays: 2,
    applicableGender: 'all',
    status: 'active',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
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
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EffectivePermissionResolverService, useValue: mockPermissionResolver },
      ],
    }).compile();

    leaveTypeService = module.get<LeaveTypeService>(LeaveTypeService);
    balanceService = module.get<LeaveBalanceService>(LeaveBalanceService);
    accrualService = module.get<LeaveAccrualService>(LeaveAccrualService);
    requestService = module.get<LeaveRequestService>(LeaveRequestService);
    approvalService = module.get<LeaveApprovalService>(LeaveApprovalService);
    blackoutService = module.get<LeaveBlackoutService>(LeaveBlackoutService);
    calendarService = module.get<LeaveCalendarService>(LeaveCalendarService);
    reportService = module.get<LeaveReportService>(LeaveReportService);
  });

  describe('Task 9.1: Leave Types & Policy', () => {
    it('should create a leave type and prevent duplicate codes within organization', async () => {
      mockPrisma.sms_leaveTypes.findFirst.mockResolvedValueOnce(null);
      mockPrisma.sms_leaveTypes.create.mockResolvedValueOnce({
        ...sampleLeaveType,
        id: 'lt-new-1',
      });

      const res = await leaveTypeService.createLeaveType(sampleUser, {
        name: 'Sick Leave',
        code: 'SL',
        annualEntitlementDays: 12,
      });

      expect(res.id).toBe('lt-new-1');
      expect(mockPrisma.sms_leaveTypes.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if leave type code already exists in org', async () => {
      mockPrisma.sms_leaveTypes.findFirst.mockResolvedValueOnce(sampleLeaveType);

      await expect(
        leaveTypeService.createLeaveType(sampleUser, {
          name: 'Casual Leave Duplicate',
          code: 'CL',
          annualEntitlementDays: 10,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should deactivate a leave type instead of permanent destructive deletion', async () => {
      mockPrisma.sms_leaveTypes.findFirst.mockResolvedValueOnce(sampleLeaveType);
      mockPrisma.sms_leaveTypes.update.mockResolvedValueOnce({
        ...sampleLeaveType,
        status: 'inactive',
      });

      const res = await leaveTypeService.setLeaveTypeStatus(
        sampleUser,
        'lt-uuid-1',
        'inactive',
      );
      expect(res.status).toBe('inactive');
      expect(mockPrisma.sms_leaveTypes.update).toHaveBeenCalledWith({
        where: { id: 'lt-uuid-1' },
        data: { status: 'inactive' },
      });
    });
  });

  describe('Task 9.2: Leave Balance & Accrual Calculation', () => {
    it('should calculate available balance correctly: opening + carried + accrued + manualAdjustment - used', () => {
      const balance = {
        openingBalanceDays: 10,
        carriedForwardDays: 2,
        accruedDays: 3,
        usedDays: 4,
        manualAdjustmentDays: 1.5,
      };
      const available = balanceService.calculateAvailableBalance(balance);
      // 10 + 2 + 3 + 1.5 - 4 = 12.5
      expect(available).toBe(12.5);
    });

    it('should calculate pro-rata entitlement correctly for mid-year joiners', () => {
      // Joined July 1st of 2026 (month 6, 6 remaining months)
      const joiningDate = new Date('2026-07-01');
      const proRata = LeaveCalculatorUtil.calculateProRataEntitlement(joiningDate, 12, 2026);
      expect(proRata).toBe(6.0); // 6/12 * 12 = 6
    });

    it('should adjust balance manually with mandatory reason and ledger entry', async () => {
      mockPrisma.sms_staff.findFirst.mockResolvedValueOnce(sampleStaff);
      mockPrisma.sms_staffLeaveBalances.findUnique.mockResolvedValueOnce({
        id: 'bal-1',
        staffId: 'staff-uuid-1',
        leaveTypeId: 'lt-uuid-1',
        balanceYear: 2026,
        openingBalanceDays: 10,
        carriedForwardDays: 0,
        accruedDays: 0,
        usedDays: 2,
        manualAdjustmentDays: 0,
        closingBalanceDays: 8,
      });
      mockPrisma.sms_staffLeaveBalances.update.mockResolvedValueOnce({
        id: 'bal-1',
        manualAdjustmentDays: 2,
        closingBalanceDays: 10,
      });

      const res = await balanceService.adjustStaffBalance(sampleUser, {
        staffId: 'staff-uuid-1',
        leaveTypeId: 'lt-uuid-1',
        adjustmentDays: 2,
        reason: 'Compensatory off credit for Sunday shift',
      });

      expect(res.afterBalance).toBe(10);
      expect(res.transaction.amount).toBe(2);
    });
  });

  describe('Task 9.3: Leave Request Workflow', () => {
    it('should reject application if dates fall within a full blackout period', async () => {
      mockPrisma.sms_staff.findFirst.mockResolvedValueOnce(sampleStaff);
      mockPrisma.sms_leaveTypes.findFirst.mockResolvedValueOnce(sampleLeaveType);
      mockPrisma.sms_staffWeeklySchedules.findMany.mockResolvedValueOnce([]);
      mockPrisma.sms_holidays.findMany.mockResolvedValueOnce([]);

      // Mock blackout service returning isBlocked = true
      jest.spyOn(blackoutService, 'validateLeaveDatesAgainstBlackout').mockResolvedValueOnce({
        hasRestriction: true,
        isBlocked: true,
        warnings: ["Blackout Period 'Diwali Peak Week': Full leave block in effect."],
      });

      await expect(
        requestService.applyForLeave(sampleUser, {
          staffId: 'staff-uuid-1',
          leaveTypeId: 'lt-uuid-1',
          startDate: '2026-11-01',
          endDate: '2026-11-05',
          reason: 'Vacation trip',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject application if supporting document is missing when requested days exceed threshold', async () => {
      mockPrisma.sms_staff.findFirst.mockResolvedValueOnce(sampleStaff);
      mockPrisma.sms_leaveTypes.findFirst.mockResolvedValueOnce({
        ...sampleLeaveType,
        documentRequiredAfterDays: new Prisma.Decimal(2),
      });
      mockPrisma.sms_staffWeeklySchedules.findMany.mockResolvedValueOnce([]);
      mockPrisma.sms_holidays.findMany.mockResolvedValueOnce([]);

      // 4 days requested (exceeds threshold of 2), no document URL
      await expect(
        requestService.applyForLeave(sampleUser, {
          staffId: 'staff-uuid-1',
          leaveTypeId: 'lt-uuid-1',
          startDate: '2026-11-02', // Monday
          endDate: '2026-11-05',   // Thursday = 4 days
          reason: 'Severe illness',
          supportingDocumentUrl: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should block overlapping pending or approved leave requests for the same staff', async () => {
      mockPrisma.sms_staff.findFirst.mockResolvedValueOnce(sampleStaff);
      mockPrisma.sms_leaveTypes.findFirst.mockResolvedValueOnce(sampleLeaveType);
      mockPrisma.sms_staffWeeklySchedules.findMany.mockResolvedValueOnce([]);
      mockPrisma.sms_holidays.findMany.mockResolvedValueOnce([]);

      jest.spyOn(blackoutService, 'validateLeaveDatesAgainstBlackout').mockResolvedValueOnce({
        hasRestriction: false,
        isBlocked: false,
        warnings: [],
      });

      // Existing overlapping request found
      mockPrisma.sms_staffLeaveRequests.findFirst.mockResolvedValueOnce({
        id: 'existing-req-1',
        status: 'approved',
        startDate: new Date('2026-11-03'),
        endDate: new Date('2026-11-04'),
        leaveType: { name: 'Casual Leave' },
      });

      await expect(
        requestService.applyForLeave(sampleUser, {
          staffId: 'staff-uuid-1',
          leaveTypeId: 'lt-uuid-1',
          startDate: '2026-11-02',
          endDate: '2026-11-05',
          reason: 'Personal',
          supportingDocumentUrl: 'https://docs.example.com/certificate.pdf',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Task 9.4: Leave Approval Audit Trail & Atomic State Transitions', () => {
    it('should approve leave atomically, deduct usedDays, and log approval', async () => {
      mockPrisma.sms_staffLeaveRequests.findUnique.mockResolvedValueOnce({
        id: 'req-1',
        staffId: 'staff-uuid-1',
        leaveTypeId: 'lt-uuid-1',
        startDate: new Date('2026-11-02'),
        endDate: new Date('2026-11-03'),
        totalDays: new Prisma.Decimal(2),
        status: 'pending',
        staff: sampleStaff,
        leaveType: sampleLeaveType,
      });

      mockPrisma.sms_staffLeaveRequests.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.sms_staffLeaveBalances.findUnique.mockResolvedValueOnce({
        id: 'bal-1',
        staffId: 'staff-uuid-1',
        leaveTypeId: 'lt-uuid-1',
        balanceYear: 2026,
        openingBalanceDays: 10,
        carriedForwardDays: 0,
        accruedDays: 0,
        usedDays: 0,
        manualAdjustmentDays: 0,
        closingBalanceDays: 10,
      });

      mockPrisma.sms_staffLeaveBalances.update.mockResolvedValueOnce({
        id: 'bal-1',
        usedDays: 2,
        closingBalanceDays: 8,
      });

      const res = await approvalService.approveLeaveRequest(sampleUser, 'req-1', {
        notes: 'Approved by Branch Manager',
      });

      expect(res.status).toBe('approved');
      expect(res.balanceDeducted).toBe(2);
      expect(mockPrisma.sms_leaveApprovalLogs.create).toHaveBeenCalled();
    });

    it('should reject a request without deducting balance and preserve notes', async () => {
      mockPrisma.sms_staffLeaveRequests.findUnique.mockResolvedValueOnce({
        id: 'req-1',
        staffId: 'staff-uuid-1',
        leaveTypeId: 'lt-uuid-1',
        startDate: new Date('2026-11-02'),
        endDate: new Date('2026-11-03'),
        totalDays: new Prisma.Decimal(2),
        status: 'pending',
        staff: sampleStaff,
        leaveType: sampleLeaveType,
      });

      mockPrisma.sms_staffLeaveRequests.updateMany.mockResolvedValueOnce({ count: 1 });

      const res = await approvalService.rejectLeaveRequest(sampleUser, 'req-1', {
        notes: 'Staff shortage on requested dates',
      });

      expect(res.status).toBe('rejected');
      expect(mockPrisma.sms_staffLeaveBalances.update).not.toHaveBeenCalled();
      expect(mockPrisma.sms_leaveApprovalLogs.create).toHaveBeenCalled();
    });
  });

  describe('Task 9.5: Leave Calendar Feed', () => {
    it('should aggregate approved leaves, holidays, and blackout periods into unified calendar feed', async () => {
      mockPrisma.sms_staffLeaveRequests.findMany.mockResolvedValueOnce([
        {
          id: 'req-1',
          startDate: new Date('2026-11-02'),
          endDate: new Date('2026-11-03'),
          status: 'approved',
          isHalfDay: false,
          totalDays: 2,
          reason: 'Medical checkup',
          staff: sampleStaff,
          leaveType: sampleLeaveType,
        },
      ]);

      mockPrisma.sms_holidays.findMany.mockResolvedValueOnce([
        {
          id: 'hol-1',
          name: 'Thanksgiving',
          holidayDate: new Date('2026-11-26'),
          description: 'Public holiday',
          branch: null,
          branchId: null,
        },
      ]);

      mockPrisma.sms_leaveBlackoutPeriods.findMany.mockResolvedValueOnce([
        {
          id: 'blackout-1',
          name: 'Cyber Monday Peak',
          startDate: new Date('2026-11-28'),
          endDate: new Date('2026-11-30'),
          restrictionType: 'block_all',
          maxPercentageStaffOnLeave: null,
          reason: 'Peak client bookings',
          branch: null,
          branchId: null,
        },
      ]);

      const feed = await calendarService.getCalendarEvents(sampleUser, {
        startDate: '2026-11-01',
        endDate: '2026-11-30',
      });

      expect(feed.leaves.length).toBe(1);
      expect(feed.holidays.length).toBe(1);
      expect(feed.blackoutPeriods.length).toBe(1);
      expect(feed.totalEvents).toBe(3);
    });
  });
});

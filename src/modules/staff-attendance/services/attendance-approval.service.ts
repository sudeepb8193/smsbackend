import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ApproveAttendancePeriodDto } from '../dto/period-approval.dto';
import { ReopenAttendancePeriodDto } from '../dto/reopen-period.dto';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { AttendanceAccessHelper } from '../utils/attendance-access.util';
import { AttendanceService } from './attendance.service';

@Injectable()
export class AttendanceApprovalService {
  private readonly logger = new Logger(AttendanceApprovalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceService: AttendanceService,
  ) {}

  /**
   * Task 8.4: Pay-Period Review Workspace
   */
  async getPeriodReview(
    user: AuthenticatedUser,
    organizationId: string,
    branchId: string,
    periodStart: string,
    periodEnd: string,
  ) {
    const orgId = AttendanceAccessHelper.resolveOrgId(user, organizationId);
    const start = this.attendanceService.normalizeDate(periodStart);
    const end = this.attendanceService.normalizeDate(periodEnd);

    if (end < start) {
      throw new BadRequestException('Period end date must be on or after period start date.');
    }

    // 1. Fetch active staff assigned to branch
    const staffList = await this.prisma.sms_staff.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
        employmentStatus: 'active',
        OR: [
          { homeBranchId: branchId },
          { staffBranchAssignments: { some: { branchId } } },
        ],
      },
      orderBy: { fullName: 'asc' },
      include: {
        homeBranch: { select: { id: true, name: true, code: true } },
        staffDesignations: {
          where: { isPrimary: true },
          select: { designationType: true, customLabel: true },
        },
      },
    });

    const staffIds = staffList.map((s) => s.id);

    // 2. Fetch all attendance records in period
    const attendanceRecords = await this.prisma.sms_staffAttendance.findMany({
      where: {
        staffId: { in: staffIds },
        branchId,
        attendanceDate: { gte: start, lte: end },
      },
      include: {
        staffAttendanceCorrections: {
          where: { status: 'pending' },
        },
      },
    });

    // 3. Fetch existing period approvals
    const approvals = await this.prisma.sms_attendancePeriodApprovals.findMany({
      where: {
        staffId: { in: staffIds },
        branchId,
        periodStart: start,
        periodEnd: end,
      },
      include: {
        approvedBy: { select: { displayName: true, email: true } },
        reopenedBy: { select: { displayName: true, email: true } },
      },
    });

    const approvalMap = new Map(approvals.map((a) => [a.staffId, a]));

    // 4. Aggregate metrics per employee
    const rows = staffList.map((st: any) => {
      const records = attendanceRecords.filter((r) => r.staffId === st.id);
      const approval = approvalMap.get(st.id) || null;

      let presentDays = 0;
      let absentDays = 0;
      let lateDays = 0;
      let halfDays = 0;
      let leaveDays = 0;
      let holidayDays = 0;
      let workedMinutes = 0;
      let overtimeMinutes = 0;
      let pendingCorrectionCount = 0;

      for (const r of records) {
        workedMinutes += r.workedMinutes || 0;
        overtimeMinutes += r.overtimeMinutes || 0;
        if (r.status === 'present') presentDays++;
        else if (r.status === 'late') lateDays++;
        else if (r.status === 'absent') absentDays++;
        else if (r.status === 'half_day') halfDays++;
        else if (r.status === 'on_leave') leaveDays++;
        else if (r.status === 'holiday') holidayDays++;

        pendingCorrectionCount += r.staffAttendanceCorrections.length;
      }

      const totalRecordedDays = records.length;
      const isLocked = approval?.status === 'approved';
      const isClean = pendingCorrectionCount === 0;
      const designation = st.staffDesignations?.[0]?.customLabel || st.staffDesignations?.[0]?.designationType || 'Staff';

      return {
        staffId: st.id,
        employeeCode: st.employeeCode,
        fullName: st.fullName,
        profilePhotoUrl: st.profilePhotoUrl,
        designation,
        homeBranch: st.homeBranch,
        totalRecordedDays,
        presentDays,
        absentDays,
        lateDays,
        halfDays,
        leaveDays,
        holidayDays,
        totalWorkedMinutes: workedMinutes,
        totalWorkedHoursFormatted: `${Math.floor(workedMinutes / 60)}h ${workedMinutes % 60}m`,
        totalOvertimeMinutes: overtimeMinutes,
        totalOvertimeHoursFormatted: `${Math.floor(overtimeMinutes / 60)}h ${overtimeMinutes % 60}m`,
        pendingCorrectionCount,
        isClean,
        approvalId: approval?.id || null,
        approvalStatus: approval?.status || 'pending',
        isLocked,
        approvedBy: approval?.approvedBy?.displayName || null,
        approvedAt: approval?.approvedAt || null,
        reopenedReason: approval?.reopenedReason || null,
        reopenedBy: approval?.reopenedBy?.displayName || null,
        reopenedAt: approval?.reopenedAt || null,
      };
    });

    return {
      branchId,
      periodStart: start.toISOString().split('T')[0],
      periodEnd: end.toISOString().split('T')[0],
      totalStaff: staffList.length,
      data: rows,
    };
  }

  /**
   * Task 8.4: Approve Staff Attendance Period & Lock Records
   */
  async approvePeriod(
    user: AuthenticatedUser,
    dto: ApproveAttendancePeriodDto,
    queryOrgId?: string,
  ) {
    const orgId = AttendanceAccessHelper.resolveOrgId(user, queryOrgId);
    const start = this.attendanceService.normalizeDate(dto.periodStart);
    const end = this.attendanceService.normalizeDate(dto.periodEnd);

    const targetStaffIds: string[] = dto.staffId
      ? [dto.staffId]
      : dto.staffIds || [];

    if (targetStaffIds.length === 0) {
      throw new BadRequestException('At least one staff member must be specified for period approval.');
    }

    // 1. Check for Pending Corrections - Approval Hard Gate
    const pendingCorrections = await this.prisma.sms_staffAttendanceCorrections.findMany({
      where: {
        staffId: { in: targetStaffIds },
        correctionDate: { gte: start, lte: end },
        status: 'pending',
      },
      include: {
        staff: { select: { fullName: true, employeeCode: true } },
      },
    });

    if (pendingCorrections.length > 0) {
      throw new BadRequestException({
        code: 'PENDING_CORRECTIONS_BLOCKING_APPROVAL',
        message: `Cannot approve attendance period: ${pendingCorrections.length} unresolved correction request(s) exist. All pending requests must be reviewed first.`,
        pendingCount: pendingCorrections.length,
        items: pendingCorrections.map((c) => ({
          correctionId: c.id,
          employee: c.staff.fullName,
          date: c.correctionDate,
          reason: c.reason,
        })),
      });
    }

    // 2. Transaction: Upsert Approvals & Set isLocked = true on attendance rows
    const results = await this.prisma.$transaction(async (tx) => {
      const approvalRecords: any[] = [];

      for (const sId of targetStaffIds) {
        const approval = await tx.sms_attendancePeriodApprovals.upsert({
          where: {
            staffId_periodStart_periodEnd: {
              staffId: sId,
              periodStart: start,
              periodEnd: end,
            },
          },
          update: {
            branchId: dto.branchId,
            status: 'approved',
            approvedById: user.id,
            approvedAt: new Date(),
            reopenedReason: null,
            reopenedById: null,
            reopenedAt: null,
          },
          create: {
            staffId: sId,
            branchId: dto.branchId,
            periodStart: start,
            periodEnd: end,
            status: 'approved',
            approvedById: user.id,
            approvedAt: new Date(),
          },
        });

        // Lock all attendance records in range
        await tx.sms_staffAttendance.updateMany({
          where: {
            staffId: sId,
            branchId: dto.branchId,
            attendanceDate: { gte: start, lte: end },
          },
          data: {
            isLocked: true,
          },
        });

        approvalRecords.push(approval);
      }

      return approvalRecords;
    });

    await AttendanceAccessHelper.recordAuditLog(
      this.prisma,
      orgId,
      user.id,
      'attendance_period.approve',
      null,
      {
        branchId: dto.branchId,
        staffIds: targetStaffIds,
        periodStart: start,
        periodEnd: end,
        count: results.length,
      },
    );

    return {
      success: true,
      message: `Successfully approved and locked attendance records for ${results.length} employee(s). Period is now ready for payroll.`,
      approvals: results,
    };
  }

  /**
   * Task 8.4: Bulk Approve All Clean Records (Zero Pending Corrections)
   */
  async approveAllClean(
    user: AuthenticatedUser,
    organizationId: string,
    branchId: string,
    periodStart: string,
    periodEnd: string,
  ) {
    const review = await this.getPeriodReview(
      user,
      organizationId,
      branchId,
      periodStart,
      periodEnd,
    );

    const cleanStaffIds = review.data
      .filter((r) => r.isClean && r.approvalStatus !== 'approved')
      .map((r) => r.staffId);

    if (cleanStaffIds.length === 0) {
      return {
        success: true,
        message: 'No clean unapproved staff records found for this period.',
        approvedCount: 0,
      };
    }

    return this.approvePeriod(
      user,
      {
        branchId,
        staffIds: cleanStaffIds,
        periodStart,
        periodEnd,
      },
      organizationId,
    );
  }

  /**
   * Task 8.4: Reopen Previously Approved Period
   */
  async reopenPeriod(
    user: AuthenticatedUser,
    approvalId: string,
    dto: ReopenAttendancePeriodDto,
    queryOrgId?: string,
  ) {
    const orgId = AttendanceAccessHelper.resolveOrgId(user, queryOrgId);

    const approval = await this.prisma.sms_attendancePeriodApprovals.findUnique({
      where: { id: approvalId },
      include: {
        staff: true,
      },
    });

    if (!approval) {
      throw new NotFoundException('Period approval record not found.');
    }

    if (approval.staff.organizationId !== orgId) {
      throw new ForbiddenException('Access denied to period approval from another organization.');
    }

    if (approval.status !== 'approved') {
      throw new BadRequestException(`Period is already in '${approval.status}' state and cannot be reopened.`);
    }

    if (!dto.reason || dto.reason.trim().length === 0) {
      throw new BadRequestException('A mandatory reason is required to reopen an approved attendance period.');
    }

    // Atomic transaction: Reopen Approval & Unlock Attendance Rows
    const result = await this.prisma.$transaction(async (tx) => {
      const updatedApproval = await tx.sms_attendancePeriodApprovals.update({
        where: { id: approvalId },
        data: {
          status: 'reopened',
          reopenedReason: dto.reason.trim(),
          reopenedById: user.id,
          reopenedAt: new Date(),
        },
      });

      // Unlock attendance rows
      await tx.sms_staffAttendance.updateMany({
        where: {
          staffId: approval.staffId,
          branchId: approval.branchId,
          attendanceDate: {
            gte: approval.periodStart,
            lte: approval.periodEnd,
          },
        },
        data: {
          isLocked: false,
        },
      });

      return updatedApproval;
    });

    await AttendanceAccessHelper.recordAuditLog(
      this.prisma,
      orgId,
      user.id,
      'attendance_period.reopen',
      approval,
      result,
    );

    return {
      success: true,
      message: 'Attendance period successfully reopened. Attendance records unlocked for corrections. Re-approval required prior to payroll processing.',
      approval: result,
      warning: 'Downstream payroll (Module 38) may require recalculation if a pay run was already executed against this period.',
    };
  }

  /**
   * Task 8.4: Hard Financial-Integrity Gate for Module 38 Payroll
   */
  async getPayrollReadyAttendance(
    user: AuthenticatedUser,
    organizationId: string,
    branchId: string,
    periodStart: string,
    periodEnd: string,
  ) {
    const orgId = AttendanceAccessHelper.resolveOrgId(user, organizationId);
    const start = this.attendanceService.normalizeDate(periodStart);
    const end = this.attendanceService.normalizeDate(periodEnd);

    // Hard Gate: Only fetch staff whose period is formally APPROVED
    const approvedPeriods = await this.prisma.sms_attendancePeriodApprovals.findMany({
      where: {
        branchId,
        periodStart: start,
        periodEnd: end,
        status: 'approved',
      },
      include: {
        staff: {
          select: { id: true, fullName: true, employeeCode: true, homeBranchId: true },
        },
      },
    });

    const approvedStaffIds = approvedPeriods.map((a) => a.staffId);

    if (approvedStaffIds.length === 0) {
      throw new ForbiddenException({
        code: 'PAYROLL_GATE_UNAPPROVED_DATA',
        message: 'No approved attendance periods found for the specified date range. Module 38 Payroll cannot consume unapproved or reopened attendance data.',
      });
    }

    const lockedAttendance = await this.prisma.sms_staffAttendance.findMany({
      where: {
        staffId: { in: approvedStaffIds },
        branchId,
        attendanceDate: { gte: start, lte: end },
        isLocked: true,
      },
      orderBy: [{ staffId: 'asc' }, { attendanceDate: 'asc' }],
    });

    return {
      branchId,
      periodStart: start.toISOString().split('T')[0],
      periodEnd: end.toISOString().split('T')[0],
      approvedStaffCount: approvedStaffIds.length,
      records: lockedAttendance,
    };
  }
}

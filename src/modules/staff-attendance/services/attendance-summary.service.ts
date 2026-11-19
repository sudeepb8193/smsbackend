import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { AttendanceAccessHelper } from '../utils/attendance-access.util';
import { AttendanceService } from './attendance.service';

@Injectable()
export class AttendanceSummaryService {
  private readonly logger = new Logger(AttendanceSummaryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceService: AttendanceService,
  ) {}

  /**
   * Task 8.5: Get Monthly Attendance Summary (Precomputed read model)
   */
  async getMonthlySummary(
    user: AuthenticatedUser,
    organizationId: string,
    branchId: string,
    year: number,
    month: number,
  ) {
    const orgId = AttendanceAccessHelper.resolveOrgId(user, organizationId);

    // 1. Check for existing precomputed summary records
    const where: any = {
      summaryYear: year,
      summaryMonth: month,
      branchId,
      staff: {
        organizationId: orgId,
        deletedAt: null,
      },
    };

    let summaries = await this.prisma.sms_staffAttendanceMonthlySummary.findMany({
      where,
      include: {
        staff: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            profilePhotoUrl: true,
            homeBranch: { select: { id: true, name: true, code: true } },
            staffDesignations: {
              where: { isPrimary: true },
              select: { designationType: true, customLabel: true },
            },
          },
        },
      },
      orderBy: { staff: { fullName: 'asc' } },
    });

    // 2. If no summary records exist yet, generate them on the fly
    if (summaries.length === 0) {
      await this.recalculateMonthlySummary(user, orgId, branchId, year, month);
      summaries = await this.prisma.sms_staffAttendanceMonthlySummary.findMany({
        where,
        include: {
          staff: {
            select: {
              id: true,
              fullName: true,
              employeeCode: true,
              profilePhotoUrl: true,
              homeBranch: { select: { id: true, name: true, code: true } },
              staffDesignations: {
                where: { isPrimary: true },
                select: { designationType: true, customLabel: true },
              },
            },
          },
        },
        orderBy: { staff: { fullName: 'asc' } },
      });
    }

    const hasProvisional = summaries.some((s) => !s.isFinal);

    return {
      branchId,
      year,
      month,
      isFinal: !hasProvisional && summaries.length > 0,
      statusLabel: !hasProvisional && summaries.length > 0 ? 'Final — All periods approved' : 'Provisional — Pending final period approval',
      totalEmployees: summaries.length,
      data: summaries.map((s: any) => ({
        id: s.id,
        staffId: s.staffId,
        employeeCode: s.staff?.employeeCode,
        fullName: s.staff?.fullName,
        profilePhotoUrl: s.staff?.profilePhotoUrl,
        designation: s.staff?.staffDesignations?.[0]?.customLabel || s.staff?.staffDesignations?.[0]?.designationType || 'Staff',
        branch: s.staff?.homeBranch,
        totalWorkingDays: s.totalWorkingDays,
        year: s.summaryYear,
        month: s.summaryMonth,
        totalPresentDays: s.totalPresentDays,
        totalAbsentDays: s.totalAbsentDays,
        totalLateDays: s.totalLateDays,
        totalHalfDays: s.totalHalfDays,
        totalLeaveDays: s.totalLeaveDays,
        totalWorkedMinutes: s.totalWorkedMinutes,
        totalWorkedHoursFormatted: `${Math.floor(s.totalWorkedMinutes / 60)}h ${s.totalWorkedMinutes % 60}m`,
        totalOvertimeMinutes: s.totalOvertimeMinutes,
        totalOvertimeHoursFormatted: `${Math.floor(s.totalOvertimeMinutes / 60)}h ${s.totalOvertimeMinutes % 60}m`,
        isFinal: s.isFinal,
        generatedAt: s.generatedAt,
      })),
    };
  }

  /**
   * Task 8.5: Authoritative Recalculation of Monthly Summary
   */
  async recalculateMonthlySummary(
    user: AuthenticatedUser,
    organizationId: string,
    branchId: string,
    year: number,
    month: number,
  ) {
    const orgId = AttendanceAccessHelper.resolveOrgId(user, organizationId);

    // Compute start and end of target month
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0)); // last day of month

    // 1. Fetch staff assigned to branch
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
    });

    const staffIds = staffList.map((s) => s.id);

    // 2. Fetch all daily attendance in that month
    const attendanceRecords = await this.prisma.sms_staffAttendance.findMany({
      where: {
        staffId: { in: staffIds },
        branchId,
        attendanceDate: { gte: startDate, lte: endDate },
      },
    });

    // 3. Fetch period approvals for that month
    const approvals = await this.prisma.sms_attendancePeriodApprovals.findMany({
      where: {
        staffId: { in: staffIds },
        branchId,
        periodStart: { gte: startDate },
        periodEnd: { lte: endDate },
        status: 'approved',
      },
    });

    const approvedStaffSet = new Set(approvals.map((a) => a.staffId));

    // Check if month is completed in past
    const now = new Date();
    const isPastMonth = now > endDate;

    // 4. Upsert monthly summary per employee
    const summaries: any[] = [];
    for (const st of staffList) {
      const records = attendanceRecords.filter((r) => r.staffId === st.id);

      let presentDays = 0;
      let absentDays = 0;
      let lateDays = 0;
      let halfDays = 0;
      let leaveDays = 0;
      let workedMinutes = 0;
      let overtimeMinutes = 0;

      for (const r of records) {
        workedMinutes += r.workedMinutes || 0;
        overtimeMinutes += r.overtimeMinutes || 0;

        if (r.status === 'present') presentDays++;
        else if (r.status === 'late') lateDays++;
        else if (r.status === 'absent') absentDays++;
        else if (r.status === 'half_day') halfDays++;
        else if (r.status === 'on_leave') leaveDays++;
      }

      const totalWorkingDays = presentDays + lateDays + absentDays + halfDays;
      const isStaffPeriodApproved = approvedStaffSet.has(st.id);
      const isFinal = isPastMonth && isStaffPeriodApproved;

      const summary = await this.prisma.sms_staffAttendanceMonthlySummary.upsert({
        where: {
          staffId_summaryYear_summaryMonth: {
            staffId: st.id,
            summaryYear: year,
            summaryMonth: month,
          },
        },
        update: {
          branchId,
          totalWorkingDays,
          totalPresentDays: presentDays,
          totalAbsentDays: absentDays,
          totalLateDays: lateDays,
          totalHalfDays: halfDays,
          totalLeaveDays: leaveDays,
          totalWorkedMinutes: workedMinutes,
          totalOvertimeMinutes: overtimeMinutes,
          isFinal,
          generatedAt: new Date(),
        },
        create: {
          staffId: st.id,
          branchId,
          summaryYear: year,
          summaryMonth: month,
          totalWorkingDays,
          totalPresentDays: presentDays,
          totalAbsentDays: absentDays,
          totalLateDays: lateDays,
          totalHalfDays: halfDays,
          totalLeaveDays: leaveDays,
          totalWorkedMinutes: workedMinutes,
          totalOvertimeMinutes: overtimeMinutes,
          isFinal,
          generatedAt: new Date(),
        },
      });

      summaries.push(summary);
    }

    return {
      success: true,
      message: `Monthly attendance summary recalculated for ${summaries.length} employee(s).`,
      count: summaries.length,
      generatedAt: new Date(),
    };
  }

  /**
   * Task 8.5: Attendance Overview Dashboard KPIs
   */
  async getOverviewMetrics(
    user: AuthenticatedUser,
    organizationId: string,
    branchId?: string,
    date?: string,
  ) {
    const orgId = AttendanceAccessHelper.resolveOrgId(user, organizationId);
    const targetDate = date ? new Date(date) : new Date();
    const dateMidnight = this.attendanceService.normalizeDate(targetDate);

    // Staff filter
    const staffWhere: any = {
      organizationId: orgId,
      deletedAt: null,
      employmentStatus: 'active',
    };
    if (branchId) {
      staffWhere.OR = [
        { homeBranchId: branchId },
        { staffBranchAssignments: { some: { branchId } } },
      ];
    }

    const attendanceWhere: any = {
      attendanceDate: dateMidnight,
      staff: {
        organizationId: orgId,
        deletedAt: null,
      },
    };
    if (branchId) {
      attendanceWhere.branchId = branchId;
    }

    const [totalStaff, attendanceToday, pendingCorrections, pendingApprovals] =
      await Promise.all([
        this.prisma.sms_staff.count({ where: staffWhere }),
        this.prisma.sms_staffAttendance.findMany({
          where: attendanceWhere,
          select: {
            status: true,
            checkInAt: true,
            checkOutAt: true,
            workedMinutes: true,
            overtimeMinutes: true,
          },
        }),
        this.prisma.sms_staffAttendanceCorrections.count({
          where: {
            status: 'pending',
            staff: {
              organizationId: orgId,
              ...(branchId
                ? {
                    OR: [
                      { homeBranchId: branchId },
                      { staffBranchAssignments: { some: { branchId } } },
                    ],
                  }
                : {}),
            },
          },
        }),
        this.prisma.sms_attendancePeriodApprovals.count({
          where: {
            status: 'pending',
            ...(branchId ? { branchId } : {}),
            staff: { organizationId: orgId },
          },
        }),
      ]);

    let presentToday = 0;
    let lateToday = 0;
    let absentToday = 0;
    let onLeaveToday = 0;
    let halfDayToday = 0;
    let currentlyCheckedIn = 0;
    let totalWorkedMinutesToday = 0;
    let totalOvertimeMinutesToday = 0;

    for (const a of attendanceToday) {
      if (a.checkInAt && !a.checkOutAt) currentlyCheckedIn++;
      if (a.status === 'present') presentToday++;
      else if (a.status === 'late') lateToday++;
      else if (a.status === 'absent') absentToday++;
      else if (a.status === 'on_leave') onLeaveToday++;
      else if (a.status === 'half_day') halfDayToday++;

      totalWorkedMinutesToday += a.workedMinutes || 0;
      totalOvertimeMinutesToday += a.overtimeMinutes || 0;
    }

    // Punctuality rate = present / (present + late)
    const clockedCount = presentToday + lateToday + halfDayToday;
    const punctualityRate =
      clockedCount > 0 ? Math.round((presentToday / clockedCount) * 100) : 100;

    return {
      date: dateMidnight.toISOString().split('T')[0],
      totalStaff,
      presentToday,
      currentlyCheckedIn,
      lateToday,
      absentToday,
      onLeaveToday,
      halfDayToday,
      punctualityRate,
      pendingCorrections,
      pendingApprovals,
      totalWorkedHoursToday: `${Math.floor(totalWorkedMinutesToday / 60)}h ${totalWorkedMinutesToday % 60}m`,
      totalOvertimeHoursToday: `${Math.floor(totalOvertimeMinutesToday / 60)}h ${totalOvertimeMinutesToday % 60}m`,
    };
  }

  /**
   * Task 8.5: Export Monthly Attendance Report to CSV
   */
  async exportSummaryCsv(
    user: AuthenticatedUser,
    organizationId: string,
    branchId: string,
    year: number,
    month: number,
  ): Promise<string> {
    const summary = await this.getMonthlySummary(
      user,
      organizationId,
      branchId,
      year,
      month,
    );

    const headers = [
      'Employee Code',
      'Employee Name',
      'Designation',
      'Branch',
      'Year',
      'Month',
      'Total Working Days',
      'Present Days',
      'Absent Days',
      'Late Days',
      'Half Days',
      'Leave Days',
      'Total Worked Hours',
      'Total Overtime Hours',
      'Status',
      'Generated At',
    ];

    const lines = [headers.join(',')];

    for (const row of summary.data) {
      const line = [
        `"${row.employeeCode}"`,
        `"${row.fullName}"`,
        `"${row.designation}"`,
        `"${row.branch?.name || ''}"`,
        row.year || year,
        row.month || month,
        row.totalWorkingDays,
        row.totalPresentDays,
        row.totalAbsentDays,
        row.totalLateDays,
        row.totalHalfDays,
        row.totalLeaveDays,
        `"${row.totalWorkedHoursFormatted}"`,
        `"${row.totalOvertimeHoursFormatted}"`,
        row.isFinal ? '"Final (Approved)"' : '"Provisional (Pending)"',
        `"${new Date(row.generatedAt).toISOString()}"`,
      ];
      lines.push(line.join(','));
    }

    return lines.join('\n');
  }
}

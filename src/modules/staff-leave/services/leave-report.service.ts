import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { EffectivePermissionResolverService } from '../../role-permission/services/effective-permission-resolver.service';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { LeaveAccessHelper } from '../utils/leave-access.util';
import { QueryLeaveReportDto } from '../dto/query-leave-report.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class LeaveReportService {
  private readonly logger = new Logger(LeaveReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionResolver: EffectivePermissionResolverService,
  ) {}

  /**
   * Task 9.2 & Section 17: Aggregate Leave Usage & Balance Report
   */
  async getLeaveUsageSummary(
    user: AuthenticatedUser,
    query: QueryLeaveReportDto,
    queryOrgId?: string,
  ) {
    const orgId = LeaveAccessHelper.resolveOrgId(user, queryOrgId);
    await LeaveAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      orgId,
      'staff_leave.view',
      query.branchId,
    );

    const year = query.year || new Date().getFullYear();

    // 1. Fetch balance aggregates grouped by leave type
    const balances = await this.prisma.sms_staffLeaveBalances.findMany({
      where: {
        balanceYear: year,
        staff: {
          organizationId: orgId,
          deletedAt: null,
          ...(query.branchId ? { homeBranchId: query.branchId } : {}),
          ...(query.staffId ? { id: query.staffId } : {}),
        },
      },
      include: {
        leaveType: {
          select: { id: true, name: true, code: true, isPaid: true },
        },
        staff: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            homeBranch: { select: { id: true, name: true } },
          },
        },
      },
    });

    let totalEntitled = 0;
    let totalAccrued = 0;
    let totalCarried = 0;
    let totalUsed = 0;
    let totalAdjusted = 0;
    let totalAvailable = 0;

    const leaveTypeSummaryMap = new Map<string, any>();
    const staffSummaryMap = new Map<string, any>();

    for (const b of balances) {
      const opening = Number(b.openingBalanceDays) || 0;
      const carried = Number(b.carriedForwardDays) || 0;
      const accrued = Number(b.accruedDays) || 0;
      const used = Number(b.usedDays) || 0;
      const adjustment = Number(b.manualAdjustmentDays) || 0;
      const available = opening + carried + accrued + adjustment - used;

      totalEntitled += opening;
      totalAccrued += accrued;
      totalCarried += carried;
      totalUsed += used;
      totalAdjusted += adjustment;
      totalAvailable += available;

      // Group by Leave Type
      const ltId = b.leaveTypeId;
      if (!leaveTypeSummaryMap.has(ltId)) {
        leaveTypeSummaryMap.set(ltId, {
          leaveTypeId: ltId,
          leaveTypeName: b.leaveType.name,
          leaveTypeCode: b.leaveType.code,
          isPaid: b.leaveType.isPaid,
          totalEntitled: 0,
          totalAccrued: 0,
          totalCarried: 0,
          totalUsed: 0,
          totalAvailable: 0,
          staffCount: 0,
        });
      }
      const ltEntry = leaveTypeSummaryMap.get(ltId);
      ltEntry.totalEntitled += opening;
      ltEntry.totalAccrued += accrued;
      ltEntry.totalCarried += carried;
      ltEntry.totalUsed += used;
      ltEntry.totalAvailable += available;
      ltEntry.staffCount += 1;

      // Group by Staff
      const stId = b.staffId;
      if (!staffSummaryMap.has(stId)) {
        staffSummaryMap.set(stId, {
          staffId: stId,
          staffName: b.staff.fullName,
          employeeCode: b.staff.employeeCode,
          branchName: b.staff.homeBranch?.name || 'N/A',
          totalEntitled: 0,
          totalUsed: 0,
          totalAvailable: 0,
          balances: [],
        });
      }
      const stEntry = staffSummaryMap.get(stId);
      stEntry.totalEntitled += opening + accrued + carried;
      stEntry.totalUsed += used;
      stEntry.totalAvailable += available;
      stEntry.balances.push({
        leaveTypeName: b.leaveType.name,
        isPaid: b.leaveType.isPaid,
        used,
        available,
      });
    }

    // 2. Request status breakdown for the year
    const requestStats = await this.prisma.sms_staffLeaveRequests.groupBy({
      by: ['status'],
      where: {
        staff: {
          organizationId: orgId,
          ...(query.branchId ? { homeBranchId: query.branchId } : {}),
          ...(query.staffId ? { id: query.staffId } : {}),
        },
        startDate: {
          gte: new Date(Date.UTC(year, 0, 1)),
          lte: new Date(Date.UTC(year, 11, 31)),
        },
      },
      _count: { id: true },
      _sum: { totalDays: true },
    });

    const requestStatusBreakdown: Record<string, { count: number; totalDays: number }> = {
      pending: { count: 0, totalDays: 0 },
      approved: { count: 0, totalDays: 0 },
      rejected: { count: 0, totalDays: 0 },
      cancelled: { count: 0, totalDays: 0 },
    };

    for (const r of requestStats) {
      requestStatusBreakdown[r.status] = {
        count: r._count.id,
        totalDays: Number(r._sum.totalDays) || 0,
      };
    }

    // Paid vs Unpaid breakdown for approved leaves (Payroll readiness)
    const approvedRequests = await this.prisma.sms_staffLeaveRequests.findMany({
      where: {
        status: 'approved',
        staff: {
          organizationId: orgId,
          ...(query.branchId ? { homeBranchId: query.branchId } : {}),
          ...(query.staffId ? { id: query.staffId } : {}),
        },
        startDate: {
          gte: new Date(Date.UTC(year, 0, 1)),
          lte: new Date(Date.UTC(year, 11, 31)),
        },
      },
      select: {
        totalDays: true,
        leaveType: { select: { isPaid: true } },
      },
    });

    let paidLeaveDays = 0;
    let unpaidLeaveDays = 0;
    for (const ar of approvedRequests) {
      if (ar.leaveType.isPaid) {
        paidLeaveDays += Number(ar.totalDays);
      } else {
        unpaidLeaveDays += Number(ar.totalDays);
      }
    }

    return {
      year,
      totals: {
        totalEntitled: Math.round(totalEntitled * 10) / 10,
        totalAccrued: Math.round(totalAccrued * 10) / 10,
        totalCarried: Math.round(totalCarried * 10) / 10,
        totalUsed: Math.round(totalUsed * 10) / 10,
        totalAdjusted: Math.round(totalAdjusted * 10) / 10,
        totalAvailable: Math.round(totalAvailable * 10) / 10,
        paidLeaveDays: Math.round(paidLeaveDays * 10) / 10,
        unpaidLeaveDays: Math.round(unpaidLeaveDays * 10) / 10,
      },
      requestsBreakdown: requestStatusBreakdown,
      byLeaveType: Array.from(leaveTypeSummaryMap.values()),
      byStaff: Array.from(staffSummaryMap.values()),
    };
  }

  /**
   * Section 17: CSV Export of Leave Data
   */
  async generateLeaveCsv(
    user: AuthenticatedUser,
    query: QueryLeaveReportDto,
    queryOrgId?: string,
  ): Promise<string> {
    const orgId = LeaveAccessHelper.resolveOrgId(user, queryOrgId);
    await LeaveAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      orgId,
      'staff_leave.export',
      query.branchId,
    );

    const year = query.year || new Date().getFullYear();

    const balances = await this.prisma.sms_staffLeaveBalances.findMany({
      where: {
        balanceYear: year,
        staff: {
          organizationId: orgId,
          deletedAt: null,
          ...(query.branchId ? { homeBranchId: query.branchId } : {}),
        },
      },
      include: {
        staff: {
          select: {
            employeeCode: true,
            fullName: true,
            homeBranch: { select: { name: true } },
          },
        },
        leaveType: {
          select: { name: true, code: true, isPaid: true },
        },
      },
      orderBy: [{ staff: { fullName: 'asc' } }, { leaveType: { name: 'asc' } }],
    });

    const headers = [
      'Employee Code',
      'Employee Name',
      'Home Branch',
      'Leave Type',
      'Code',
      'Paid / Unpaid',
      'Year',
      'Opening Balance',
      'Carried Forward',
      'Accrued',
      'Used',
      'Adjustment',
      'Available Balance',
    ];

    const rows = balances.map((b) => {
      const opening = Number(b.openingBalanceDays) || 0;
      const carried = Number(b.carriedForwardDays) || 0;
      const accrued = Number(b.accruedDays) || 0;
      const used = Number(b.usedDays) || 0;
      const adj = Number(b.manualAdjustmentDays) || 0;
      const available = opening + carried + accrued + adj - used;

      return [
        `"${b.staff.employeeCode}"`,
        `"${b.staff.fullName}"`,
        `"${b.staff.homeBranch?.name || 'N/A'}"`,
        `"${b.leaveType.name}"`,
        `"${b.leaveType.code}"`,
        b.leaveType.isPaid ? 'PAID' : 'UNPAID',
        year,
        opening,
        carried,
        accrued,
        used,
        adj,
        Math.round(available * 10) / 10,
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }
}

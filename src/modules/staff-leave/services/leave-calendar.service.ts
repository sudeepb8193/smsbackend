import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { EffectivePermissionResolverService } from '../../role-permission/services/effective-permission-resolver.service';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { LeaveAccessHelper } from '../utils/leave-access.util';
import { LeaveCalculatorUtil } from '../utils/leave-calculator.util';
import { QueryCalendarDto } from '../dto/query-calendar.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class LeaveCalendarService {
  private readonly logger = new Logger(LeaveCalendarService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionResolver: EffectivePermissionResolverService,
  ) {}

  /**
   * Task 9.5: Team Leave Calendar Feed (Leaves, Holidays, Blackout Periods)
   */
  async getCalendarEvents(
    user: AuthenticatedUser,
    query: QueryCalendarDto,
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

    // Default to current month window if dates not specified
    const now = new Date();
    const start = query.startDate
      ? LeaveCalculatorUtil.normalizeDate(query.startDate)
      : new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    const end = query.endDate
      ? LeaveCalculatorUtil.normalizeDate(query.endDate)
      : new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0));

    // Determine if user has permission to see sensitive medical reasons
    const roles = (user.roles || []).map((r) => r.toLowerCase().replace(/_/g, '-'));
    const isManager = roles.includes('owner') || roles.includes('branch-manager') || roles.includes('super-admin');

    // 1. Fetch Leave Requests
    const leaveWhere: Prisma.sms_staffLeaveRequestsWhereInput = {
      staff: {
        organizationId: orgId,
        deletedAt: null,
        ...(query.branchId ? { homeBranchId: query.branchId } : {}),
      },
      status: { in: ['approved', 'pending'] },
      startDate: { lte: end },
      endDate: { gte: start },
    };

    if (query.staffId) {
      leaveWhere.staffId = query.staffId;
    }

    const leaves = await this.prisma.sms_staffLeaveRequests.findMany({
      where: leaveWhere,
      include: {
        staff: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            profilePhotoUrl: true,
            homeBranch: { select: { id: true, name: true, code: true } },
          },
        },
        leaveType: {
          select: {
            id: true,
            name: true,
            code: true,
            isPaid: true,
          },
        },
      },
      orderBy: { startDate: 'asc' },
    });

    const leaveEvents = leaves.map((l) => ({
      id: l.id,
      type: 'LEAVE',
      title: `${l.staff.fullName} — ${l.leaveType.name}`,
      startDate: l.startDate.toISOString().split('T')[0],
      endDate: l.endDate.toISOString().split('T')[0],
      status: l.status,
      isHalfDay: l.isHalfDay,
      halfDayPeriod: l.halfDayPeriod,
      totalDays: Number(l.totalDays),
      staff: l.staff,
      leaveType: l.leaveType,
      reason: isManager ? l.reason : 'Personal Leave', // Mask sensitive reason for peers
    }));

    // 2. Fetch Organization & Branch Holidays (Module 01 integration)
    const holidayWhere: Prisma.sms_holidaysWhereInput = {
      organizationId: orgId,
      status: 'active',
      holidayDate: { gte: start, lte: end },
      ...(query.branchId
        ? { OR: [{ branchId: null }, { branchId: query.branchId }] }
        : {}),
    };

    const holidays = await this.prisma.sms_holidays.findMany({
      where: holidayWhere,
      include: {
        branch: { select: { id: true, name: true, code: true } },
      },
      orderBy: { holidayDate: 'asc' },
    });

    const holidayEvents = holidays.map((h) => ({
      id: h.id,
      type: 'HOLIDAY',
      title: `Holiday: ${h.name}`,
      startDate: h.holidayDate.toISOString().split('T')[0],
      endDate: h.holidayDate.toISOString().split('T')[0],
      description: h.description,
      branch: h.branch,
      isAllBranches: !h.branchId,
    }));

    // 3. Fetch Blackout Periods (Task 9.5)
    const blackoutWhere: Prisma.sms_leaveBlackoutPeriodsWhereInput = {
      organizationId: orgId,
      startDate: { lte: end },
      endDate: { gte: start },
      ...(query.branchId
        ? { OR: [{ branchId: null }, { branchId: query.branchId }] }
        : {}),
    };

    const blackouts = await this.prisma.sms_leaveBlackoutPeriods.findMany({
      where: blackoutWhere,
      include: {
        branch: { select: { id: true, name: true, code: true } },
      },
      orderBy: { startDate: 'asc' },
    });

    const blackoutEvents = blackouts.map((b) => ({
      id: b.id,
      type: 'BLACKOUT',
      title: `Blackout: ${b.name}`,
      startDate: b.startDate.toISOString().split('T')[0],
      endDate: b.endDate.toISOString().split('T')[0],
      restrictionType: b.restrictionType,
      maxPercentageStaffOnLeave: b.maxPercentageStaffOnLeave ? Number(b.maxPercentageStaffOnLeave) : null,
      reason: b.reason,
      branch: b.branch,
      isAllBranches: !b.branchId,
    }));

    const colorMap: Record<string, string> = {
      AL: '#3b82f6',
      SL: '#ef4444',
      CL: '#f59e0b',
      ML: '#ec4899',
      PL: '#8b5cf6',
      UL: '#6b7280',
    };

    const allEvents = [
      ...leaveEvents.map((l) => ({ ...l, colorCode: colorMap[l.leaveType?.code] || '#3b82f6' })),
      ...holidayEvents.map((h) => ({ ...h, colorCode: '#10b981' })),
      ...blackoutEvents.map((b) => ({ ...b, colorCode: '#f43f5e' })),
    ];

    return {
      window: {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      },
      events: allEvents,
      data: allEvents,
      leaves: leaveEvents,
      holidays: holidayEvents,
      blackoutPeriods: blackoutEvents,
      totalEvents: allEvents.length,
    };
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { EffectivePermissionResolverService } from '../../role-permission/services/effective-permission-resolver.service';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { LeaveAccessHelper } from '../utils/leave-access.util';
import { LeaveCalculatorUtil } from '../utils/leave-calculator.util';
import { LeaveBalanceService } from './leave-balance.service';
import { LeaveNotificationService } from './leave-notification.service';
import { ReviewLeaveDto } from '../dto/review-leave.dto';
import { Prisma } from '@prisma/client';

import { QueryApprovalQueueDto } from '../dto/query-approvals.dto';

@Injectable()
export class LeaveApprovalService {
  private readonly logger = new Logger(LeaveApprovalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionResolver: EffectivePermissionResolverService,
    private readonly balanceService: LeaveBalanceService,
    private readonly notificationService: LeaveNotificationService,
  ) {}

  /**
   * Task 9.4: Pending Approval Queue for Authorized Managers (Paginated, Searchable & Sorted)
   */
  async getPendingApprovalQueue(
    user: AuthenticatedUser,
    queryOrBranchId?: QueryApprovalQueueDto | string,
    queryOrgId?: string,
  ) {
    const isDto = queryOrBranchId && typeof queryOrBranchId === 'object';
    const query: QueryApprovalQueueDto = isDto ? queryOrBranchId : {};
    const branchId = isDto ? query.branchId : (queryOrBranchId as string | undefined);
    const orgId = LeaveAccessHelper.resolveOrgId(user, queryOrgId);

    await LeaveAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      orgId,
      'staff_leave.approve',
      branchId,
    );

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const staffWhere: Prisma.sms_staffWhereInput = {
      organizationId: orgId,
      deletedAt: null,
      ...(branchId ? { homeBranchId: branchId } : {}),
    };

    if (query.search) {
      const s = query.search.trim();
      staffWhere.OR = [
        { fullName: { contains: s, mode: 'insensitive' } },
        { employeeCode: { contains: s, mode: 'insensitive' } },
      ];
    }

    const where: Prisma.sms_staffLeaveRequestsWhereInput = {
      status: 'pending',
      staff: staffWhere,
    };

    const sortOrder: Prisma.SortOrder = query.sortOrder === 'desc' ? 'desc' : 'asc';
    let orderBy: Prisma.sms_staffLeaveRequestsOrderByWithRelationInput;
    switch (query.sortBy) {
      case 'startDate':
        orderBy = { startDate: sortOrder };
        break;
      case 'endDate':
        orderBy = { endDate: sortOrder };
        break;
      case 'totalDays':
        orderBy = { totalDays: sortOrder };
        break;
      case 'staffName':
        orderBy = { staff: { fullName: sortOrder } };
        break;
      case 'appliedAt':
      default:
        orderBy = { appliedAt: sortOrder };
        break;
    }

    const [requests, total] = await Promise.all([
      this.prisma.sms_staffLeaveRequests.findMany({
        where,
        skip,
        take: limit,
        orderBy,
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
              take: 1,
            },
          },
        },
        leaveType: {
          select: {
            id: true,
            name: true,
            code: true,
            isPaid: true,
            minNoticeDays: true,
            documentRequiredAfterDays: true,
          },
        },
        leaveApprovalLogs: {
          orderBy: { actionAt: 'asc' },
          include: { actor: { select: { displayName: true } } },
        },
      },
    }),
    this.prisma.sms_staffLeaveRequests.count({ where }),
  ]);

    // Enrich requests with live balance and conflict context
    const enriched = await Promise.all(
      requests.map(async (r) => {
        const year = r.startDate.getUTCFullYear();
        const bal = await this.prisma.sms_staffLeaveBalances.findUnique({
          where: {
            staffId_leaveTypeId_balanceYear: {
              staffId: r.staffId,
              leaveTypeId: r.leaveTypeId,
              balanceYear: year,
            },
          },
        });

        const available = bal ? this.balanceService.calculateAvailableBalance(bal) : 0;
        const requested = Number(r.totalDays);
        const shortfall = requested > available ? requested - available : 0;

        return {
          ...r,
          totalDays: requested,
          designationName:
            r.staff.staffDesignations?.[0]?.customLabel ||
            r.staff.staffDesignations?.[0]?.designationType ||
            'Stylist',
          balanceMetrics: {
            availableBalance: available,
            shortfall,
          },
        };
      }),
    );

    return {
      count: enriched.length,
      total,
      items: enriched,
      data: enriched,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Task 9.4: Approve Leave Request (Atomic Concurrency-Safe Transaction)
   */
  async approveLeaveRequest(
    user: AuthenticatedUser,
    id: string,
    dto: ReviewLeaveDto,
    queryOrgId?: string,
  ) {
    const orgId = LeaveAccessHelper.resolveOrgId(user, queryOrgId);

    const request = await this.prisma.sms_staffLeaveRequests.findUnique({
      where: { id },
      include: {
        staff: { select: { id: true, organizationId: true, fullName: true, homeBranchId: true, userId: true } },
        leaveType: { select: { id: true, name: true, isPaid: true } },
      },
    });

    if (!request || request.staff.organizationId !== orgId) {
      throw new NotFoundException({
        code: 'REQUEST_NOT_FOUND',
        message: 'Leave request not found',
      });
    }

    // Authorization
    await LeaveAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      orgId,
      'staff_leave.approve',
      request.staff.homeBranchId,
    );

    if (request.status !== 'pending') {
      throw new ConflictException({
        code: 'INVALID_STATUS_TRANSITION',
        message: `Cannot approve request with current status '${request.status}'`,
      });
    }

    const requestedDays = Number(request.totalDays);
    const balanceYear = request.startDate.getUTCFullYear();

    // Execute atomic state transition and balance deduction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Atomic status update with conditional guard
      const updateCount = await tx.sms_staffLeaveRequests.updateMany({
        where: { id, status: 'pending' },
        data: { status: 'approved' },
      });

      if (updateCount.count === 0) {
        throw new ConflictException({
          code: 'CONCURRENT_APPROVAL_CONFLICT',
          message: 'This leave request has already been processed by another manager',
        });
      }

      // 2. Fetch or create balance record
      let balance = await tx.sms_staffLeaveBalances.findUnique({
        where: {
          staffId_leaveTypeId_balanceYear: {
            staffId: request.staffId,
            leaveTypeId: request.leaveTypeId,
            balanceYear,
          },
        },
      });

      if (!balance) {
        const leaveType = await tx.sms_leaveTypes.findUnique({
          where: { id: request.leaveTypeId },
        });
        const firstEmployment = await tx.sms_staffEmploymentHistory.findFirst({
          where: { staffId: request.staffId },
          orderBy: { effectiveFrom: 'asc' },
        });
        const staff = await tx.sms_staff.findUnique({
          where: { id: request.staffId },
        });
        const joiningDate = firstEmployment?.effectiveFrom || staff?.createdAt || new Date();
        let openingDays = 0;
        const annualDays = Number(leaveType?.annualEntitlementDays) || 0;
        if (leaveType?.accrualMethod === 'annual_grant') {
          openingDays = LeaveCalculatorUtil.calculateProRataEntitlement(
            new Date(joiningDate),
            annualDays,
            balanceYear,
          );
        }

        balance = await tx.sms_staffLeaveBalances.create({
          data: {
            staffId: request.staffId,
            leaveTypeId: request.leaveTypeId,
            balanceYear,
            openingBalanceDays: new Prisma.Decimal(openingDays),
            carriedForwardDays: new Prisma.Decimal(0),
            accruedDays: new Prisma.Decimal(0),
            usedDays: new Prisma.Decimal(0),
            manualAdjustmentDays: new Prisma.Decimal(0),
            closingBalanceDays: new Prisma.Decimal(openingDays),
          },
        });
      }

      const beforeBalance = this.balanceService.calculateAvailableBalance(balance);
      const currentUsed = Number(balance.usedDays) || 0;
      const newUsed = Math.round((currentUsed + requestedDays) * 10) / 10;
      const newClosing = Math.round((beforeBalance - requestedDays) * 10) / 10;

      // 3. Update Balance
      const updatedBalance = await tx.sms_staffLeaveBalances.update({
        where: { id: balance.id },
        data: {
          usedDays: new Prisma.Decimal(newUsed),
          closingBalanceDays: new Prisma.Decimal(newClosing),
        },
      });

      // 4. Record transaction in ledger
      await this.balanceService.recordBalanceTransaction({
        balanceId: balance.id,
        staffId: request.staffId,
        leaveTypeId: request.leaveTypeId,
        balanceYear,
        transactionType: 'LEAVE_USAGE',
        amount: requestedDays,
        beforeBalance,
        afterBalance: newClosing,
        reason: `Approved leave request #${id.slice(0, 8)} (${request.leaveType.name})`,
        actorId: user.id,
      });

      // 5. Append Approval Log
      const log = await tx.sms_leaveApprovalLogs.create({
        data: {
          leaveRequestId: id,
          action: 'approved',
          actorId: user.id,
          notes: dto.notes || 'Leave request approved',
        },
      });

      return { updatedBalance, log };
    });

    // Notify employee
    if (request.staff.userId) {
      await this.notificationService.dispatch({
        organizationId: orgId,
        recipientUserIds: [request.staff.userId],
        eventType: 'LEAVE_APPROVED',
        title: 'Leave Request Approved',
        message: `Your leave request for ${requestedDays} day(s) from ${request.startDate.toISOString().split('T')[0]} to ${request.endDate.toISOString().split('T')[0]} has been approved.`,
        metadata: { leaveRequestId: id },
      });
    }

    await LeaveAccessHelper.recordAuditLog(
      this.prisma,
      orgId,
      user.id,
      'LEAVE_REQUEST_APPROVED',
      { status: 'pending' },
      { id, status: 'approved', notes: dto.notes },
    );

    return {
      message: 'Leave request approved successfully',
      requestId: id,
      status: 'approved',
      balanceDeducted: requestedDays,
    };
  }

  /**
   * Task 9.4: Reject Leave Request (With Mandatory / Auditable Notes & No Balance Deduction)
   */
  async rejectLeaveRequest(
    user: AuthenticatedUser,
    id: string,
    dto: ReviewLeaveDto,
    queryOrgId?: string,
  ) {
    const orgId = LeaveAccessHelper.resolveOrgId(user, queryOrgId);

    const request = await this.prisma.sms_staffLeaveRequests.findUnique({
      where: { id },
      include: {
        staff: { select: { id: true, organizationId: true, fullName: true, homeBranchId: true, userId: true } },
        leaveType: { select: { id: true, name: true } },
      },
    });

    if (!request || request.staff.organizationId !== orgId) {
      throw new NotFoundException({
        code: 'REQUEST_NOT_FOUND',
        message: 'Leave request not found',
      });
    }

    await LeaveAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      orgId,
      'staff_leave.reject',
      request.staff.homeBranchId,
    );

    if (request.status !== 'pending') {
      throw new ConflictException({
        code: 'INVALID_STATUS_TRANSITION',
        message: `Cannot reject request with current status '${request.status}'`,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const updateCount = await tx.sms_staffLeaveRequests.updateMany({
        where: { id, status: 'pending' },
        data: { status: 'rejected' },
      });

      if (updateCount.count === 0) {
        throw new ConflictException({
          code: 'CONCURRENT_APPROVAL_CONFLICT',
          message: 'This leave request has already been processed by another manager',
        });
      }

      await tx.sms_leaveApprovalLogs.create({
        data: {
          leaveRequestId: id,
          action: 'rejected',
          actorId: user.id,
          notes: dto.notes || 'Leave request rejected',
        },
      });
    });

    // Notify employee
    if (request.staff.userId) {
      await this.notificationService.dispatch({
        organizationId: orgId,
        recipientUserIds: [request.staff.userId],
        eventType: 'LEAVE_REJECTED',
        title: 'Leave Request Rejected',
        message: `Your leave request for ${request.leaveType.name} from ${request.startDate.toISOString().split('T')[0]} to ${request.endDate.toISOString().split('T')[0]} was rejected. Reason: ${dto.notes || 'No reason provided.'}`,
        metadata: { leaveRequestId: id, reason: dto.notes },
      });
    }

    await LeaveAccessHelper.recordAuditLog(
      this.prisma,
      orgId,
      user.id,
      'LEAVE_REQUEST_REJECTED',
      { status: 'pending' },
      { id, status: 'rejected', notes: dto.notes },
    );

    return {
      message: 'Leave request rejected',
      requestId: id,
      status: 'rejected',
    };
  }

  /**
   * Task 9.4: Approval Timeline / Audit History for a Request
   */
  async getApprovalHistory(
    user: AuthenticatedUser,
    requestId: string,
    queryOrgId?: string,
  ) {
    const orgId = LeaveAccessHelper.resolveOrgId(user, queryOrgId);

    const request = await this.prisma.sms_staffLeaveRequests.findUnique({
      where: { id: requestId },
      include: {
        staff: { select: { organizationId: true, homeBranchId: true, userId: true } },
      },
    });

    if (!request || request.staff.organizationId !== orgId) {
      throw new NotFoundException({
        code: 'REQUEST_NOT_FOUND',
        message: 'Leave request not found',
      });
    }

    const logs = await this.prisma.sms_leaveApprovalLogs.findMany({
      where: { leaveRequestId: requestId },
      orderBy: { actionAt: 'asc' },
      include: {
        actor: {
          select: {
            id: true,
            displayName: true,
            email: true,
            profilePhotoUrl: true,
          },
        },
      },
    });

    return logs;
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { EffectivePermissionResolverService } from '../../role-permission/services/effective-permission-resolver.service';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { LeaveAccessHelper } from '../utils/leave-access.util';
import { LeaveCalculatorUtil } from '../utils/leave-calculator.util';
import { LeaveBalanceService } from './leave-balance.service';
import { LeaveBlackoutService } from './leave-blackout.service';
import { LeaveNotificationService } from './leave-notification.service';
import { ApplyLeaveDto } from '../dto/apply-leave.dto';
import { CancelLeaveDto } from '../dto/cancel-leave.dto';
import { QueryLeaveRequestDto } from '../dto/query-leave-request.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class LeaveRequestService {
  private readonly logger = new Logger(LeaveRequestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionResolver: EffectivePermissionResolverService,
    private readonly balanceService: LeaveBalanceService,
    private readonly blackoutService: LeaveBlackoutService,
    private readonly notificationService: LeaveNotificationService,
  ) {}

  /**
   * Task 9.3: Apply for Leave (Staff Self-Service or Manager Entry)
   */
  async applyForLeave(
    user: AuthenticatedUser,
    dto: ApplyLeaveDto,
    queryOrgId?: string,
  ) {
    const orgId = LeaveAccessHelper.resolveOrgId(user, queryOrgId);

    // Resolve target staff ID
    let targetStaffId = dto.staffId;
    if (!targetStaffId) {
      const selfStaff = await LeaveAccessHelper.getStaffForUser(this.prisma, user.id, orgId);
      targetStaffId = selfStaff.id;
    }

    const staff = await LeaveAccessHelper.validateStaff(this.prisma, targetStaffId, orgId);

    // Validate access permission
    await LeaveAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      orgId,
      'staff_leave.create',
      staff.homeBranchId,
      staff,
    );

    const start = LeaveCalculatorUtil.normalizeDate(dto.startDate);
    const end = LeaveCalculatorUtil.normalizeDate(dto.endDate);

    if (end < start) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: 'End date cannot precede start date',
      });
    }

    // Fetch Leave Type
    const leaveType = await this.prisma.sms_leaveTypes.findFirst({
      where: {
        id: dto.leaveTypeId,
        organizationId: orgId,
        status: 'active',
      },
    });

    if (!leaveType) {
      throw new NotFoundException({
        code: 'LEAVE_TYPE_INACTIVE',
        message: 'The requested leave type is inactive or does not exist',
      });
    }

    // Gender check
    if (leaveType.applicableGender !== 'all' && staff.gender) {
      if (leaveType.applicableGender !== staff.gender) {
        throw new BadRequestException({
          code: 'GENDER_INELIGIBLE',
          message: `This leave type is only applicable to ${leaveType.applicableGender} staff members`,
        });
      }
    }

    // 1. Backend Leave Duration Calculation (Authoritative)
    const calculation = await LeaveCalculatorUtil.calculateLeaveDuration(
      this.prisma,
      staff.id,
      orgId,
      staff.homeBranchId,
      start,
      end,
      dto.isHalfDay,
    );

    const totalDays = calculation.totalRequestedDays;

    if (totalDays <= 0) {
      throw new BadRequestException({
        code: 'NO_WORKING_DAYS',
        message: 'The selected date range contains only holidays and scheduled non-working days',
      });
    }

    // 2. Minimum Advance Notice Validation
    const warnings: string[] = [];
    const minNotice = leaveType.minNoticeDays || 0;
    if (minNotice > 0) {
      const today = LeaveCalculatorUtil.normalizeDate(new Date());
      const diffTime = start.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays < minNotice) {
        warnings.push(
          `Notice period warning: This leave type requires at least ${minNotice} day(s) advance notice (requested with ${Math.max(
            0,
            diffDays,
          )} days notice).`,
        );
      }
    }

    // 3. Mandatory Documentation Threshold Check
    const docThreshold = leaveType.documentRequiredAfterDays !== null
      ? Number(leaveType.documentRequiredAfterDays)
      : null;

    if (docThreshold !== null && totalDays > docThreshold) {
      if (!dto.supportingDocumentUrl || dto.supportingDocumentUrl.trim().length === 0) {
        throw new BadRequestException({
          code: 'DOCUMENT_REQUIRED',
          message: `Supporting documentation (e.g. medical certificate) is mandatory for leave requests exceeding ${docThreshold} day(s)`,
        });
      }
    }

    // 4. Blackout Period Validation
    const blackoutCheck = await this.blackoutService.validateLeaveDatesAgainstBlackout(
      orgId,
      staff.homeBranchId,
      leaveType.id,
      start,
      end,
    );

    if (blackoutCheck.isBlocked) {
      throw new BadRequestException({
        code: 'BLACKOUT_RESTRICTION',
        message: blackoutCheck.warnings.join(' '),
      });
    }
    if (blackoutCheck.warnings.length > 0) {
      warnings.push(...blackoutCheck.warnings);
    }

    // 5. Overlapping Request Validation (Pending or Approved)
    const overlap = await this.prisma.sms_staffLeaveRequests.findFirst({
      where: {
        staffId: staff.id,
        status: { in: ['pending', 'approved'] },
        startDate: { lte: end },
        endDate: { gte: start },
      },
      include: {
        leaveType: { select: { name: true } },
      },
    });

    if (overlap) {
      throw new ConflictException({
        code: 'OVERLAPPING_LEAVE_REQUEST',
        message: `You already have an existing ${overlap.status} leave request (${overlap.leaveType?.name}) from ${overlap.startDate.toISOString().split('T')[0]} to ${overlap.endDate.toISOString().split('T')[0]}`,
      });
    }

    // 6. Balance & Shortfall Verification
    const balanceYear = start.getUTCFullYear();
    let balance = await this.prisma.sms_staffLeaveBalances.findUnique({
      where: {
        staffId_leaveTypeId_balanceYear: {
          staffId: staff.id,
          leaveTypeId: leaveType.id,
          balanceYear,
        },
      },
    });

    if (!balance) {
      await this.balanceService.ensureStaffBalances(staff, orgId, balanceYear, user.id);
      balance = await this.prisma.sms_staffLeaveBalances.findUnique({
        where: {
          staffId_leaveTypeId_balanceYear: {
            staffId: staff.id,
            leaveTypeId: leaveType.id,
            balanceYear,
          },
        },
      });
    }

    let availableBalance = 0;
    if (balance) {
      availableBalance = this.balanceService.calculateAvailableBalance(balance);
    }

    let shortfall = 0;
    if (totalDays > availableBalance) {
      shortfall = Math.round((totalDays - availableBalance) * 10) / 10;
      warnings.push(
        `Balance warning: Requested duration (${totalDays} days) exceeds available balance (${availableBalance} days). Deficit shortfall: ${shortfall} days.`,
      );
    }

    // 7. Check Scheduling Conflicts (Module 07 integration)
    const shiftConflict = await this.prisma.sms_staffScheduleOverrides.findFirst({
      where: {
        staffId: staff.id,
        overrideDate: { gte: start, lte: end },
        approvalStatus: 'approved',
      },
    });

    if (shiftConflict) {
      warnings.push(
        `Scheduling notice: Staff member has an approved schedule override on ${shiftConflict.overrideDate.toISOString().split('T')[0]} (${shiftConflict.overrideType}).`,
      );
    }

    // 8. Create Leave Request in Database
    const created = await this.prisma.sms_staffLeaveRequests.create({
      data: {
        staffId: staff.id,
        leaveTypeId: leaveType.id,
        startDate: start,
        endDate: end,
        isHalfDay: dto.isHalfDay ?? false,
        halfDayPeriod: dto.isHalfDay ? dto.halfDayPeriod || 'morning' : null,
        totalDays: new Prisma.Decimal(totalDays),
        reason: dto.reason.trim(),
        supportingDocumentUrl: dto.supportingDocumentUrl || null,
        status: 'pending',
      },
      include: {
        staff: { select: { id: true, fullName: true, employeeCode: true } },
        leaveType: { select: { id: true, name: true, code: true, isPaid: true } },
      },
    });

    // 9. Append to Leave Approval Log
    await this.prisma.sms_leaveApprovalLogs.create({
      data: {
        leaveRequestId: created.id,
        action: 'submitted',
        actorId: user.id,
        notes: `Leave requested for ${totalDays} day(s). ${warnings.length > 0 ? 'Warnings: ' + warnings.join('; ') : ''}`,
      },
    });

    // Notify Branch Managers & Owners
    const managers = await this.prisma.sms_branchManagerAssignments.findMany({
      where: { branchId: staff.homeBranchId },
      include: { staff: { select: { userId: true } } },
    });

    const recipientUserIds = managers
      .map((m) => m.staff.userId)
      .filter((uid): uid is string => Boolean(uid));

    await this.notificationService.dispatch({
      organizationId: orgId,
      recipientUserIds,
      eventType: 'LEAVE_SUBMITTED',
      title: 'New Leave Request Submitted',
      message: `${staff.fullName} submitted a leave request for ${totalDays} day(s) (${leaveType.name}).`,
      metadata: { leaveRequestId: created.id, staffId: staff.id },
    });

    await LeaveAccessHelper.recordAuditLog(
      this.prisma,
      orgId,
      user.id,
      'LEAVE_REQUEST_SUBMITTED',
      null,
      created,
    );

    return {
      message: 'Leave application submitted successfully',
      leaveRequest: created,
      calculation: {
        totalDays,
        workingDays: calculation.workingDays,
        holidayDays: calculation.holidayDays,
        weekendDays: calculation.weekendDays,
        availableBalance,
        shortfall,
      },
      warnings,
    };
  }

  /**
   * Task 9.3: Cancel Leave Request (Self-Service or Manager)
   */
  async cancelLeaveRequest(
    user: AuthenticatedUser,
    id: string,
    dto: CancelLeaveDto,
    queryOrgId?: string,
  ) {
    const orgId = LeaveAccessHelper.resolveOrgId(user, queryOrgId);

    const request = await this.prisma.sms_staffLeaveRequests.findUnique({
      where: { id },
      include: {
        staff: { select: { id: true, organizationId: true, userId: true, fullName: true, homeBranchId: true } },
        leaveType: { select: { id: true, name: true, code: true } },
      },
    });

    if (!request || request.staff.organizationId !== orgId) {
      throw new NotFoundException({
        code: 'LEAVE_REQUEST_NOT_FOUND',
        message: 'Leave request not found',
      });
    }

    // Check permission: Staff can cancel their own pending request.
    const isOwnerOfRequest = request.staff.userId === user.id;

    if (!isOwnerOfRequest) {
      await LeaveAccessHelper.validateUserAccess(
        this.prisma,
        this.permissionResolver,
        user,
        orgId,
        'staff_leave.update',
        request.staff.homeBranchId,
      );
    }

    if (request.status === 'cancelled') {
      throw new BadRequestException({
        code: 'ALREADY_CANCELLED',
        message: 'Leave request is already cancelled',
      });
    }

    if (request.status === 'rejected') {
      throw new BadRequestException({
        code: 'CANNOT_CANCEL_REJECTED',
        message: 'Rejected leave requests cannot be cancelled',
      });
    }

    // If request was already APPROVED, only managers/owners can cancel it, and balance must be restored!
    if (request.status === 'approved') {
      await LeaveAccessHelper.validateUserAccess(
        this.prisma,
        this.permissionResolver,
        user,
        orgId,
        'staff_leave.approve',
        request.staff.homeBranchId,
      );

      const daysToRestore = Number(request.totalDays);
      const balanceYear = request.startDate.getUTCFullYear();

      await this.prisma.$transaction(async (tx) => {
        // Update request status
        await tx.sms_staffLeaveRequests.update({
          where: { id },
          data: { status: 'cancelled' },
        });

        // Restore balance
        const bal = await tx.sms_staffLeaveBalances.findUnique({
          where: {
            staffId_leaveTypeId_balanceYear: {
              staffId: request.staffId,
              leaveTypeId: request.leaveTypeId,
              balanceYear,
            },
          },
        });

        if (bal) {
          const currentUsed = Number(bal.usedDays) || 0;
          const newUsed = Math.max(0, Math.round((currentUsed - daysToRestore) * 10) / 10);
          const beforeBalance = this.balanceService.calculateAvailableBalance(bal);
          const newClosing = Math.round((beforeBalance + daysToRestore) * 10) / 10;

          await tx.sms_staffLeaveBalances.update({
            where: { id: bal.id },
            data: {
              usedDays: new Prisma.Decimal(newUsed),
              closingBalanceDays: new Prisma.Decimal(newClosing),
            },
          });

          await this.balanceService.recordBalanceTransaction({
            balanceId: bal.id,
            staffId: request.staffId,
            leaveTypeId: request.leaveTypeId,
            balanceYear,
            transactionType: 'LEAVE_CANCELLATION',
            amount: daysToRestore,
            beforeBalance,
            afterBalance: newClosing,
            reason: `Reversal of approved leave cancellation (${dto.reason || 'Cancelled'})`,
            actorId: user.id,
          });
        }

        // Add to audit log
        await tx.sms_leaveApprovalLogs.create({
          data: {
            leaveRequestId: id,
            action: 'cancelled',
            actorId: user.id,
            notes: dto.reason || 'Approved leave cancelled and balance restored',
          },
        });
      });
    } else {
      // Pending request cancellation: simply update status without balance impact
      await this.prisma.$transaction(async (tx) => {
        await tx.sms_staffLeaveRequests.update({
          where: { id },
          data: { status: 'cancelled' },
        });

        await tx.sms_leaveApprovalLogs.create({
          data: {
            leaveRequestId: id,
            action: 'cancelled',
            actorId: user.id,
            notes: dto.reason || 'Pending request cancelled by requester',
          },
        });
      });
    }

    await LeaveAccessHelper.recordAuditLog(
      this.prisma,
      orgId,
      user.id,
      'LEAVE_REQUEST_CANCELLED',
      { previousStatus: request.status },
      { id, status: 'cancelled', reason: dto.reason },
    );

    return { message: 'Leave request cancelled successfully' };
  }

  /**
   * Task 9.3: Self-Service My Leave Requests
   */
  async getMyRequests(
    user: AuthenticatedUser,
    query: QueryLeaveRequestDto,
    queryOrgId?: string,
  ) {
    const orgId = LeaveAccessHelper.resolveOrgId(user, queryOrgId);
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const staff = await LeaveAccessHelper.getStaffForUserSafe(this.prisma, user.id, orgId);
    if (!staff) {
      return {
        items: [],
        data: [],
        total: 0,
        meta: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    }

    const where: Prisma.sms_staffLeaveRequestsWhereInput = {
      staffId: staff.id,
    };

    if (query.status) {
      where.status = query.status;
    }
    if (query.leaveTypeId) {
      where.leaveTypeId = query.leaveTypeId;
    }
    if (query.startDate && query.endDate) {
      where.startDate = { lte: LeaveCalculatorUtil.normalizeDate(query.endDate) };
      where.endDate = { gte: LeaveCalculatorUtil.normalizeDate(query.startDate) };
    }

    const sortOrder: Prisma.SortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
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
      case 'status':
        orderBy = { status: sortOrder };
        break;
      case 'createdAt':
        orderBy = { createdAt: sortOrder };
        break;
      case 'appliedAt':
      default:
        orderBy = { appliedAt: sortOrder };
        break;
    }

    const [items, total] = await Promise.all([
      this.prisma.sms_staffLeaveRequests.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          leaveType: {
            select: { id: true, name: true, code: true, isPaid: true },
          },
          leaveApprovalLogs: {
            orderBy: { actionAt: 'asc' },
            include: { actor: { select: { id: true, displayName: true } } },
          },
        },
      }),
      this.prisma.sms_staffLeaveRequests.count({ where }),
    ]);

    const formattedItems = items.map((r) => ({ ...r, totalDays: Number(r.totalDays) }));
    return {
      items: formattedItems,
      data: formattedItems,
      total,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Task 9.3: List Leave Requests (Admin / Manager View)
   */
  async listLeaveRequests(
    user: AuthenticatedUser,
    query: QueryLeaveRequestDto,
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

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const staffWhere: Prisma.sms_staffWhereInput = {
      organizationId: orgId,
      deletedAt: null,
    };

    if (query.branchId) {
      staffWhere.homeBranchId = query.branchId;
    }
    if (query.search) {
      const s = query.search.trim();
      staffWhere.OR = [
        { fullName: { contains: s, mode: 'insensitive' } },
        { employeeCode: { contains: s, mode: 'insensitive' } },
      ];
    }

    const where: Prisma.sms_staffLeaveRequestsWhereInput = {
      staff: staffWhere,
    };

    if (query.staffId) {
      where.staffId = query.staffId;
    }
    if (query.leaveTypeId) {
      where.leaveTypeId = query.leaveTypeId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.startDate && query.endDate) {
      where.startDate = { lte: LeaveCalculatorUtil.normalizeDate(query.endDate) };
      where.endDate = { gte: LeaveCalculatorUtil.normalizeDate(query.startDate) };
    }

    const sortOrder: Prisma.SortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
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
      case 'status':
        orderBy = { status: sortOrder };
        break;
      case 'staffName':
        orderBy = { staff: { fullName: sortOrder } };
        break;
      case 'createdAt':
        orderBy = { createdAt: sortOrder };
        break;
      case 'appliedAt':
      default:
        orderBy = { appliedAt: sortOrder };
        break;
    }

    const [items, total] = await Promise.all([
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
            },
          },
          leaveType: {
            select: { id: true, name: true, code: true, isPaid: true },
          },
          leaveApprovalLogs: {
            orderBy: { actionAt: 'desc' },
            take: 1,
            include: { actor: { select: { id: true, displayName: true } } },
          },
        },
      }),
      this.prisma.sms_staffLeaveRequests.count({ where }),
    ]);

    const formattedItems = items.map((r) => ({ ...r, totalDays: Number(r.totalDays) }));
    return {
      items: formattedItems,
      data: formattedItems,
      total,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Task 9.3: Get Leave Request Details by ID
   */
  async getLeaveRequestById(
    user: AuthenticatedUser,
    id: string,
    queryOrgId?: string,
  ) {
    const orgId = LeaveAccessHelper.resolveOrgId(user, queryOrgId);

    const request = await this.prisma.sms_staffLeaveRequests.findUnique({
      where: { id },
      include: {
        staff: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            gender: true,
            organizationId: true,
            userId: true,
            profilePhotoUrl: true,
            homeBranch: { select: { id: true, name: true, code: true } },
          },
        },
        leaveType: true,
        leaveApprovalLogs: {
          orderBy: { actionAt: 'asc' },
          include: { actor: { select: { id: true, displayName: true } } },
        },
      },
    });

    if (!request || request.staff.organizationId !== orgId) {
      throw new NotFoundException({
        code: 'LEAVE_REQUEST_NOT_FOUND',
        message: 'Leave request not found',
      });
    }

    // Check permission or own record
    await LeaveAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      orgId,
      'staff_leave.view',
      request.staff.homeBranch.id,
      request.staff,
    );

    // Compute balance context for the request
    const year = request.startDate.getUTCFullYear();
    const balance = await this.prisma.sms_staffLeaveBalances.findUnique({
      where: {
        staffId_leaveTypeId_balanceYear: {
          staffId: request.staff.id,
          leaveTypeId: request.leaveTypeId,
          balanceYear: year,
        },
      },
    });

    const availableBalance = balance ? this.balanceService.calculateAvailableBalance(balance) : 0;
    const requestedDays = Number(request.totalDays);
    const shortfall = requestedDays > availableBalance ? requestedDays - availableBalance : 0;

    return {
      ...request,
      totalDays: requestedDays,
      balanceContext: {
        year,
        availableBalance,
        shortfall,
      },
    };
  }
}

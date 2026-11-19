import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { SubmitAttendanceCorrectionDto } from '../dto/correction-request.dto';
import { ReviewAttendanceCorrectionDto } from '../dto/review-correction.dto';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { AttendanceAccessHelper } from '../utils/attendance-access.util';
import { AttendanceCalculatorService } from './attendance-calculator.service';
import { AttendancePolicyService } from './attendance-policy.service';
import { AttendanceService } from './attendance.service';

@Injectable()
export class AttendanceCorrectionService {
  private readonly logger = new Logger(AttendanceCorrectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: AttendanceCalculatorService,
    private readonly policyService: AttendancePolicyService,
    private readonly attendanceService: AttendanceService,
  ) {}

  /**
   * Task 8.3: Submit Attendance Correction Request (Staff self-service or Manager)
   */
  async submitCorrection(
    user: AuthenticatedUser,
    dto: SubmitAttendanceCorrectionDto,
    queryOrgId?: string,
  ) {
    const orgId = AttendanceAccessHelper.resolveOrgId(user, queryOrgId);

    // 1. Resolve Staff
    let staff;
    if (dto.staffId) {
      staff = await AttendanceAccessHelper.validateStaff(this.prisma, dto.staffId, orgId);
    } else {
      staff = await AttendanceAccessHelper.resolveStaffForUser(this.prisma, user, orgId);
      if (!staff) {
        throw new NotFoundException('No active employee profile linked to your user account.');
      }
    }

    const corrDate = this.attendanceService.normalizeDate(dto.correctionDate);
    const today = this.attendanceService.normalizeDate(new Date());

    if (corrDate > today) {
      throw new BadRequestException('Cannot request attendance correction for a future date.');
    }

    const checkInAt = dto.requestedCheckInAt ? new Date(dto.requestedCheckInAt) : null;
    const checkOutAt = dto.requestedCheckOutAt ? new Date(dto.requestedCheckOutAt) : null;

    if (!checkInAt && !checkOutAt) {
      throw new BadRequestException('At least one proposed punch time (Check-in or Check-out) must be provided.');
    }

    if (checkInAt && checkOutAt && checkOutAt <= checkInAt) {
      throw new BadRequestException('Requested check-out time must be after check-in time.');
    }

    // 2. Check If Period Is Locked by Approval (Task 8.4 gate)
    const existingAttendance = await this.prisma.sms_staffAttendance.findUnique({
      where: {
        staffId_attendanceDate: {
          staffId: staff.id,
          attendanceDate: corrDate,
        },
      },
    });

    if (existingAttendance?.isLocked) {
      throw new ForbiddenException({
        code: 'PERIOD_LOCKED',
        message: 'This attendance record is closed and locked by pay-period approval. Please contact your branch manager to reopen the period before submitting a correction.',
      });
    }

    const lockedApproval = await this.prisma.sms_attendancePeriodApprovals.findFirst({
      where: {
        staffId: staff.id,
        periodStart: { lte: corrDate },
        periodEnd: { gte: corrDate },
        status: 'approved',
      },
    });

    if (lockedApproval) {
      throw new ForbiddenException({
        code: 'PAY_PERIOD_LOCKED',
        message: 'The pay period covering this date has already been approved and locked for payroll. Please request your manager to reopen the period.',
      });
    }

    // 3. Prevent Duplicate Pending Corrections for Same Date
    const duplicatePending = await this.prisma.sms_staffAttendanceCorrections.findFirst({
      where: {
        staffId: staff.id,
        correctionDate: corrDate,
        status: 'pending',
      },
    });

    if (duplicatePending) {
      throw new BadRequestException({
        code: 'DUPLICATE_PENDING_CORRECTION',
        message: 'You already have a pending correction request for this date. Please wait for manager review.',
      });
    }

    // 4. Create Audited Correction Record
    const correction = await this.prisma.sms_staffAttendanceCorrections.create({
      data: {
        attendanceId: existingAttendance?.id || null,
        staffId: staff.id,
        correctionDate: corrDate,
        requestedCheckInAt: checkInAt,
        requestedCheckOutAt: checkOutAt,
        reason: dto.reason.trim(),
        supportingDocumentUrl: dto.supportingDocumentUrl || null,
        status: 'pending',
        createdById: user.id,
      },
      include: {
        staff: {
          select: { id: true, fullName: true, employeeCode: true },
        },
      },
    });

    await AttendanceAccessHelper.recordAuditLog(
      this.prisma,
      orgId,
      user.id,
      'attendance_correction.submit',
      null,
      correction,
    );

    return {
      success: true,
      message: 'Attendance correction request submitted successfully and queued for manager review.',
      correction,
    };
  }

  /**
   * Task 8.3: Get Pending Correction Requests Queue (Manager view)
   */
  async getPendingCorrections(
    user: AuthenticatedUser,
    organizationId: string,
    branchId?: string,
    query?: { page?: number; limit?: number; search?: string },
  ) {
    const orgId = AttendanceAccessHelper.resolveOrgId(user, organizationId);
    const page = Number(query?.page) || 1;
    const limit = Number(query?.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = {
      status: 'pending',
      staff: {
        organizationId: orgId,
        deletedAt: null,
      },
    };

    if (branchId) {
      where.staff.OR = [
        { homeBranchId: branchId },
        { staffBranchAssignments: { some: { branchId } } },
      ];
    }

    if (query?.search) {
      where.staff.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { employeeCode: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.sms_staffAttendanceCorrections.count({ where }),
      this.prisma.sms_staffAttendanceCorrections.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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
          attendance: true,
          createdBy: {
            select: { id: true, displayName: true, email: true },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: items,
    };
  }

  /**
   * Task 8.3: Approve Attendance Correction Request
   */
  async approveCorrection(
    user: AuthenticatedUser,
    correctionId: string,
    dto: ReviewAttendanceCorrectionDto,
    queryOrgId?: string,
  ) {
    const orgId = AttendanceAccessHelper.resolveOrgId(user, queryOrgId);

    const correction = await this.prisma.sms_staffAttendanceCorrections.findUnique({
      where: { id: correctionId },
      include: {
        staff: true,
        attendance: true,
      },
    });

    if (!correction) {
      throw new NotFoundException('Correction request not found.');
    }

    if (correction.status !== 'pending') {
      throw new BadRequestException(`Correction request is already ${correction.status}.`);
    }

    if (correction.staff.organizationId !== orgId) {
      throw new ForbiddenException('Access denied to correction request belonging to another organization.');
    }

    // Check if period is locked
    if (correction.attendance?.isLocked) {
      throw new ForbiddenException('Cannot approve correction for a locked attendance period. Reopen the period first.');
    }

    const branchId = correction.attendance?.branchId || correction.staff.homeBranchId;
    const policy = await this.policyService.getEffectivePolicy(orgId, branchId);
    const { shift, isOnLeave, isHoliday } = await this.attendanceService.resolveStaffShift(
      correction.staffId,
      correction.correctionDate,
      branchId,
    );

    const targetCheckIn = correction.requestedCheckInAt || correction.attendance?.checkInAt || null;
    const targetCheckOut = correction.requestedCheckOutAt || correction.attendance?.checkOutAt || null;

    const calculation = this.calculator.calculateDailyAttendance(
      targetCheckIn,
      targetCheckOut,
      shift,
      policy,
      isOnLeave,
      isHoliday,
      correction.correctionDate,
    );

    // Atomic transaction: Update Attendance + Update Correction + Audit Log
    const result = await this.prisma.$transaction(async (tx) => {
      let updatedAttendance;
      if (correction.attendanceId) {
        updatedAttendance = await tx.sms_staffAttendance.update({
          where: { id: correction.attendanceId },
          data: {
            checkInAt: targetCheckIn,
            checkOutAt: targetCheckOut,
            workedMinutes: calculation.workedMinutes,
            overtimeMinutes: calculation.overtimeMinutes,
            status: calculation.status,
          },
        });
      } else {
        updatedAttendance = await tx.sms_staffAttendance.create({
          data: {
            staffId: correction.staffId,
            branchId,
            attendanceDate: correction.correctionDate,
            checkInAt: targetCheckIn,
            checkInMethod: 'admin_entry',
            checkOutAt: targetCheckOut,
            checkOutMethod: 'admin_entry',
            workedMinutes: calculation.workedMinutes,
            overtimeMinutes: calculation.overtimeMinutes,
            status: calculation.status,
          },
        });
      }

      const updatedCorrection = await tx.sms_staffAttendanceCorrections.update({
        where: { id: correctionId },
        data: {
          attendanceId: updatedAttendance.id,
          status: 'approved',
          reviewedById: user.id,
          reviewedAt: new Date(),
          reviewNotes: dto.reviewNotes || null,
        },
      });

      return { updatedAttendance, updatedCorrection };
    });

    await AttendanceAccessHelper.recordAuditLog(
      this.prisma,
      orgId,
      user.id,
      'attendance_correction.approve',
      correction,
      result,
    );

    return {
      success: true,
      message: 'Attendance correction approved and applied to authoritative record.',
      ...result,
    };
  }

  /**
   * Task 8.3: Reject Attendance Correction Request
   */
  async rejectCorrection(
    user: AuthenticatedUser,
    correctionId: string,
    dto: ReviewAttendanceCorrectionDto,
    queryOrgId?: string,
  ) {
    const orgId = AttendanceAccessHelper.resolveOrgId(user, queryOrgId);

    const correction = await this.prisma.sms_staffAttendanceCorrections.findUnique({
      where: { id: correctionId },
      include: { staff: true },
    });

    if (!correction) {
      throw new NotFoundException('Correction request not found.');
    }

    if (correction.status !== 'pending') {
      throw new BadRequestException(`Correction request is already ${correction.status}.`);
    }

    if (correction.staff.organizationId !== orgId) {
      throw new ForbiddenException('Access denied to correction request belonging to another organization.');
    }

    const updated = await this.prisma.sms_staffAttendanceCorrections.update({
      where: { id: correctionId },
      data: {
        status: 'rejected',
        reviewedById: user.id,
        reviewedAt: new Date(),
        reviewNotes: dto.reviewNotes || null,
      },
    });

    await AttendanceAccessHelper.recordAuditLog(
      this.prisma,
      orgId,
      user.id,
      'attendance_correction.reject',
      correction,
      updated,
    );

    return {
      success: true,
      message: 'Attendance correction request has been rejected. Original record remains unchanged.',
      correction: updated,
    };
  }

  /**
   * Task 8.3: Get Staff's Own Correction Requests
   */
  async getMyCorrections(
    user: AuthenticatedUser,
    organizationId: string,
    query?: { page?: number; limit?: number },
  ) {
    const orgId = AttendanceAccessHelper.resolveOrgId(user, organizationId);
    const staff = await AttendanceAccessHelper.resolveStaffForUser(this.prisma, user, orgId);

    if (!staff) {
      throw new NotFoundException('No active employee profile linked to your user account.');
    }

    const page = Number(query?.page) || 1;
    const limit = Number(query?.limit) || 10;
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      this.prisma.sms_staffAttendanceCorrections.count({
        where: { staffId: staff.id },
      }),
      this.prisma.sms_staffAttendanceCorrections.findMany({
        where: { staffId: staff.id },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          attendance: true,
          reviewedBy: { select: { displayName: true, email: true } },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: items,
    };
  }
}

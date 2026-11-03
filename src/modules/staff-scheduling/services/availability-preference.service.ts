import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { EffectivePermissionResolverService } from '../../role-permission/services/effective-permission-resolver.service';
import {
  CreateAvailabilityPreferenceDto,
  UpdateAvailabilityPreferenceDto,
  QueryAvailabilityPreferenceDto,
} from '../dto/availability-preference.dto';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import {
  parseTimeToDate,
  formatTime,
  timeToMinutes,
} from '../utils/time-range.util';
import { SchedulingAccessHelper } from '../utils/scheduling-access.util';
import { Prisma } from '@prisma/client';

@Injectable()
export class AvailabilityPreferenceService {
  private readonly logger = new Logger(AvailabilityPreferenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    private readonly permissionResolver?: EffectivePermissionResolverService,
  ) {}

  /**
   * Helper: Resolve effective staffId for caller
   * If caller is Service Staff, force staffId to be their linked staff record.
   */
  private async resolveStaffIdForCaller(
    user: AuthenticatedUser,
    organizationId: string,
    requestedStaffId?: string,
  ): Promise<string> {
    const roles = (user.roles || []).map((r) =>
      r.toUpperCase().replace(/[\s_-]+/g, '_'),
    );

    const isManagement = roles.some((r) =>
      ['SUPER_ADMIN', 'SUPERADMIN', 'OWNER', 'BRANCH_MANAGER'].includes(r),
    );

    if (isManagement && requestedStaffId) {
      return requestedStaffId;
    }

    // Look up staff record linked to user
    const staff = await this.prisma.sms_staff.findFirst({
      where: {
        organizationId,
        deletedAt: null,
        OR: [
          { userId: user.id },
          ...(user.email
            ? [{ staffContacts: { personalEmail: user.email } }]
            : []),
        ],
      },
    });

    if (!staff) {
      if (requestedStaffId && isManagement) return requestedStaffId;
      throw new NotFoundException({
        code: 'STAFF_PROFILE_NOT_FOUND',
        message: 'No employee record associated with your user account in this organization',
      });
    }

    return staff.id;
  }

  /**
   * Create availability preference (Task 7.3)
   */
  async createPreference(
    organizationId: string,
    dto: CreateAvailabilityPreferenceDto,
    user: AuthenticatedUser,
  ) {
    if (!organizationId) {
      throw new BadRequestException('organizationId is required');
    }

    const staffId = await this.resolveStaffIdForCaller(user, organizationId, dto.staffId);
    const staff = await SchedulingAccessHelper.validateStaff(
      this.prisma,
      staffId,
      organizationId,
    );

    await SchedulingAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      organizationId,
      'staff_schedule.create',
      staff.homeBranchId,
      staff,
    );

    // Validate times if provided
    if (dto.startTime || dto.endTime) {
      if (!dto.startTime || !dto.endTime) {
        throw new BadRequestException({
          code: 'INCOMPLETE_TIME_RANGE',
          message: 'Both startTime and endTime must be provided if specifying a time window',
        });
      }
      if (timeToMinutes(dto.endTime) <= timeToMinutes(dto.startTime)) {
        throw new BadRequestException({
          code: 'INVALID_TIME_RANGE',
          message: 'endTime must be later than startTime',
        });
      }
    }

    const startTimeDate = parseTimeToDate(dto.startTime);
    const endTimeDate = parseTimeToDate(dto.endTime);

    // Clean up overlapping or contradictory preferences for the exact same day/slot
    await this.prisma.sms_staffAvailabilityPreferences.deleteMany({
      where: {
        staffId,
        dayOfWeek: dto.dayOfWeek !== undefined ? dto.dayOfWeek : null,
        startTime: startTimeDate,
        endTime: endTimeDate,
      },
    });

    const preference = await this.prisma.sms_staffAvailabilityPreferences.create({
      data: {
        staffId,
        dayOfWeek: dto.dayOfWeek !== undefined ? dto.dayOfWeek : null,
        startTime: startTimeDate,
        endTime: endTimeDate,
        preferenceType: dto.preferenceType,
        note: dto.note || null,
      },
      include: {
        staff: {
          select: { id: true, fullName: true, employeeCode: true },
        },
      },
    });

    await SchedulingAccessHelper.recordAuditLog(
      this.prisma,
      organizationId,
      user.id,
      'CREATE_AVAILABILITY_PREFERENCE',
      null,
      preference,
    );

    return this.serializePreference(preference);
  }

  /**
   * Get preferences for an employee or branch (Task 7.3)
   */
  async getPreferences(
    organizationId: string,
    query: QueryAvailabilityPreferenceDto,
    user: AuthenticatedUser,
  ) {
    if (!organizationId) {
      throw new BadRequestException('organizationId is required');
    }

    const roles = (user.roles || []).map((r) =>
      r.toUpperCase().replace(/[\s_-]+/g, '_'),
    );
    const isServiceStaffOnly =
      (roles.includes('SERVICE_STAFF') || roles.includes('STAFF')) &&
      !roles.some((r) =>
        ['SUPER_ADMIN', 'SUPERADMIN', 'OWNER', 'BRANCH_MANAGER', 'ACCOUNTANT', 'FRONT_DESK'].includes(r),
      );

    let targetStaffId = query.staffId;
    if (isServiceStaffOnly) {
      targetStaffId = await this.resolveStaffIdForCaller(user, organizationId);
    }

    const where: Prisma.sms_staffAvailabilityPreferencesWhereInput = {};

    if (targetStaffId) {
      where.staffId = targetStaffId;
      const staff = await SchedulingAccessHelper.validateStaff(
        this.prisma,
        targetStaffId,
        organizationId,
      );
      await SchedulingAccessHelper.validateUserAccess(
        this.prisma,
        this.permissionResolver,
        user,
        organizationId,
        'staff_schedule.view',
        staff.homeBranchId,
        staff,
      );
    } else {
      // Branch-wide list for managers
      await SchedulingAccessHelper.validateUserAccess(
        this.prisma,
        this.permissionResolver,
        user,
        organizationId,
        'staff_schedule.view',
        query.branchId,
      );

      where.staff = {
        organizationId,
        deletedAt: null,
        ...(query.branchId ? { homeBranchId: query.branchId } : {}),
      };
    }

    const preferences = await this.prisma.sms_staffAvailabilityPreferences.findMany({
      where,
      include: {
        staff: {
          select: { id: true, fullName: true, employeeCode: true },
        },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    return preferences.map((p) => this.serializePreference(p));
  }

  /**
   * Update preference
   */
  async updatePreference(
    organizationId: string,
    preferenceId: string,
    dto: UpdateAvailabilityPreferenceDto,
    user: AuthenticatedUser,
  ) {
    const existing = await this.prisma.sms_staffAvailabilityPreferences.findUnique({
      where: { id: preferenceId },
      include: { staff: true },
    });

    if (!existing || existing.staff.organizationId !== organizationId) {
      throw new NotFoundException({
        code: 'PREFERENCE_NOT_FOUND',
        message: 'Availability preference not found',
      });
    }

    await SchedulingAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      organizationId,
      'staff_schedule.update',
      existing.staff.homeBranchId,
      existing.staff,
    );

    const newStart =
      dto.startTime !== undefined
        ? parseTimeToDate(dto.startTime)
        : existing.startTime;
    const newEnd =
      dto.endTime !== undefined
        ? parseTimeToDate(dto.endTime)
        : existing.endTime;

    if (newStart && newEnd) {
      if (timeToMinutes(newEnd) <= timeToMinutes(newStart)) {
        throw new BadRequestException({
          code: 'INVALID_TIME_RANGE',
          message: 'endTime must be later than startTime',
        });
      }
    }

    const updated = await this.prisma.sms_staffAvailabilityPreferences.update({
      where: { id: preferenceId },
      data: {
        dayOfWeek: dto.dayOfWeek !== undefined ? dto.dayOfWeek : undefined,
        startTime: newStart,
        endTime: newEnd,
        preferenceType: dto.preferenceType || undefined,
        note: dto.note !== undefined ? dto.note : undefined,
      },
      include: {
        staff: { select: { id: true, fullName: true, employeeCode: true } },
      },
    });

    await SchedulingAccessHelper.recordAuditLog(
      this.prisma,
      organizationId,
      user.id,
      'UPDATE_AVAILABILITY_PREFERENCE',
      existing,
      updated,
    );

    return this.serializePreference(updated);
  }

  /**
   * Delete preference
   */
  async deletePreference(
    organizationId: string,
    preferenceId: string,
    user: AuthenticatedUser,
  ) {
    const existing = await this.prisma.sms_staffAvailabilityPreferences.findUnique({
      where: { id: preferenceId },
      include: { staff: true },
    });

    if (!existing || existing.staff.organizationId !== organizationId) {
      throw new NotFoundException({
        code: 'PREFERENCE_NOT_FOUND',
        message: 'Availability preference not found',
      });
    }

    await SchedulingAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      organizationId,
      'staff_schedule.update',
      existing.staff.homeBranchId,
      existing.staff,
    );

    await this.prisma.sms_staffAvailabilityPreferences.delete({
      where: { id: preferenceId },
    });

    await SchedulingAccessHelper.recordAuditLog(
      this.prisma,
      organizationId,
      user.id,
      'DELETE_AVAILABILITY_PREFERENCE',
      existing,
      null,
    );

    return {
      message: 'Availability preference deleted successfully',
      id: preferenceId,
    };
  }

  /**
   * Advisory Conflict Checker: Check if an assigned shift conflicts with staff's Unavailable preference
   */
  async checkSchedulingConflict(
    staffId: string,
    dayOfWeek: number,
    shiftStartTimeStr: string,
    shiftEndTimeStr: string,
  ): Promise<{
    hasConflict: boolean;
    conflicts: Array<{
      type: string;
      message: string;
      preference: any;
    }>;
  }> {
    const preferences = await this.prisma.sms_staffAvailabilityPreferences.findMany({
      where: {
        staffId,
        OR: [{ dayOfWeek }, { dayOfWeek: null }],
      },
    });

    const shiftStartMin = timeToMinutes(shiftStartTimeStr);
    const shiftEndMin = timeToMinutes(shiftEndTimeStr);
    const conflicts: Array<{ type: string; message: string; preference: any }> = [];

    for (const pref of preferences) {
      const prefStartMin = pref.startTime ? timeToMinutes(pref.startTime) : 0;
      const prefEndMin = pref.endTime ? timeToMinutes(pref.endTime) : 1440;

      // Check overlap
      const overlaps = Math.max(shiftStartMin, prefStartMin) < Math.min(shiftEndMin, prefEndMin);

      if (overlaps) {
        if (pref.preferenceType === 'unavailable') {
          conflicts.push({
            type: 'UNAVAILABLE',
            message: `Employee marked themselves UNAVAILABLE${
              pref.startTime ? ` between ${formatTime(pref.startTime)} and ${formatTime(pref.endTime)}` : ' for the entire day'
            }${pref.note ? ` ("${pref.note}")` : ''}. Manager confirmation is required.`,
            preference: this.serializePreference(pref),
          });
        } else if (pref.preferenceType === 'avoid') {
          conflicts.push({
            type: 'AVOID',
            message: `Employee prefers to AVOID working${
              pref.startTime ? ` between ${formatTime(pref.startTime)} and ${formatTime(pref.endTime)}` : ' on this day'
            }${pref.note ? ` ("${pref.note}")` : ''}.`,
            preference: this.serializePreference(pref),
          });
        }
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts,
    };
  }

  private serializePreference(pref: any) {
    return {
      id: pref.id,
      staffId: pref.staffId,
      staff: pref.staff || null,
      dayOfWeek: pref.dayOfWeek,
      startTime: formatTime(pref.startTime),
      endTime: formatTime(pref.endTime),
      preferenceType: pref.preferenceType,
      note: pref.note || null,
      createdAt: pref.createdAt,
      updatedAt: pref.updatedAt,
    };
  }
}

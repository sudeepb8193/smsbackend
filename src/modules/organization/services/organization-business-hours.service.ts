import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { UpdateBusinessHoursDto } from '../dto/update-business-hours.dto';
import { BusinessHourDayDto } from '../dto/business-hour-day.dto';
import {
  doesSpanMidnight,
  isValidBreakPeriod,
  isValidTimeString,
} from '../utils/business-hours.util';
import { sms_businessHours } from '@prisma/client';

export interface FormattedWeeklyScheduleResponse {
  scope: 'organization' | 'branch';
  branchId: string | null;
  days: FormattedBusinessHourDay[];
}

export interface FormattedBusinessHourDay {
  id?: string;
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
  breakStartTime: string | null;
  breakEndTime: string | null;
  spansMidnight: boolean;
}

@Injectable()
export class OrganizationBusinessHoursService {
  constructor(private prisma: PrismaService) {}

  private isValidUuid(id: string): boolean {
    if (typeof id !== 'string' || !id) return false;
    return (
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        id,
      ) || id.startsWith('branch-uuid')
    );
  }

  /**
   * Get Business Hours schedule for Organization or Branch override
   */
  async getBusinessHours(
    organizationId: string,
    branchId: string | null = null,
  ): Promise<FormattedWeeklyScheduleResponse> {
    if (branchId) {
      if (!this.isValidUuid(branchId)) {
        throw new NotFoundException({
          code: 'BRANCH_NOT_FOUND',
          message: 'Branch not found or does not belong to your organization',
        });
      }

      const branch = await this.prisma.sms_branches.findFirst({
        where: {
          id: branchId,
          organizationId,
          deletedAt: null,
        },
      });

      if (!branch) {
        throw new NotFoundException({
          code: 'BRANCH_NOT_FOUND',
          message: 'Branch not found or does not belong to your organization',
        });
      }
    }

    const records = await this.prisma.sms_businessHours.findMany({
      where: {
        organizationId,
        branchId: branchId || null,
        deletedAt: null,
      },
      orderBy: { dayOfWeek: 'asc' },
    });

    // If branch-specific schedule requested but none configured, fall back to org defaults
    if (branchId && records.length === 0) {
      const orgRecords = await this.prisma.sms_businessHours.findMany({
        where: {
          organizationId,
          branchId: null,
          deletedAt: null,
        },
        orderBy: { dayOfWeek: 'asc' },
      });

      return {
        scope: 'branch',
        branchId,
        days: this.buildCompleteWeeklyDays(orgRecords),
      };
    }

    return {
      scope: branchId ? 'branch' : 'organization',
      branchId,
      days: this.buildCompleteWeeklyDays(records),
    };
  }

  /**
   * Update or Create Weekly Business Hours schedule atomically for Organization or Branch
   */
  async updateBusinessHours(
    organizationId: string,
    branchId: string | null = null,
    dto: UpdateBusinessHoursDto,
  ): Promise<FormattedWeeklyScheduleResponse> {
    if (branchId) {
      if (!this.isValidUuid(branchId)) {
        throw new NotFoundException({
          code: 'BRANCH_NOT_FOUND',
          message: 'Branch not found or does not belong to your organization',
        });
      }

      const branch = await this.prisma.sms_branches.findFirst({
        where: {
          id: branchId,
          organizationId,
          deletedAt: null,
        },
      });

      if (!branch) {
        throw new NotFoundException({
          code: 'BRANCH_NOT_FOUND',
          message: 'Branch not found or does not belong to your organization',
        });
      }
    }

    // 1. Check duplicate days in request body
    const seenDays = new Set<number>();
    for (const day of dto.days) {
      if (seenDays.has(day.dayOfWeek)) {
        throw new BadRequestException({
          code: 'DUPLICATE_DAY_OF_WEEK',
          message: `Duplicate configuration for dayOfWeek ${day.dayOfWeek} provided`,
        });
      }
      seenDays.add(day.dayOfWeek);
    }

    // 2. Validate logical schedule rules for each submitted day
    const validatedDaysData: Array<{
      dayOfWeek: number;
      isOpen: boolean;
      openTime: string | null;
      closeTime: string | null;
      breakStartTime: string | null;
      breakEndTime: string | null;
      spansMidnight: boolean;
    }> = [];

    for (const dayDto of dto.days) {
      const validated = this.validateAndNormalizeDay(dayDto);
      validatedDaysData.push(validated);
    }

    // 3. Atomically persist schedule via Prisma transaction
    await this.prisma.$transaction(async (tx) => {
      for (const dayData of validatedDaysData) {
        const existing = await tx.sms_businessHours.findFirst({
          where: {
            organizationId,
            branchId: branchId || null,
            dayOfWeek: dayData.dayOfWeek,
            deletedAt: null,
          },
        });

        if (existing) {
          await tx.sms_businessHours.update({
            where: { id: existing.id },
            data: {
              isOpen: dayData.isOpen,
              openTime: dayData.openTime,
              closeTime: dayData.closeTime,
              breakStartTime: dayData.breakStartTime,
              breakEndTime: dayData.breakEndTime,
              spansMidnight: dayData.spansMidnight,
            },
          });
        } else {
          await tx.sms_businessHours.create({
            data: {
              organizationId,
              branchId: branchId || null,
              dayOfWeek: dayData.dayOfWeek,
              isOpen: dayData.isOpen,
              openTime: dayData.openTime,
              closeTime: dayData.closeTime,
              breakStartTime: dayData.breakStartTime,
              breakEndTime: dayData.breakEndTime,
              spansMidnight: dayData.spansMidnight,
            },
          });
        }
      }
    });

    return this.getBusinessHours(organizationId, branchId);
  }

  /**
   * Validation check for Organization profile activation
   */
  async validateBusinessHoursRequirement(
    organizationId: string,
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const activeOpenDaysCount = await this.prisma.sms_businessHours.count({
      where: {
        organizationId,
        branchId: null,
        isOpen: true,
        deletedAt: null,
      },
    });

    const errors: string[] = [];
    if (activeOpenDaysCount === 0) {
      errors.push(
        'Organization must configure business hours with at least 1 open working day before activation',
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Helper to validate single day schedule payload logic
   */
  private validateAndNormalizeDay(dayDto: BusinessHourDayDto) {
    if (!dayDto.isOpen) {
      if (dayDto.breakStartTime || dayDto.breakEndTime) {
        throw new BadRequestException({
          code: 'CLOSED_DAY_BREAK_NOT_ALLOWED',
          message: `Day ${dayDto.dayOfWeek} is closed, break times cannot be configured`,
        });
      }
      return {
        dayOfWeek: dayDto.dayOfWeek,
        isOpen: false,
        openTime: null,
        closeTime: null,
        breakStartTime: null,
        breakEndTime: null,
        spansMidnight: false,
      };
    }

    if (!dayDto.openTime || !dayDto.closeTime) {
      throw new BadRequestException({
        code: 'MISSING_OPENING_CLOSING_TIME',
        message: `Day ${dayDto.dayOfWeek} is marked open but missing openTime or closeTime`,
      });
    }

    if (
      !isValidTimeString(dayDto.openTime) ||
      !isValidTimeString(dayDto.closeTime)
    ) {
      throw new BadRequestException({
        code: 'INVALID_TIME_FORMAT',
        message: `Day ${dayDto.dayOfWeek} contains invalid time format. Expected HH:mm`,
      });
    }

    const openTime = dayDto.openTime.trim();
    const closeTime = dayDto.closeTime.trim();
    const spansMidnight = doesSpanMidnight(openTime, closeTime);

    let breakStartTime: string | null = null;
    let breakEndTime: string | null = null;

    if (dayDto.breakStartTime || dayDto.breakEndTime) {
      if (!dayDto.breakStartTime || !dayDto.breakEndTime) {
        throw new BadRequestException({
          code: 'INCOMPLETE_BREAK_PERIOD',
          message: `Day ${dayDto.dayOfWeek} must specify both breakStartTime and breakEndTime together`,
        });
      }

      if (
        !isValidTimeString(dayDto.breakStartTime) ||
        !isValidTimeString(dayDto.breakEndTime)
      ) {
        throw new BadRequestException({
          code: 'INVALID_TIME_FORMAT',
          message: `Day ${dayDto.dayOfWeek} contains invalid break time format. Expected HH:mm`,
        });
      }

      breakStartTime = dayDto.breakStartTime.trim();
      breakEndTime = dayDto.breakEndTime.trim();

      const validBreak = isValidBreakPeriod(
        openTime,
        closeTime,
        breakStartTime,
        breakEndTime,
      );

      if (!validBreak) {
        throw new BadRequestException({
          code: 'INVALID_BREAK_PERIOD',
          message: `Day ${dayDto.dayOfWeek} break period (${breakStartTime} - ${breakEndTime}) must fall strictly within working hours (${openTime} - ${closeTime})`,
        });
      }
    }

    return {
      dayOfWeek: dayDto.dayOfWeek,
      isOpen: true,
      openTime,
      closeTime,
      breakStartTime,
      breakEndTime,
      spansMidnight,
    };
  }

  /**
   * Helper to ensure complete weekly schedule representation (0=Sun .. 6=Sat)
   */
  private buildCompleteWeeklyDays(
    records: sms_businessHours[],
  ): FormattedBusinessHourDay[] {
    const recordMap = new Map<number, sms_businessHours>();
    records.forEach((r) => recordMap.set(r.dayOfWeek, r));

    const result: FormattedBusinessHourDay[] = [];
    for (let day = 0; day <= 6; day++) {
      const rec = recordMap.get(day);
      if (rec) {
        result.push({
          id: rec.id,
          dayOfWeek: rec.dayOfWeek,
          isOpen: rec.isOpen,
          openTime: rec.openTime,
          closeTime: rec.closeTime,
          breakStartTime: rec.breakStartTime,
          breakEndTime: rec.breakEndTime,
          spansMidnight: rec.spansMidnight,
        });
      } else {
        // Default template if day record not present in DB
        const isDefaultOpen = day >= 1 && day <= 6;
        result.push({
          dayOfWeek: day,
          isOpen: isDefaultOpen,
          openTime: isDefaultOpen ? '09:00' : null,
          closeTime: isDefaultOpen ? '18:00' : null,
          breakStartTime: isDefaultOpen ? '13:00' : null,
          breakEndTime: isDefaultOpen ? '14:00' : null,
          spansMidnight: false,
        });
      }
    }

    return result;
  }
}

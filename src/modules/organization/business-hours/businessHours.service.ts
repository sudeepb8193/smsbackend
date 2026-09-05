import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  DayScheduleDto,
  UpdateWeeklyHoursDto,
  CopyDayScheduleDto,
} from './dto/update-business-hours.dto';

@Injectable()
export class BusinessHoursService {
  constructor(private readonly prisma: PrismaService) {}

  public timeToMinutes(timeStr?: string): number | null {
    if (!timeStr) return null;
    const [hours, minutes] = timeStr.split(':').map((num) => parseInt(num, 10));
    return hours * 60 + minutes;
  }

  public validateDaySchedule(dto: DayScheduleDto): void {
    if (!dto.isOpen) return;

    if (!dto.openTime || !dto.closeTime) {
      throw new BadRequestException(
        `Day ${dto.dayOfWeek} is marked as open, so both openTime and closeTime are required.`,
      );
    }

    const openMin = this.timeToMinutes(dto.openTime)!;
    const closeMin = this.timeToMinutes(dto.closeTime)!;

    if (!dto.spansMidnight && closeMin <= openMin) {
      throw new BadRequestException(
        `Day ${dto.dayOfWeek} closeTime (${dto.closeTime}) must be after openTime (${dto.openTime}) unless spansMidnight is true.`,
      );
    }

    if (dto.breakStartTime || dto.breakEndTime) {
      if (!dto.breakStartTime || !dto.breakEndTime) {
        throw new BadRequestException(
          `Day ${dto.dayOfWeek} requires both breakStartTime and breakEndTime if a break is configured.`,
        );
      }

      const breakStartMin = this.timeToMinutes(dto.breakStartTime)!;
      const breakEndMin = this.timeToMinutes(dto.breakEndTime)!;

      if (breakEndMin <= breakStartMin) {
        throw new BadRequestException(
          `Day ${dto.dayOfWeek} breakEndTime (${dto.breakEndTime}) must be after breakStartTime (${dto.breakStartTime}).`,
        );
      }

      if (!dto.spansMidnight) {
        if (breakStartMin < openMin || breakEndMin > closeMin) {
          throw new BadRequestException(
            `Day ${dto.dayOfWeek} break window (${dto.breakStartTime}-${dto.breakEndTime}) must fall within opening hours (${dto.openTime}-${dto.closeTime}).`,
          );
        }
      }
    }
  }

  async getWeeklyHours(organizationId: number, branchId?: number) {
    const hours = await this.prisma.smsBusinessHours.findMany({
      where: {
        organizationId,
        branchId: branchId ?? null,
      },
      orderBy: { dayOfWeek: 'asc' },
    });

    return hours;
  }

  async getEffectiveBusinessHours(
    organizationId: number,
    branchId: number | null,
    dayOfWeek: number,
  ) {
    if (branchId) {
      const branchOverride = await this.prisma.smsBusinessHours.findFirst({
        where: {
          organizationId,
          branchId,
          dayOfWeek,
        },
      });
      if (branchOverride) {
        return branchOverride;
      }
    }

    // Fallback to organization default
    const orgDefault = await this.prisma.smsBusinessHours.findFirst({
      where: {
        organizationId,
        branchId: null,
        dayOfWeek,
      },
    });

    return orgDefault || null;
  }

  async upsertDaySchedule(
    organizationId: number,
    branchId: number | null,
    schedule: DayScheduleDto,
  ) {
    this.validateDaySchedule(schedule);

    const existing = await this.prisma.smsBusinessHours.findFirst({
      where: {
        organizationId,
        branchId: branchId ?? null,
        dayOfWeek: schedule.dayOfWeek,
      },
    });

    if (existing) {
      return this.prisma.smsBusinessHours.update({
        where: { id: existing.id },
        data: {
          isOpen: schedule.isOpen,
          openTime: schedule.openTime,
          closeTime: schedule.closeTime,
          breakStartTime: schedule.breakStartTime,
          breakEndTime: schedule.breakEndTime,
          spansMidnight: schedule.spansMidnight || false,
        },
      });
    }

    return this.prisma.smsBusinessHours.create({
      data: {
        organizationId,
        branchId: branchId ?? null,
        dayOfWeek: schedule.dayOfWeek,
        isOpen: schedule.isOpen,
        openTime: schedule.openTime,
        closeTime: schedule.closeTime,
        breakStartTime: schedule.breakStartTime,
        breakEndTime: schedule.breakEndTime,
        spansMidnight: schedule.spansMidnight || false,
      },
    });
  }

  async updateWeeklyHours(organizationId: number, dto: UpdateWeeklyHoursDto) {
    const branchId = dto.branchId ?? null;
    const results: any[] = [];

    for (const schedule of dto.schedules) {
      const res = await this.upsertDaySchedule(organizationId, branchId, schedule);
      results.push(res);
    }

    return results;
  }

  async copyDaySchedule(organizationId: number, dto: CopyDayScheduleDto) {
    const branchId = dto.branchId ?? null;

    const source = await this.prisma.smsBusinessHours.findFirst({
      where: {
        organizationId,
        branchId,
        dayOfWeek: dto.sourceDayOfWeek,
      },
    });

    if (!source) {
      throw new NotFoundException(
        `Source day schedule for dayOfWeek ${dto.sourceDayOfWeek} not found.`,
      );
    }

    const results: any[] = [];
    for (const targetDay of dto.targetDaysOfWeek) {
      const scheduleDto: DayScheduleDto = {
        dayOfWeek: targetDay,
        isOpen: source.isOpen,
        openTime: source.openTime || undefined,
        closeTime: source.closeTime || undefined,
        breakStartTime: source.breakStartTime || undefined,
        breakEndTime: source.breakEndTime || undefined,
        spansMidnight: source.spansMidnight,
      };

      const res = await this.upsertDaySchedule(organizationId, branchId, scheduleDto);
      results.push(res);
    }

    return results;
  }

  async resetBranchOverride(organizationId: number, branchId: number) {
    return this.prisma.smsBusinessHours.deleteMany({
      where: {
        organizationId,
        branchId,
      },
    });
  }
}

import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateHolidayDto, UpdateHolidayDto } from './dto/create-holiday.dto';

@Injectable()
export class HolidayService {
  constructor(private readonly prisma: PrismaService) {}

  async findByOrganization(organizationId: number, branchId?: number) {
    return this.prisma.smsHoliday.findMany({
      where: {
        organizationId,
        ...(branchId !== undefined ? { branchId } : {}),
      },
      include: {
        overrides: true,
      },
      orderBy: { holidayDate: 'asc' },
    });
  }

  async findById(id: number) {
    const holiday = await this.prisma.smsHoliday.findUnique({
      where: { id },
      include: { overrides: true },
    });
    if (!holiday) {
      throw new NotFoundException(`Holiday with ID ${id} not found.`);
    }
    return holiday;
  }

  async checkDuplicate(
    organizationId: number,
    branchId: number | null,
    targetDate: Date,
    isRecurring: boolean,
    excludeId?: number,
  ) {
    const month = targetDate.getMonth();
    const day = targetDate.getDate();

    const candidates = await this.prisma.smsHoliday.findMany({
      where: {
        organizationId,
        branchId: branchId ?? null,
        status: 'active',
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    for (const cand of candidates) {
      const candDate = new Date(cand.holidayDate);
      if (cand.isRecurringAnnually || isRecurring) {
        if (candDate.getMonth() === month && candDate.getDate() === day) {
          throw new ConflictException(
            `A holiday named '${cand.name}' already covers this date (${targetDate.toISOString().split('T')[0]}).`,
          );
        }
      } else {
        if (
          candDate.getFullYear() === targetDate.getFullYear() &&
          candDate.getMonth() === month &&
          candDate.getDate() === day
        ) {
          throw new ConflictException(
            `A holiday named '${cand.name}' already covers this date (${targetDate.toISOString().split('T')[0]}).`,
          );
        }
      }
    }
  }

  async createHoliday(organizationId: number, dto: CreateHolidayDto, userId?: number) {
    const targetDate = new Date(dto.holidayDate);
    const branchId = dto.branchId ?? null;
    const isRecurring = dto.isRecurringAnnually || false;

    await this.checkDuplicate(organizationId, branchId, targetDate, isRecurring);

    return this.prisma.smsHoliday.create({
      data: {
        organizationId,
        branchId,
        name: dto.name,
        description: dto.description,
        holidayDate: targetDate,
        isRecurringAnnually: isRecurring,
        status: dto.status || 'active',
        createdBy: userId || null,
      },
      include: { overrides: true },
    });
  }

  async updateHoliday(id: number, dto: UpdateHolidayDto) {
    const existing = await this.findById(id);

    const targetDate = dto.holidayDate ? new Date(dto.holidayDate) : new Date(existing.holidayDate);
    const branchId = dto.branchId !== undefined ? dto.branchId : existing.branchId;
    const isRecurring = dto.isRecurringAnnually !== undefined ? dto.isRecurringAnnually : existing.isRecurringAnnually;

    await this.checkDuplicate(existing.organizationId, branchId, targetDate, isRecurring, id);

    return this.prisma.smsHoliday.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        holidayDate: targetDate,
        branchId,
        isRecurringAnnually: isRecurring,
        status: dto.status,
      },
      include: { overrides: true },
    });
  }

  async cancelHoliday(id: number) {
    await this.findById(id);
    return this.prisma.smsHoliday.update({
      where: { id },
      data: { status: 'cancelled' },
    });
  }

  async overrideYear(holidayId: number, year: number, isCancelled = true) {
    await this.findById(holidayId);

    return this.prisma.smsHolidayOverride.upsert({
      where: {
        holidayId_year: {
          holidayId,
          year,
        },
      },
      create: {
        holidayId,
        year,
        isCancelled,
      },
      update: {
        isCancelled,
      },
    });
  }

  async isHoliday(
    organizationId: number,
    branchId: number | null,
    dateInput: Date | string,
  ) {
    const date = new Date(dateInput);
    const targetYear = date.getFullYear();
    const targetMonth = date.getMonth();
    const targetDay = date.getDate();

    const holidays = await this.prisma.smsHoliday.findMany({
      where: {
        organizationId,
        status: 'active',
        OR: [{ branchId: null }, ...(branchId ? [{ branchId }] : [])],
      },
      include: { overrides: true },
    });

    for (const hol of holidays) {
      const holDate = new Date(hol.holidayDate);
      let matchesDate = false;

      if (hol.isRecurringAnnually) {
        if (holDate.getMonth() === targetMonth && holDate.getDate() === targetDay) {
          matchesDate = true;
        }
      } else {
        if (
          holDate.getFullYear() === targetYear &&
          holDate.getMonth() === targetMonth &&
          holDate.getDate() === targetDay
        ) {
          matchesDate = true;
        }
      }

      if (matchesDate) {
        const yearOverride = hol.overrides.find((ov) => ov.year === targetYear);
        if (yearOverride && yearOverride.isCancelled) {
          continue; // Cancelled for this specific year
        }

        return {
          isHoliday: true,
          holiday: hol,
          reason: hol.name,
        };
      }
    }

    return {
      isHoliday: false,
      holiday: null,
      reason: null,
    };
  }

  async getEffectiveHolidays(
    organizationId: number,
    branchId: number | null,
    startDateInput: Date | string,
    endDateInput: Date | string,
  ) {
    const startDate = new Date(startDateInput);
    const endDate = new Date(endDateInput);
    const results: any[] = [];

    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const res = await this.isHoliday(organizationId, branchId, currentDate);
      if (res.isHoliday && res.holiday) {
        results.push({
          date: currentDate.toISOString().split('T')[0],
          name: res.holiday.name,
          holidayId: res.holiday.id,
          branchId: res.holiday.branchId,
          isRecurring: res.holiday.isRecurringAnnually,
        });
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return results;
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateHolidayDto } from '../dto/create-holiday.dto';
import { UpdateHolidayDto } from '../dto/update-holiday.dto';
import { QueryHolidayDto } from '../dto/query-holiday.dto';
import { sms_holidays_status } from '@prisma/client';

@Injectable()
export class OrganizationHolidayService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to safely parse YYYY-MM-DD string into a UTC Date object
   */
  private parseCalendarDate(dateStr: string): Date {
    const parts = dateStr.split('-');
    if (parts.length !== 3) {
      throw new BadRequestException('Invalid date format. Expected YYYY-MM-DD');
    }
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const date = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Invalid calendar date provided');
    }
    return date;
  }

  /**
   * Validate branch ownership if branchId is provided
   */
  private async validateBranchOwnership(
    organizationId: string,
    branchId?: string,
  ) {
    if (!branchId) return;

    const branch = await this.prisma.sms_branches.findFirst({
      where: {
        id: branchId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!branch) {
      throw new BadRequestException({
        code: 'INVALID_BRANCH',
        message: 'Branch not found or does not belong to your organization',
      });
    }
  }

  /**
   * Create a new Holiday (Organization-level or Branch-level)
   */
  async createHoliday(
    organizationId: string,
    createdById: string | null,
    dto: CreateHolidayDto,
  ) {
    await this.validateBranchOwnership(organizationId, dto.branchId);

    const holidayDate = this.parseCalendarDate(dto.holidayDate);
    const isRecurring = dto.isRecurring ?? dto.isRecurringAnnually ?? false;
    const targetBranchId = dto.branchId || null;

    // Check duplicate active holidays within the exact scope
    await this.checkDuplicateHoliday(
      organizationId,
      targetBranchId,
      dto.name,
      holidayDate,
      isRecurring,
    );

    return this.prisma.$transaction(async (tx) => {
      return tx.sms_holidays.create({
        data: {
          organizationId,
          branchId: targetBranchId,
          name: dto.name,
          description: dto.description || null,
          holidayDate,
          isRecurringAnnually: isRecurring,
          status: sms_holidays_status.active,
          createdById,
        },
      });
    });
  }

  /**
   * List holidays with multi-tenant isolation and optional calendar filters
   */
  async getHolidays(organizationId: string, query: QueryHolidayDto) {
    const where: any = {
      organizationId,
      deletedAt: null,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.branchId !== undefined) {
      where.branchId = query.branchId;
    } else if (!query.includeBranchHolidays) {
      where.branchId = null; // Organization-wide holidays by default
    }

    if (query.year) {
      const year = query.year;
      if (query.month) {
        const startDate = new Date(Date.UTC(year, query.month - 1, 1));
        const endDate = new Date(Date.UTC(year, query.month, 0, 23, 59, 59));
        where.holidayDate = { gte: startDate, lte: endDate };
      } else {
        const startDate = new Date(Date.UTC(year, 0, 1));
        const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
        where.holidayDate = { gte: startDate, lte: endDate };
      }
    }

    return this.prisma.sms_holidays.findMany({
      where,
      orderBy: { holidayDate: 'asc' },
    });
  }

  /**
   * Get single holiday by ID with tenant security check
   */
  async getHolidayById(organizationId: string, holidayId: string) {
    const holiday = await this.prisma.sms_holidays.findFirst({
      where: {
        id: holidayId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!holiday) {
      throw new NotFoundException({
        code: 'HOLIDAY_NOT_FOUND',
        message: 'Holiday not found or does not belong to your organization',
      });
    }

    return holiday;
  }

  /**
   * Update holiday configuration
   */
  async updateHoliday(
    organizationId: string,
    holidayId: string,
    dto: UpdateHolidayDto,
  ) {
    const existing = await this.getHolidayById(organizationId, holidayId);

    if (
      existing.status === sms_holidays_status.cancelled &&
      dto.status !== sms_holidays_status.active
    ) {
      if (dto.name || dto.holidayDate || dto.description) {
        throw new BadRequestException({
          code: 'CANCELLED_HOLIDAY_READONLY',
          message:
            'Cannot modify details of a cancelled holiday unless restoring status to active',
        });
      }
    }

    const newName = dto.name !== undefined ? dto.name : existing.name;
    const newDate = dto.holidayDate
      ? this.parseCalendarDate(dto.holidayDate)
      : existing.holidayDate;
    const newRecurring =
      dto.isRecurring !== undefined
        ? dto.isRecurring
        : dto.isRecurringAnnually !== undefined
          ? dto.isRecurringAnnually
          : existing.isRecurringAnnually;

    // Check duplicates if name or date changed
    if (
      dto.name !== undefined ||
      dto.holidayDate !== undefined ||
      dto.isRecurring !== undefined ||
      dto.isRecurringAnnually !== undefined
    ) {
      await this.checkDuplicateHoliday(
        organizationId,
        existing.branchId,
        newName,
        newDate,
        newRecurring,
        existing.id,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      return tx.sms_holidays.update({
        where: { id: existing.id },
        data: {
          name: newName,
          description:
            dto.description !== undefined
              ? dto.description
              : existing.description,
          holidayDate: newDate,
          isRecurringAnnually: newRecurring,
          status: dto.status !== undefined ? dto.status : existing.status,
        },
      });
    });
  }

  /**
   * Cancel a holiday (business state transition, retains audit history)
   */
  async cancelHoliday(organizationId: string, holidayId: string) {
    const existing = await this.getHolidayById(organizationId, holidayId);

    if (existing.status === sms_holidays_status.cancelled) {
      return existing;
    }

    return this.prisma.sms_holidays.update({
      where: { id: existing.id },
      data: { status: sms_holidays_status.cancelled },
    });
  }

  /**
   * Soft delete a holiday record (record lifecycle)
   */
  async deleteHoliday(organizationId: string, holidayId: string) {
    const existing = await this.getHolidayById(organizationId, holidayId);

    return this.prisma.sms_holidays.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Duplicate detection logic across scope (organizationId + branchId)
   */
  private async checkDuplicateHoliday(
    organizationId: string,
    branchId: string | null,
    name: string,
    holidayDate: Date,
    isRecurring: boolean,
    excludeId?: string,
  ) {
    const activeHolidays = await this.prisma.sms_holidays.findMany({
      where: {
        organizationId,
        branchId,
        status: sms_holidays_status.active,
        deletedAt: null,
        id: excludeId ? { not: excludeId } : undefined,
      },
    });

    const targetMonth = holidayDate.getUTCMonth();
    const targetDay = holidayDate.getUTCDate();
    const targetYear = holidayDate.getUTCFullYear();

    for (const h of activeHolidays) {
      const existingDate = new Date(h.holidayDate);
      const existingMonth = existingDate.getUTCMonth();
      const existingDay = existingDate.getUTCDate();
      const existingYear = existingDate.getUTCFullYear();

      // Check name match
      if (h.name.toLowerCase() === name.toLowerCase()) {
        throw new BadRequestException({
          code: 'DUPLICATE_HOLIDAY_NAME',
          message: `An active holiday named "${name}" already exists in this scope`,
        });
      }

      // Check exact date match or annual recurrence match
      if (isRecurring || h.isRecurringAnnually) {
        if (existingMonth === targetMonth && existingDay === targetDay) {
          throw new BadRequestException({
            code: 'DUPLICATE_HOLIDAY_DATE',
            message: `An active recurring holiday already exists for ${targetMonth + 1}/${targetDay} in this scope`,
          });
        }
      } else {
        if (
          existingYear === targetYear &&
          existingMonth === targetMonth &&
          existingDay === targetDay
        ) {
          throw new BadRequestException({
            code: 'DUPLICATE_HOLIDAY_DATE',
            message: `An active holiday already exists for date ${holidayDate.toISOString().split('T')[0]} in this scope`,
          });
        }
      }
    }
  }
}

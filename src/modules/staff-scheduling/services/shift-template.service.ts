import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { EffectivePermissionResolverService } from '../../role-permission/services/effective-permission-resolver.service';
import {
  CreateShiftTemplateDto,
  UpdateShiftTemplateDto,
  QueryShiftTemplateDto,
} from '../dto/shift-template.dto';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import {
  validateShiftAndBreakTimes,
  parseTimeToDate,
  formatTime,
} from '../utils/time-range.util';
import { SchedulingAccessHelper } from '../utils/scheduling-access.util';
import { Prisma } from '@prisma/client';

@Injectable()
export class ShiftTemplateService {
  private readonly logger = new Logger(ShiftTemplateService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    private readonly permissionResolver?: EffectivePermissionResolverService,
  ) {}

  /**
   * Create a new shift template (Task 7.1)
   */
  async createTemplate(
    organizationId: string,
    dto: CreateShiftTemplateDto,
    user: AuthenticatedUser,
  ) {
    if (!organizationId) {
      throw new BadRequestException('organizationId is required');
    }

    // 1. RBAC and branch access check
    await SchedulingAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      organizationId,
      'staff_schedule.create',
      dto.branchId || undefined,
    );

    // 2. Branch ownership validation if branch-specific
    if (dto.branchId) {
      const branch = await this.prisma.sms_branches.findFirst({
        where: { id: dto.branchId, organizationId, deletedAt: null },
      });
      if (!branch) {
        throw new NotFoundException({
          code: 'BRANCH_NOT_FOUND',
          message: 'Target branch not found in this organization',
        });
      }
    }

    // 3. Time range and break window validation
    const timeValidation = validateShiftAndBreakTimes(
      dto.startTime,
      dto.endTime,
      dto.breakStartTime,
      dto.breakEndTime,
    );
    if (!timeValidation.valid) {
      throw new BadRequestException({
        code: 'INVALID_TIME_RANGE',
        message: timeValidation.error,
      });
    }

    // 4. Duplicate name check within the same organization and branch scope
    const existing = await this.prisma.sms_shiftTemplates.findFirst({
      where: {
        organizationId,
        branchId: dto.branchId || null,
        name: { equals: dto.name.trim(), mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_TEMPLATE_NAME',
        message: `A shift template with name "${dto.name}" already exists for this ${
          dto.branchId ? 'branch' : 'organization'
        }`,
      });
    }

    // 5. Create template
    const template = await this.prisma.sms_shiftTemplates.create({
      data: {
        organizationId,
        branchId: dto.branchId || null,
        name: dto.name.trim(),
        startTime: parseTimeToDate(dto.startTime)!,
        endTime: parseTimeToDate(dto.endTime)!,
        breakStartTime: parseTimeToDate(dto.breakStartTime),
        breakEndTime: parseTimeToDate(dto.breakEndTime),
        colorTag: dto.colorTag || 'default',
        status: dto.status || 'active',
      },
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    // 6. Audit log
    await SchedulingAccessHelper.recordAuditLog(
      this.prisma,
      organizationId,
      user.id,
      'CREATE_SHIFT_TEMPLATE',
      null,
      template,
    );

    return this.serializeTemplate(template);
  }

  /**
   * List shift templates (Task 7.1)
   */
  async getTemplates(
    organizationId: string,
    query: QueryShiftTemplateDto,
    user: AuthenticatedUser,
  ) {
    if (!organizationId) {
      throw new BadRequestException('organizationId is required');
    }

    await SchedulingAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      organizationId,
      'staff_schedule.view',
      query.branchId,
    );

    const where: Prisma.sms_shiftTemplatesWhereInput = {
      organizationId,
    };

    if (query.status && query.status !== 'all') {
      where.status = query.status as any;
    }

    if (query.branchId) {
      // Return both organization-wide templates and templates specific to this branch
      where.OR = [{ branchId: null }, { branchId: query.branchId }];
    }

    if (query.search) {
      where.name = { contains: query.search.trim(), mode: 'insensitive' };
    }

    const templates = await this.prisma.sms_shiftTemplates.findMany({
      where,
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
        _count: {
          select: {
            staffWeeklySchedules: true,
          },
        },
      },
      orderBy: [{ branchId: 'asc' }, { name: 'asc' }],
    });

    return templates.map((t) => this.serializeTemplate(t));
  }

  /**
   * Get template by ID
   */
  async getTemplateById(
    organizationId: string,
    templateId: string,
    user: AuthenticatedUser,
  ) {
    const template = await this.prisma.sms_shiftTemplates.findFirst({
      where: { id: templateId, organizationId },
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
        _count: {
          select: {
            staffWeeklySchedules: true,
          },
        },
      },
    });

    if (!template) {
      throw new NotFoundException({
        code: 'TEMPLATE_NOT_FOUND',
        message: 'Shift template not found',
      });
    }

    await SchedulingAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      organizationId,
      'staff_schedule.view',
      template.branchId || undefined,
    );

    return this.serializeTemplate(template);
  }

  /**
   * Update shift template (Task 7.1)
   */
  async updateTemplate(
    organizationId: string,
    templateId: string,
    dto: UpdateShiftTemplateDto,
    user: AuthenticatedUser,
  ) {
    const existing = await this.prisma.sms_shiftTemplates.findFirst({
      where: { id: templateId, organizationId },
      include: { branch: true },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'TEMPLATE_NOT_FOUND',
        message: 'Shift template not found',
      });
    }

    await SchedulingAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      organizationId,
      'staff_schedule.update',
      existing.branchId || undefined,
    );

    // Validate times if provided
    const newStart = dto.startTime || formatTime(existing.startTime)!;
    const newEnd = dto.endTime || formatTime(existing.endTime)!;
    const newBreakStart =
      dto.breakStartTime !== undefined
        ? dto.breakStartTime
        : formatTime(existing.breakStartTime);
    const newBreakEnd =
      dto.breakEndTime !== undefined
        ? dto.breakEndTime
        : formatTime(existing.breakEndTime);

    const timeValidation = validateShiftAndBreakTimes(
      newStart,
      newEnd,
      newBreakStart,
      newBreakEnd,
    );

    if (!timeValidation.valid) {
      throw new BadRequestException({
        code: 'INVALID_TIME_RANGE',
        message: timeValidation.error,
      });
    }

    // Name uniqueness check if renaming
    if (dto.name && dto.name.trim() !== existing.name) {
      const targetBranchId =
        dto.branchId !== undefined ? dto.branchId : existing.branchId;
      const dup = await this.prisma.sms_shiftTemplates.findFirst({
        where: {
          organizationId,
          branchId: targetBranchId,
          name: { equals: dto.name.trim(), mode: 'insensitive' },
          id: { not: templateId },
        },
      });

      if (dup) {
        throw new ConflictException({
          code: 'DUPLICATE_TEMPLATE_NAME',
          message: `A shift template with name "${dto.name}" already exists for this scope`,
        });
      }
    }

    const updated = await this.prisma.sms_shiftTemplates.update({
      where: { id: templateId },
      data: {
        name: dto.name ? dto.name.trim() : undefined,
        startTime: dto.startTime ? parseTimeToDate(dto.startTime)! : undefined,
        endTime: dto.endTime ? parseTimeToDate(dto.endTime)! : undefined,
        breakStartTime:
          dto.breakStartTime !== undefined
            ? parseTimeToDate(dto.breakStartTime)
            : undefined,
        breakEndTime:
          dto.breakEndTime !== undefined
            ? parseTimeToDate(dto.breakEndTime)
            : undefined,
        colorTag: dto.colorTag || undefined,
        branchId: dto.branchId !== undefined ? dto.branchId : undefined,
        status: dto.status || undefined,
      },
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
        _count: {
          select: { staffWeeklySchedules: true },
        },
      },
    });

    await SchedulingAccessHelper.recordAuditLog(
      this.prisma,
      organizationId,
      user.id,
      'UPDATE_SHIFT_TEMPLATE',
      existing,
      updated,
    );

    return this.serializeTemplate(updated);
  }

  /**
   * Retire / Deactivate template (Task 7.1)
   */
  async retireTemplate(
    organizationId: string,
    templateId: string,
    user: AuthenticatedUser,
  ) {
    return this.updateTemplate(
      organizationId,
      templateId,
      { status: 'inactive' },
      user,
    );
  }

  /**
   * Reactivate template (Task 7.1)
   */
  async reactivateTemplate(
    organizationId: string,
    templateId: string,
    user: AuthenticatedUser,
  ) {
    return this.updateTemplate(
      organizationId,
      templateId,
      { status: 'active' },
      user,
    );
  }

  /**
   * Delete template or redirect to retire if in use (Task 7.1)
   */
  async deleteTemplate(
    organizationId: string,
    templateId: string,
    user: AuthenticatedUser,
  ) {
    const existing = await this.prisma.sms_shiftTemplates.findFirst({
      where: { id: templateId, organizationId },
      include: {
        _count: {
          select: { staffWeeklySchedules: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'TEMPLATE_NOT_FOUND',
        message: 'Shift template not found',
      });
    }

    await SchedulingAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      organizationId,
      'staff_schedule.delete',
      existing.branchId || undefined,
    );

    // If template is referenced by schedules, redirect into retire flow
    if (existing._count.staffWeeklySchedules > 0) {
      const retired = await this.prisma.sms_shiftTemplates.update({
        where: { id: templateId },
        data: { status: 'inactive' },
      });

      await SchedulingAccessHelper.recordAuditLog(
        this.prisma,
        organizationId,
        user.id,
        'RETIRE_SHIFT_TEMPLATE_IN_USE',
        existing,
        retired,
      );

      return {
        action: 'retired',
        message:
          'Shift template is actively in use by historical or existing staff schedules. It has been marked inactive instead of deleted to protect schedule integrity.',
        template: this.serializeTemplate(retired),
      };
    }

    // Otherwise safe to hard delete
    await this.prisma.sms_shiftTemplates.delete({
      where: { id: templateId },
    });

    await SchedulingAccessHelper.recordAuditLog(
      this.prisma,
      organizationId,
      user.id,
      'DELETE_SHIFT_TEMPLATE',
      existing,
      null,
    );

    return {
      action: 'deleted',
      message: 'Shift template deleted successfully',
      id: templateId,
    };
  }

  /**
   * Helper to format response dates/times consistently
   */
  public serializeTemplate(template: any) {
    return {
      id: template.id,
      organizationId: template.organizationId,
      branchId: template.branchId,
      branch: template.branch || null,
      name: template.name,
      startTime: formatTime(template.startTime),
      endTime: formatTime(template.endTime),
      breakStartTime: formatTime(template.breakStartTime),
      breakEndTime: formatTime(template.breakEndTime),
      colorTag: template.colorTag,
      status: template.status,
      usageCount: template._count?.staffWeeklySchedules ?? 0,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }
}


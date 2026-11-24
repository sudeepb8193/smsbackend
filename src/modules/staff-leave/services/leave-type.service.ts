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
import { CreateLeaveTypeDto } from '../dto/create-leave-type.dto';
import { UpdateLeaveTypeDto } from '../dto/update-leave-type.dto';
import { QueryLeaveTypeDto } from '../dto/query-leave-type.dto';
import { LeaveAccessHelper } from '../utils/leave-access.util';
import { LEAVE_CONSTANTS } from '../utils/leave-constants';
import { sms_activeInactive, Prisma } from '@prisma/client';

@Injectable()
export class LeaveTypeService {
  private readonly logger = new Logger(LeaveTypeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionResolver: EffectivePermissionResolverService,
  ) {}

  /**
   * Task 9.1: Create a new Organization Leave Type
   */
  async createLeaveType(
    user: AuthenticatedUser,
    dto: CreateLeaveTypeDto,
    queryOrgId?: string,
  ) {
    const orgId = LeaveAccessHelper.resolveOrgId(user, queryOrgId);
    await LeaveAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      orgId,
      'staff_leave.manage',
    );

    const normCode = dto.code.trim().toUpperCase();

    // Check unique code within organization
    const existing = await this.prisma.sms_leaveTypes.findFirst({
      where: {
        organizationId: orgId,
        code: normCode,
      },
    });

    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_LEAVE_CODE',
        message: `Leave type with code '${normCode}' already exists in this organization`,
      });
    }

    const created = await this.prisma.sms_leaveTypes.create({
      data: {
        organizationId: orgId,
        name: dto.name.trim(),
        code: normCode,
        isPaid: dto.isPaid ?? true,
        accrualMethod: dto.accrualMethod || 'annual_grant',
        annualEntitlementDays: new Prisma.Decimal(dto.annualEntitlementDays || 0),
        monthlyAccrualDays:
          dto.monthlyAccrualDays !== undefined && dto.monthlyAccrualDays !== null
            ? new Prisma.Decimal(dto.monthlyAccrualDays)
            : null,
        maxCarryForwardDays: new Prisma.Decimal(dto.maxCarryForwardDays || 0),
        documentRequiredAfterDays:
          dto.documentRequiredAfterDays !== undefined && dto.documentRequiredAfterDays !== null
            ? new Prisma.Decimal(dto.documentRequiredAfterDays)
            : null,
        minNoticeDays: dto.minNoticeDays || 0,
        applicableGender: dto.applicableGender || 'all',
        status: 'active',
      },
    });

    await LeaveAccessHelper.recordAuditLog(
      this.prisma,
      orgId,
      user.id,
      'LEAVE_TYPE_CREATED',
      null,
      created,
    );

    return created;
  }

  /**
   * Task 9.1: List Leave Types for Organization (Paginated & Filtered)
   */
  async listLeaveTypes(
    user: AuthenticatedUser,
    query: QueryLeaveTypeDto,
    queryOrgId?: string,
  ) {
    const orgId = LeaveAccessHelper.resolveOrgId(user, queryOrgId);
    await LeaveAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      orgId,
      'staff_leave.view',
    );

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.sms_leaveTypesWhereInput = {
      organizationId: orgId,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      const s = query.search.trim();
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { code: { contains: s, mode: 'insensitive' } },
      ];
    }

    const sortOrder: Prisma.SortOrder = query.sortOrder === 'desc' ? 'desc' : 'asc';
    let orderBy: Prisma.sms_leaveTypesOrderByWithRelationInput[];
    switch (query.sortBy) {
      case 'code':
        orderBy = [{ code: sortOrder }];
        break;
      case 'annualEntitlementDays':
        orderBy = [{ annualEntitlementDays: sortOrder }];
        break;
      case 'status':
        orderBy = [{ status: sortOrder }];
        break;
      case 'createdAt':
        orderBy = [{ createdAt: sortOrder }];
        break;
      case 'name':
        orderBy = [{ name: sortOrder }];
        break;
      default:
        orderBy = [{ status: 'asc' }, { name: 'asc' }];
        break;
    }

    const [items, total] = await Promise.all([
      this.prisma.sms_leaveTypes.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          _count: {
            select: {
              staffLeaveBalances: true,
              staffLeaveRequests: true,
            },
          },
        },
      }),
      this.prisma.sms_leaveTypes.count({ where }),
    ]);

    return {
      items,
      data: items,
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
   * Task 9.1: Get Leave Type by ID
   */
  async getLeaveTypeById(
    user: AuthenticatedUser,
    id: string,
    queryOrgId?: string,
  ) {
    const orgId = LeaveAccessHelper.resolveOrgId(user, queryOrgId);
    await LeaveAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      orgId,
      'staff_leave.view',
    );

    const leaveType = await this.prisma.sms_leaveTypes.findFirst({
      where: { id, organizationId: orgId },
      include: {
        _count: {
          select: {
            staffLeaveBalances: true,
            staffLeaveRequests: true,
          },
        },
      },
    });

    if (!leaveType) {
      throw new NotFoundException({
        code: 'LEAVE_TYPE_NOT_FOUND',
        message: 'Leave type not found in this organization',
      });
    }

    return leaveType;
  }

  /**
   * Task 9.1: Update Leave Type Configuration
   */
  async updateLeaveType(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateLeaveTypeDto,
    queryOrgId?: string,
  ) {
    const orgId = LeaveAccessHelper.resolveOrgId(user, queryOrgId);
    await LeaveAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      orgId,
      'staff_leave.manage',
    );

    const existing = await this.prisma.sms_leaveTypes.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'LEAVE_TYPE_NOT_FOUND',
        message: 'Leave type not found in this organization',
      });
    }

    if (dto.code && dto.code.trim().toUpperCase() !== existing.code) {
      const normCode = dto.code.trim().toUpperCase();
      const codeConflict = await this.prisma.sms_leaveTypes.findFirst({
        where: {
          organizationId: orgId,
          code: normCode,
          id: { not: id },
        },
      });
      if (codeConflict) {
        throw new ConflictException({
          code: 'DUPLICATE_LEAVE_CODE',
          message: `Leave type with code '${normCode}' already exists`,
        });
      }
    }

    const updated = await this.prisma.sms_leaveTypes.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.code ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.isPaid !== undefined ? { isPaid: dto.isPaid } : {}),
        ...(dto.accrualMethod ? { accrualMethod: dto.accrualMethod } : {}),
        ...(dto.annualEntitlementDays !== undefined
          ? { annualEntitlementDays: new Prisma.Decimal(dto.annualEntitlementDays) }
          : {}),
        ...(dto.monthlyAccrualDays !== undefined
          ? {
              monthlyAccrualDays:
                dto.monthlyAccrualDays !== null
                  ? new Prisma.Decimal(dto.monthlyAccrualDays)
                  : null,
            }
          : {}),
        ...(dto.maxCarryForwardDays !== undefined
          ? { maxCarryForwardDays: new Prisma.Decimal(dto.maxCarryForwardDays) }
          : {}),
        ...(dto.documentRequiredAfterDays !== undefined
          ? {
              documentRequiredAfterDays:
                dto.documentRequiredAfterDays !== null
                  ? new Prisma.Decimal(dto.documentRequiredAfterDays)
                  : null,
            }
          : {}),
        ...(dto.minNoticeDays !== undefined ? { minNoticeDays: dto.minNoticeDays } : {}),
        ...(dto.applicableGender ? { applicableGender: dto.applicableGender } : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
    });

    await LeaveAccessHelper.recordAuditLog(
      this.prisma,
      orgId,
      user.id,
      'LEAVE_TYPE_UPDATED',
      existing,
      updated,
    );

    return updated;
  }

  /**
   * Task 9.1: Safe Toggle / Deactivation of Leave Type
   */
  async setLeaveTypeStatus(
    user: AuthenticatedUser,
    id: string,
    status: sms_activeInactive,
    queryOrgId?: string,
  ) {
    const orgId = LeaveAccessHelper.resolveOrgId(user, queryOrgId);
    await LeaveAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      orgId,
      'staff_leave.manage',
    );

    const existing = await this.prisma.sms_leaveTypes.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'LEAVE_TYPE_NOT_FOUND',
        message: 'Leave type not found in this organization',
      });
    }

    const updated = await this.prisma.sms_leaveTypes.update({
      where: { id },
      data: { status },
    });

    await LeaveAccessHelper.recordAuditLog(
      this.prisma,
      orgId,
      user.id,
      status === 'active' ? 'LEAVE_TYPE_ACTIVATED' : 'LEAVE_TYPE_DEACTIVATED',
      existing,
      updated,
    );

    return updated;
  }

  /**
   * Task 9.1: Idempotent Seed of Organization Defaults
   */
  async seedDefaultLeaveTypes(
    user: AuthenticatedUser,
    queryOrgId?: string,
  ) {
    const orgId = LeaveAccessHelper.resolveOrgId(user, queryOrgId);
    await LeaveAccessHelper.validateUserAccess(
      this.prisma,
      this.permissionResolver,
      user,
      orgId,
      'staff_leave.manage',
    );

    const seeded: any[] = [];
    for (const def of LEAVE_CONSTANTS.DEFAULT_LEAVE_TYPES) {
      const existing = await this.prisma.sms_leaveTypes.findFirst({
        where: { organizationId: orgId, code: def.code },
      });

      if (!existing) {
        const item = await this.prisma.sms_leaveTypes.create({
          data: {
            organizationId: orgId,
            name: def.name,
            code: def.code,
            isPaid: def.isPaid,
            accrualMethod: def.accrualMethod,
            annualEntitlementDays: new Prisma.Decimal(def.annualEntitlementDays),
            monthlyAccrualDays:
              def.monthlyAccrualDays !== null
                ? new Prisma.Decimal(def.monthlyAccrualDays)
                : null,
            maxCarryForwardDays: new Prisma.Decimal(def.maxCarryForwardDays),
            documentRequiredAfterDays:
              def.documentRequiredAfterDays !== null
                ? new Prisma.Decimal(def.documentRequiredAfterDays)
                : null,
            minNoticeDays: def.minNoticeDays,
            applicableGender: def.applicableGender,
            status: 'active',
          },
        });
        seeded.push(item);
      }
    }

    return {
      message: `Seeded ${seeded.length} default leave types for organization`,
      count: seeded.length,
      seeded,
    };
  }
}

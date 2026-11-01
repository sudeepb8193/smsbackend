import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateStaffDto } from '../dto/create-staff.dto';
import { UpdateStaffDto } from '../dto/update-staff.dto';
import { QueryStaffDto } from '../dto/query-staff.dto';
import { UpdateStaffStatusDto } from '../dto/update-staff-status.dto';
import { UpsertStaffContactsDto } from '../dto/upsert-staff-contacts.dto';
import {
  CreateEmergencyContactDto,
  UpdateEmergencyContactDto,
} from '../dto/emergency-contact.dto';
import { CreateEmploymentHistoryDto } from '../dto/create-employment-history.dto';
import {
  CreateQualificationDto,
  UpdateQualificationDto,
} from '../dto/qualification.dto';
import { CreateDocumentDto } from '../dto/document.dto';
import {
  CreateBranchAssignmentDto,
  TransferHomeBranchDto,
} from '../dto/branch-assignment.dto';
import {
  encryptSensitiveData,
  decryptSensitiveData,
  maskNationalId,
} from '../utils/encryption.util';
import {
  sms_staff_employmentStatus,
  sms_staffQualifications_recordType,
  sms_staffDocuments_status,
  sms_staffBranchAssignments_assignmentType,
  sms_branchManagerAssignments_assignmentType,
  Prisma,
} from '@prisma/client';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';

@Injectable()
export class StaffService {
  private readonly logger = new Logger(StaffService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper: Write an audit log entry
   */
  private async logAudit(params: {
    organizationId: string;
    performedById?: string;
    action: string;
    oldValue?: any;
    newValue?: any;
    ipAddress?: string;
  }) {
    try {
      await this.prisma.sms_auditLogs.create({
        data: {
          organizationId: params.organizationId,
          performedById: params.performedById || null,
          action: params.action,
          oldValue: params.oldValue ? JSON.parse(JSON.stringify(params.oldValue)) : undefined,
          newValue: params.newValue ? JSON.parse(JSON.stringify(params.newValue)) : undefined,
          ipAddress: params.ipAddress || null,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to write audit log: ${err.message}`);
    }
  }

  /**
   * Helper: Concurrency-safe employee code generation
   */
  async generateEmployeeCode(
    organizationId: string,
    prefix = 'EMP',
  ): Promise<string> {
    const cleanPrefix = (prefix || 'EMP').trim().toUpperCase().replace(/[-_]+$/, '');
    
    // Find highest numerical suffix for this prefix in the organization
    const existing = await this.prisma.sms_staff.findMany({
      where: {
        organizationId,
        employeeCode: {
          startsWith: cleanPrefix,
          mode: 'insensitive',
        },
      },
      select: { employeeCode: true },
    });

    let maxNum = 0;
    const regex = new RegExp(`^${cleanPrefix}[-_]?(\\d+)$`, 'i');

    for (const item of existing) {
      const match = item.employeeCode.match(regex);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }

    const nextNum = maxNum + 1;
    const padded = String(nextNum).padStart(4, '0');
    return `${cleanPrefix}-${padded}`;
  }

  // =========================================================================
  // TASK 5.1: EMPLOYEE PROFILE & IDENTITY
  // =========================================================================

  async create(organizationId: string, performedById: string | undefined, dto: CreateStaffDto) {
    // 1. Verify Home Branch exists and belongs to organization
    const branch = await this.prisma.sms_branches.findFirst({
      where: {
        id: dto.homeBranchId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!branch) {
      throw new NotFoundException({
        code: 'BRANCH_NOT_FOUND',
        message: 'Home branch does not exist or does not belong to your organization',
      });
    }

    if (branch.status === 'permanently_closed') {
      throw new BadRequestException({
        code: 'BRANCH_CLOSED',
        message: 'Cannot assign an employee to a permanently closed branch',
      });
    }

    // 2. If userId provided, verify user belongs to org and is not already linked
    if (dto.userId) {
      const user = await this.prisma.sms_users.findFirst({
        where: {
          id: dto.userId,
          organizationId,
          deletedAt: null,
        },
      });

      if (!user) {
        throw new NotFoundException({
          code: 'USER_NOT_FOUND',
          message: 'The specified login user was not found in your organization',
        });
      }

      const existingStaff = await this.prisma.sms_staff.findFirst({
        where: { userId: dto.userId, deletedAt: null },
      });

      if (existingStaff) {
        throw new ConflictException({
          code: 'USER_ALREADY_LINKED',
          message: 'This user account is already linked to another employee profile',
        });
      }
    }

    // 3. Resolve or generate unique employee code
    let employeeCode = dto.employeeCode?.trim().toUpperCase();
    if (!employeeCode) {
      employeeCode = await this.generateEmployeeCode(organizationId, 'EMP');
    } else {
      const duplicate = await this.prisma.sms_staff.findFirst({
        where: { employeeCode, deletedAt: null },
      });
      if (duplicate) {
        throw new ConflictException({
          code: 'DUPLICATE_EMPLOYEE_CODE',
          message: `Employee code ${employeeCode} already exists`,
        });
      }
    }

    // 4. Execute atomic transaction
    const staff = await this.prisma.$transaction(async (tx) => {
      // Create master staff record
      const createdStaff = await tx.sms_staff.create({
        data: {
          organizationId,
          employeeCode,
          fullName: dto.fullName.trim(),
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
          gender: dto.gender || null,
          profilePhotoUrl: dto.profilePhotoUrl || null,
          homeBranchId: dto.homeBranchId,
          employmentStatus: dto.employmentStatus || sms_staff_employmentStatus.active,
          userId: dto.userId || null,
          createdById: performedById || null,
        },
      });

      // Create initial Home Branch assignment
      await tx.sms_staffBranchAssignments.create({
        data: {
          staffId: createdStaff.id,
          branchId: dto.homeBranchId,
          assignmentType: sms_staffBranchAssignments_assignmentType.home,
          effectiveFrom: dto.joiningDate ? new Date(dto.joiningDate) : new Date(),
          createdById: performedById || null,
        },
      });

      // If initial employment details provided, record initial employment history
      if (dto.designation || dto.department) {
        await tx.sms_staffEmploymentHistory.create({
          data: {
            staffId: createdStaff.id,
            designation: dto.designation || 'Staff',
            department: dto.department || 'Operations',
            employmentType: dto.employmentType || 'full_time',
            joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : new Date(),
            effectiveFrom: dto.joiningDate ? new Date(dto.joiningDate) : new Date(),
            confirmationDate: dto.confirmationDate ? new Date(dto.confirmationDate) : null,
            changeReason: 'initial_hire',
            recordedById: performedById || null,
          },
        });
      }

      // If initial contact details provided, create contact record
      if (
        dto.personalPhone ||
        dto.personalEmail ||
        dto.addressLine1 ||
        dto.city ||
        dto.nationalIdNumber
      ) {
        await tx.sms_staffContacts.create({
          data: {
            staffId: createdStaff.id,
            personalPhone: dto.personalPhone || null,
            personalEmail: dto.personalEmail || null,
            addressLine1: dto.addressLine1 || null,
            addressLine2: dto.addressLine2 || null,
            city: dto.city || null,
            state: dto.state || null,
            postalCode: dto.postalCode || null,
            countryCode: dto.countryCode || null,
            bloodGroup: dto.bloodGroup || null,
            maritalStatus: dto.maritalStatus || null,
            nationalIdNumberEncrypted: dto.nationalIdNumber
              ? encryptSensitiveData(dto.nationalIdNumber)
              : null,
          },
        });
      }

      return createdStaff;
    });

    await this.logAudit({
      organizationId,
      performedById,
      action: 'STAFF_CREATED',
      newValue: {
        id: staff.id,
        employeeCode: staff.employeeCode,
        fullName: staff.fullName,
        homeBranchId: staff.homeBranchId,
      },
    });

    return this.findOne(organizationId, staff.id);
  }

  async findAll(
    organizationId: string,
    query: QueryStaffDto,
    allowedBranchIds?: string[],
    currentUser?: AuthenticatedUser,
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.sms_staffWhereInput = {
      organizationId,
      deletedAt: null,
    };

    // Role-based own-record scoping: If user is SERVICE_STAFF and not management, only return their own record!
    const userRoles = (currentUser?.roles || []).map((r) => r.toUpperCase().replace(/[\s_-]+/g, '_'));
    const isServiceStaff = userRoles.includes('SERVICE_STAFF') || userRoles.includes('STAFF');
    const isManagement = userRoles.some((r) =>
      ['SUPER_ADMIN', 'SUPERADMIN', 'OWNER', 'BRANCH_MANAGER', 'ACCOUNTANT', 'FRONT_DESK'].includes(r),
    );

    if (isServiceStaff && !isManagement) {
      where.AND = [
        {
          OR: [
            { userId: currentUser?.id },
            ...(currentUser?.email
              ? [{ staffContacts: { personalEmail: { equals: currentUser.email, mode: 'insensitive' as Prisma.QueryMode } } }]
              : []),
          ],
        },
      ];
    } else {
      // Scoped branch restrictions (for branch managers or branch filters)
      if (query.branchId) {
        if (allowedBranchIds && !allowedBranchIds.includes(query.branchId)) {
          throw new ForbiddenException({
            code: 'FORBIDDEN_BRANCH',
            message: 'You are not authorized to view staff in this branch',
          });
        }
        where.OR = [
          { homeBranchId: query.branchId },
          {
            staffBranchAssignments: {
              some: {
                branchId: query.branchId,
                effectiveTo: null,
              },
            },
          },
        ];
      } else if (allowedBranchIds && allowedBranchIds.length > 0) {
        where.OR = [
          { homeBranchId: { in: allowedBranchIds } },
          {
            staffBranchAssignments: {
              some: {
                branchId: { in: allowedBranchIds },
                effectiveTo: null,
              },
            },
          },
        ];
      }
    }

    // Employment status filter
    if (query.employmentStatus) {
      where.employmentStatus = query.employmentStatus;
    }

    // Free text search
    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.AND = [
        {
          OR: [
            { fullName: { contains: term, mode: 'insensitive' } },
            { employeeCode: { contains: term, mode: 'insensitive' } },
            {
              staffContacts: {
                personalPhone: { contains: term, mode: 'insensitive' },
              },
            },
            {
              staffContacts: {
                personalEmail: { contains: term, mode: 'insensitive' },
              },
            },
          ],
        },
      ];
    }

    // Designation / Department filters
    if (query.designation || query.department) {
      where.staffEmploymentHistory = {
        some: {
          ...(query.designation && {
            designation: { contains: query.designation, mode: 'insensitive' },
          }),
          ...(query.department && {
            department: { contains: query.department, mode: 'insensitive' },
          }),
        },
      };
    }

    const [total, items] = await Promise.all([
      this.prisma.sms_staff.count({ where }),
      this.prisma.sms_staff.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [query.sortBy || 'createdAt']: query.sortOrder === 'asc' ? 'asc' : 'desc',
        },
        include: {
          homeBranch: {
            select: { id: true, name: true, code: true, status: true },
          },
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
              status: true,
            },
          },
          staffContacts: true,
          staffEmploymentHistory: {
            orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
            take: 1,
          },
          _count: {
            select: {
              staffEmergencyContacts: true,
              staffQualifications: true,
              staffDocuments: true,
            },
          },
        },
      }),
    ]);

    // Format output with current designation and masked contacts
    const formatted = items.map((staff) => {
      const currentEmployment = staff.staffEmploymentHistory[0] || null;
      const contacts = staff.staffContacts
        ? {
            ...staff.staffContacts,
            nationalIdNumber: staff.staffContacts.nationalIdNumberEncrypted
              ? maskNationalId(decryptSensitiveData(staff.staffContacts.nationalIdNumberEncrypted))
              : null,
            nationalIdNumberEncrypted: undefined, // Never expose ciphertext
          }
        : null;

      const hasEmergencyContact = staff._count.staffEmergencyContacts > 0;
      const emergencyContactWarning =
        staff.employmentStatus === 'active' && !hasEmergencyContact;

      return {
        id: staff.id,
        organizationId: staff.organizationId,
        employeeCode: staff.employeeCode,
        fullName: staff.fullName,
        dateOfBirth: staff.dateOfBirth,
        gender: staff.gender,
        profilePhotoUrl: staff.profilePhotoUrl,
        employmentStatus: staff.employmentStatus,
        homeBranch: staff.homeBranch,
        homeBranchId: staff.homeBranchId,
        user: staff.user,
        userId: staff.userId,
        currentDesignation: currentEmployment?.designation || 'Staff Member',
        currentDepartment: currentEmployment?.department || 'Operations',
        employmentType: currentEmployment?.employmentType || 'full_time',
        joiningDate: currentEmployment?.joiningDate || staff.createdAt,
        contacts,
        hasMissingEmergencyContact: emergencyContactWarning,
        documentCount: staff._count.staffDocuments,
        qualificationCount: staff._count.staffQualifications,
        createdAt: staff.createdAt,
        updatedAt: staff.updatedAt,
      };
    });

    return {
      items: formatted,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findMyProfile(organizationId: string, currentUser: AuthenticatedUser) {
    if (!currentUser) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_UNAUTHENTICATED',
        message: 'User authentication required',
      });
    }

    // Try finding staff record linked by userId or personalEmail
    let staff = await this.prisma.sms_staff.findFirst({
      where: {
        organizationId,
        deletedAt: null,
        OR: [
          { userId: currentUser.id },
          ...(currentUser.email
            ? [{ staffContacts: { personalEmail: { equals: currentUser.email, mode: 'insensitive' as Prisma.QueryMode } } }]
            : []),
        ],
      },
      select: { id: true, userId: true },
    });

    if (!staff) {
      // Find default branch in this organization to attach
      const defaultBranch = await this.prisma.sms_branches.findFirst({
        where: { organizationId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });

      if (!defaultBranch) {
        throw new NotFoundException({
          code: 'NO_BRANCH_AVAILABLE',
          message: 'No active branch available in this organization to assign employee profile',
        });
      }

      const code = await this.generateEmployeeCode(organizationId, 'EMP');
      staff = await this.prisma.$transaction(async (tx) => {
        const createdStaff = await tx.sms_staff.create({
          data: {
            organizationId,
            employeeCode: code,
            fullName: currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'Staff Member'),
            gender: 'prefer_not_to_say',
            employmentStatus: sms_staff_employmentStatus.active,
            userId: currentUser.id,
            homeBranchId: defaultBranch.id,
          },
          select: { id: true, userId: true },
        });

        await tx.sms_staffBranchAssignments.create({
          data: {
            staffId: createdStaff.id,
            branchId: defaultBranch.id,
            assignmentType: sms_staffBranchAssignments_assignmentType.home,
            effectiveFrom: new Date(),
          },
        });

        await tx.sms_staffEmploymentHistory.create({
          data: {
            staffId: createdStaff.id,
            designation: 'Service Specialist',
            department: 'Styling & Services',
            employmentType: 'full_time',
            joiningDate: new Date(),
            effectiveFrom: new Date(),
            changeReason: 'initial_hire',
          },
        });

        if (currentUser.email) {
          await tx.sms_staffContacts.create({
            data: {
              staffId: createdStaff.id,
              personalEmail: currentUser.email,
            },
          });
        }

        return createdStaff;
      });
    } else if (!staff.userId && currentUser.id) {
      // Auto-link the user ID
      await this.prisma.sms_staff.update({
        where: { id: staff.id },
        data: { userId: currentUser.id },
      });
    }

    return this.findOne(organizationId, staff.id, currentUser);
  }

  async updateMyProfile(
    organizationId: string,
    currentUser: AuthenticatedUser,
    dto: UpdateStaffDto & {
      personalPhone?: string;
      personalEmail?: string;
      addressLine1?: string;
      city?: string;
      postalCode?: string;
    },
  ) {
    if (!currentUser) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_UNAUTHENTICATED',
        message: 'User authentication required',
      });
    }

    const staff = await this.prisma.sms_staff.findFirst({
      where: {
        organizationId,
        deletedAt: null,
        OR: [
          { userId: currentUser.id },
          ...(currentUser.email
            ? [{ staffContacts: { personalEmail: { equals: currentUser.email, mode: 'insensitive' as Prisma.QueryMode } } }]
            : []),
        ],
      },
      select: { id: true },
    });

    if (!staff) {
      throw new NotFoundException({
        code: 'STAFF_NOT_FOUND',
        message: 'No employee record found for your user account',
      });
    }

    // Update master staff fields
    const safeData: Prisma.sms_staffUpdateInput = {};
    if (dto.fullName) safeData.fullName = dto.fullName.trim();
    if (dto.gender !== undefined) safeData.gender = dto.gender;
    if (dto.profilePhotoUrl !== undefined) safeData.profilePhotoUrl = dto.profilePhotoUrl;
    if (dto.dateOfBirth) safeData.dateOfBirth = new Date(dto.dateOfBirth);

    if (Object.keys(safeData).length > 0) {
      await this.prisma.sms_staff.update({
        where: { id: staff.id },
        data: safeData,
      });
    }

    // Also update user profile photo if user account is linked
    if (currentUser.id && dto.profilePhotoUrl !== undefined) {
      await this.prisma.sms_users.update({
        where: { id: currentUser.id },
        data: { profilePhotoUrl: dto.profilePhotoUrl },
      });
    }

    // Update contacts if provided
    if (
      dto.personalPhone !== undefined ||
      dto.personalEmail !== undefined ||
      dto.addressLine1 !== undefined ||
      dto.city !== undefined ||
      dto.postalCode !== undefined
    ) {
      await this.prisma.sms_staffContacts.upsert({
        where: { staffId: staff.id },
        create: {
          staffId: staff.id,
          personalPhone: dto.personalPhone || null,
          personalEmail: dto.personalEmail || null,
          addressLine1: dto.addressLine1 || null,
          city: dto.city || null,
          postalCode: dto.postalCode || null,
        },
        update: {
          ...(dto.personalPhone !== undefined && { personalPhone: dto.personalPhone }),
          ...(dto.personalEmail !== undefined && { personalEmail: dto.personalEmail }),
          ...(dto.addressLine1 !== undefined && { addressLine1: dto.addressLine1 }),
          ...(dto.city !== undefined && { city: dto.city }),
          ...(dto.postalCode !== undefined && { postalCode: dto.postalCode }),
        },
      });
    }

    return this.findOne(organizationId, staff.id, currentUser);
  }

  async findOne(organizationId: string, staffId: string, currentUser?: AuthenticatedUser) {
    const staff = await this.prisma.sms_staff.findFirst({
      where: { id: staffId, organizationId, deletedAt: null },
      include: {
        homeBranch: true,
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            status: true,
          },
        },
        staffContacts: true,
        staffEmergencyContacts: {
          orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
        },
        staffEmploymentHistory: {
          orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
          include: {
            recordedBy: {
              select: { id: true, displayName: true, email: true },
            },
          },
        },
        staffQualifications: {
          orderBy: [{ createdAt: 'desc' }],
        },
        staffDocuments: {
          where: { status: { not: 'expired' } },
          orderBy: [{ createdAt: 'desc' }],
          include: {
            uploadedBy: {
              select: { id: true, displayName: true, email: true },
            },
          },
        },
        staffBranchAssignments: {
          orderBy: [{ effectiveFrom: 'desc' }],
          include: {
            branch: {
              select: { id: true, name: true, code: true, status: true },
            },
          },
        },
      },
    });

    if (!staff) {
      throw new NotFoundException({
        code: 'STAFF_NOT_FOUND',
        message: 'Employee record not found in your organization',
      });
    }

    // Role-based own-record authorization: If caller is SERVICE_STAFF and not management, deny if it is not their profile
    if (currentUser) {
      const userRoles = (currentUser.roles || []).map((r) => r.toUpperCase().replace(/[\s_-]+/g, '_'));
      const isServiceStaff = userRoles.includes('SERVICE_STAFF') || userRoles.includes('STAFF');
      const isManagement = userRoles.some((r) =>
        ['SUPER_ADMIN', 'SUPERADMIN', 'OWNER', 'BRANCH_MANAGER', 'ACCOUNTANT', 'FRONT_DESK'].includes(r),
      );

      if (isServiceStaff && !isManagement) {
        const isOwnRecord =
          staff.userId === currentUser.id ||
          (currentUser.email &&
            staff.staffContacts?.personalEmail?.toLowerCase() === currentUser.email.toLowerCase());

        if (!isOwnRecord) {
          throw new ForbiddenException({
            code: 'FORBIDDEN_OWN_RECORD_ONLY',
            message: 'Service staff are only permitted to access their own employee profile',
          });
        }
      }
    }

    // Determine current effective employment details (where effectiveFrom <= now())
    const now = new Date();
    const effectiveHistory = staff.staffEmploymentHistory.find(
      (h) => new Date(h.effectiveFrom) <= now,
    ) || staff.staffEmploymentHistory[0] || null;

    // Mask contacts
    const contacts = staff.staffContacts
      ? {
          ...staff.staffContacts,
          nationalIdNumberMasked: staff.staffContacts.nationalIdNumberEncrypted
            ? maskNationalId(decryptSensitiveData(staff.staffContacts.nationalIdNumberEncrypted))
            : null,
          hasNationalId: !!staff.staffContacts.nationalIdNumberEncrypted,
          nationalIdNumberEncrypted: undefined,
        }
      : null;

    // Check expiring qualifications within 30 days
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);

    const qualificationsWithExpiry = staff.staffQualifications.map((q) => {
      let isExpired = false;
      let isExpiringSoon = false;
      let daysRemaining: number | null = null;

      if (q.expiryDate) {
        const exp = new Date(q.expiryDate);
        isExpired = exp < now;
        daysRemaining = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        isExpiringSoon = !isExpired && daysRemaining <= 30;
      }

      return {
        ...q,
        isExpired,
        isExpiringSoon,
        daysRemaining,
      };
    });

    const hasMissingEmergencyContact =
      staff.employmentStatus === 'active' && staff.staffEmergencyContacts.length === 0;

    return {
      id: staff.id,
      organizationId: staff.organizationId,
      employeeCode: staff.employeeCode,
      fullName: staff.fullName,
      dateOfBirth: staff.dateOfBirth,
      gender: staff.gender,
      profilePhotoUrl: staff.profilePhotoUrl,
      employmentStatus: staff.employmentStatus,
      homeBranch: staff.homeBranch,
      homeBranchId: staff.homeBranchId,
      user: staff.user,
      userId: staff.userId,
      currentEmployment: effectiveHistory,
      contacts,
      emergencyContacts: staff.staffEmergencyContacts,
      employmentHistory: staff.staffEmploymentHistory,
      qualifications: qualificationsWithExpiry,
      documents: staff.staffDocuments,
      branchAssignments: staff.staffBranchAssignments,
      hasMissingEmergencyContact,
      expiringQualificationsCount: qualificationsWithExpiry.filter(
        (q) => q.isExpiringSoon || q.isExpired,
      ).length,
      createdAt: staff.createdAt,
      updatedAt: staff.updatedAt,
    };
  }

  async update(
    organizationId: string,
    staffId: string,
    dto: UpdateStaffDto,
    performedById?: string,
  ) {
    const existing = await this.prisma.sms_staff.findFirst({
      where: { id: staffId, organizationId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'STAFF_NOT_FOUND',
        message: 'Employee record not found',
      });
    }

    if (dto.homeBranchId && dto.homeBranchId !== existing.homeBranchId) {
      const branch = await this.prisma.sms_branches.findFirst({
        where: { id: dto.homeBranchId, organizationId, deletedAt: null },
      });
      if (!branch || branch.status === 'permanently_closed') {
        throw new BadRequestException({
          code: 'INVALID_BRANCH',
          message: 'Selected branch is invalid or closed',
        });
      }
    }

    const updated = await this.prisma.sms_staff.update({
      where: { id: staffId },
      data: {
        ...(dto.fullName && { fullName: dto.fullName.trim() }),
        ...(dto.dateOfBirth !== undefined && {
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
        ...(dto.profilePhotoUrl !== undefined && {
          profilePhotoUrl: dto.profilePhotoUrl,
        }),
        ...(dto.employmentStatus && { employmentStatus: dto.employmentStatus }),
        ...(dto.homeBranchId && { homeBranchId: dto.homeBranchId }),
      },
    });

    await this.logAudit({
      organizationId,
      performedById,
      action: 'STAFF_UPDATED',
      oldValue: { fullName: existing.fullName, status: existing.employmentStatus },
      newValue: { fullName: updated.fullName, status: updated.employmentStatus },
    });

    return this.findOne(organizationId, staffId);
  }

  async updateStatus(
    organizationId: string,
    staffId: string,
    dto: UpdateStaffStatusDto,
    performedById?: string,
  ) {
    const existing = await this.prisma.sms_staff.findFirst({
      where: { id: staffId, organizationId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'STAFF_NOT_FOUND',
        message: 'Employee record not found',
      });
    }

    const updated = await this.prisma.sms_staff.update({
      where: { id: staffId },
      data: { employmentStatus: dto.status },
    });

    await this.logAudit({
      organizationId,
      performedById,
      action: 'STAFF_STATUS_CHANGED',
      oldValue: { status: existing.employmentStatus },
      newValue: { status: dto.status, reason: dto.reason },
    });

    return updated;
  }

  async linkUser(
    organizationId: string,
    staffId: string,
    targetUserId: string,
    performedById?: string,
  ) {
    const staff = await this.prisma.sms_staff.findFirst({
      where: { id: staffId, organizationId, deletedAt: null },
    });

    if (!staff) {
      throw new NotFoundException({
        code: 'STAFF_NOT_FOUND',
        message: 'Employee record not found',
      });
    }

    const user = await this.prisma.sms_users.findFirst({
      where: { id: targetUserId, organizationId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User account not found in your organization',
      });
    }

    // Check if user already linked to another staff
    const alreadyLinked = await this.prisma.sms_staff.findFirst({
      where: {
        userId: targetUserId,
        id: { not: staffId },
        deletedAt: null,
      },
    });

    if (alreadyLinked) {
      throw new ConflictException({
        code: 'USER_ALREADY_LINKED',
        message: `This user account is already linked to employee ${alreadyLinked.fullName} (${alreadyLinked.employeeCode})`,
      });
    }

    const updated = await this.prisma.sms_staff.update({
      where: { id: staffId },
      data: { userId: targetUserId },
      include: {
        user: { select: { id: true, email: true, displayName: true } },
      },
    });

    await this.logAudit({
      organizationId,
      performedById,
      action: 'STAFF_USER_LINKED',
      newValue: { staffId, userId: targetUserId, email: user.email },
    });

    return updated;
  }

  async unlinkUser(organizationId: string, staffId: string, performedById?: string) {
    const staff = await this.prisma.sms_staff.findFirst({
      where: { id: staffId, organizationId, deletedAt: null },
    });

    if (!staff) {
      throw new NotFoundException({
        code: 'STAFF_NOT_FOUND',
        message: 'Employee record not found',
      });
    }

    const previousUserId = staff.userId;

    const updated = await this.prisma.sms_staff.update({
      where: { id: staffId },
      data: { userId: null },
    });

    await this.logAudit({
      organizationId,
      performedById,
      action: 'STAFF_USER_UNLINKED',
      oldValue: { userId: previousUserId },
    });

    return updated;
  }

  async remove(organizationId: string, staffId: string, performedById?: string) {
    const staff = await this.prisma.sms_staff.findFirst({
      where: { id: staffId, organizationId, deletedAt: null },
      include: {
        _count: {
          select: {
            staffAttendance: true,
            staffLeaveRequests: true,
            staffServices: true,
          },
        },
      },
    });

    if (!staff) {
      throw new NotFoundException({
        code: 'STAFF_NOT_FOUND',
        message: 'Employee record not found',
      });
    }

    // Check for transactional references: attendance, leave, service sessions
    const hasTransactions =
      staff._count.staffAttendance > 0 ||
      staff._count.staffLeaveRequests > 0 ||
      staff._count.staffServices > 0;

    if (hasTransactions) {
      // Historical references exist: soft-delete / terminate
      await this.prisma.sms_staff.update({
        where: { id: staffId },
        data: {
          employmentStatus: sms_staff_employmentStatus.terminated,
          deletedAt: new Date(),
        },
      });

      await this.logAudit({
        organizationId,
        performedById,
        action: 'STAFF_SOFT_DELETED_TERMINATED',
        newValue: { staffId, reason: 'Historical operational records preserved' },
      });

      return {
        message: 'Employee marked as terminated and archived due to existing operational history',
        softDeleted: true,
      };
    }

    // No historical transactions: soft-delete cleanly
    await this.prisma.sms_staff.update({
      where: { id: staffId },
      data: {
        employmentStatus: sms_staff_employmentStatus.terminated,
        deletedAt: new Date(),
      },
    });

    await this.logAudit({
      organizationId,
      performedById,
      action: 'STAFF_DELETED',
      oldValue: { staffId, employeeCode: staff.employeeCode },
    });

    return { message: 'Employee successfully removed', softDeleted: true };
  }

  // =========================================================================
  // TASK 5.2: PERSONAL & CONTACT DETAILS
  // =========================================================================

  async getContacts(organizationId: string, staffId: string) {
    const staff = await this.prisma.sms_staff.findFirst({
      where: { id: staffId, organizationId, deletedAt: null },
      include: { staffContacts: true },
    });

    if (!staff) {
      throw new NotFoundException({
        code: 'STAFF_NOT_FOUND',
        message: 'Employee not found',
      });
    }

    if (!staff.staffContacts) {
      return null;
    }

    return {
      ...staff.staffContacts,
      nationalIdNumberMasked: staff.staffContacts.nationalIdNumberEncrypted
        ? maskNationalId(decryptSensitiveData(staff.staffContacts.nationalIdNumberEncrypted))
        : null,
      hasNationalId: !!staff.staffContacts.nationalIdNumberEncrypted,
      nationalIdNumberEncrypted: undefined,
    };
  }

  async upsertContacts(
    organizationId: string,
    staffId: string,
    dto: UpsertStaffContactsDto,
    performedById?: string,
  ) {
    const staff = await this.prisma.sms_staff.findFirst({
      where: { id: staffId, organizationId, deletedAt: null },
    });

    if (!staff) {
      throw new NotFoundException({
        code: 'STAFF_NOT_FOUND',
        message: 'Employee not found',
      });
    }

    const data: Prisma.sms_staffContactsCreateInput = {
      staff: { connect: { id: staffId } },
      personalPhone: dto.personalPhone || null,
      personalEmail: dto.personalEmail || null,
      addressLine1: dto.addressLine1 || null,
      addressLine2: dto.addressLine2 || null,
      city: dto.city || null,
      state: dto.state || null,
      postalCode: dto.postalCode || null,
      countryCode: dto.countryCode || null,
      bloodGroup: dto.bloodGroup || null,
      maritalStatus: dto.maritalStatus || null,
      nationalIdNumberEncrypted: dto.nationalIdNumber
        ? encryptSensitiveData(dto.nationalIdNumber)
        : undefined,
    };

    const updated = await this.prisma.sms_staffContacts.upsert({
      where: { staffId },
      create: data,
      update: {
        personalPhone: dto.personalPhone,
        personalEmail: dto.personalEmail,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        state: dto.state,
        postalCode: dto.postalCode,
        countryCode: dto.countryCode,
        bloodGroup: dto.bloodGroup,
        maritalStatus: dto.maritalStatus,
        ...(dto.nationalIdNumber && {
          nationalIdNumberEncrypted: encryptSensitiveData(dto.nationalIdNumber),
        }),
      },
    });

    await this.logAudit({
      organizationId,
      performedById,
      action: 'STAFF_CONTACTS_UPDATED',
      newValue: {
        staffId,
        personalEmail: dto.personalEmail,
        city: dto.city,
        hasNationalId: !!dto.nationalIdNumber,
      },
    });

    return this.getContacts(organizationId, staffId);
  }

  async revealNationalId(
    organizationId: string,
    staffId: string,
    performedById?: string,
    ipAddress?: string,
  ) {
    const staff = await this.prisma.sms_staff.findFirst({
      where: { id: staffId, organizationId, deletedAt: null },
      include: { staffContacts: true },
    });

    if (!staff || !staff.staffContacts || !staff.staffContacts.nationalIdNumberEncrypted) {
      throw new NotFoundException({
        code: 'NO_NATIONAL_ID',
        message: 'No encrypted national ID recorded for this employee',
      });
    }

    const decrypted = decryptSensitiveData(
      staff.staffContacts.nationalIdNumberEncrypted,
    );

    // Mandatory Audit Log for Sensitive National ID Reveal
    await this.logAudit({
      organizationId,
      performedById,
      action: 'STAFF_NATIONAL_ID_REVEALED',
      newValue: {
        staffId,
        staffName: staff.fullName,
        timestamp: new Date().toISOString(),
      },
      ipAddress,
    });

    return {
      nationalIdNumber: decrypted,
    };
  }

  // =========================================================================
  // TASK 5.3: EMERGENCY CONTACTS
  // =========================================================================

  async getEmergencyContacts(organizationId: string, staffId: string) {
    const staff = await this.prisma.sms_staff.findFirst({
      where: { id: staffId, organizationId, deletedAt: null },
    });

    if (!staff) {
      throw new NotFoundException({
        code: 'STAFF_NOT_FOUND',
        message: 'Employee not found',
      });
    }

    return this.prisma.sms_staffEmergencyContacts.findMany({
      where: { staffId },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createEmergencyContact(
    organizationId: string,
    staffId: string,
    dto: CreateEmergencyContactDto,
    performedById?: string,
  ) {
    const staff = await this.prisma.sms_staff.findFirst({
      where: { id: staffId, organizationId, deletedAt: null },
    });

    if (!staff) {
      throw new NotFoundException({
        code: 'STAFF_NOT_FOUND',
        message: 'Employee not found',
      });
    }

    const existingContacts = await this.prisma.sms_staffEmergencyContacts.findMany({
      where: { staffId },
    });

    // If this is the first contact or priority requested is primary:
    const isFirstContact = existingContacts.length === 0;
    const requestedPrimary = dto.priority === 'primary' || isFirstContact;
    const finalPriority = requestedPrimary
      ? ('primary' as sms_branchManagerAssignments_assignmentType)
      : ('secondary' as sms_branchManagerAssignments_assignmentType);

    const contact = await this.prisma.$transaction(async (tx) => {
      // If setting to primary, demote any existing primary contact
      if (requestedPrimary) {
        await tx.sms_staffEmergencyContacts.updateMany({
          where: { staffId, priority: 'primary' },
          data: { priority: 'secondary' as sms_branchManagerAssignments_assignmentType },
        });
      }

      return tx.sms_staffEmergencyContacts.create({
        data: {
          staffId,
          contactName: dto.contactName.trim(),
          relationship: dto.relationship?.trim() || null,
          phoneNumber: dto.phoneNumber.trim(),
          priority: finalPriority,
        },
      });
    });

    await this.logAudit({
      organizationId,
      performedById,
      action: 'EMERGENCY_CONTACT_CREATED',
      newValue: {
        staffId,
        contactName: contact.contactName,
        priority: contact.priority,
      },
    });

    return contact;
  }

  async updateEmergencyContact(
    organizationId: string,
    staffId: string,
    contactId: string,
    dto: UpdateEmergencyContactDto,
    performedById?: string,
  ) {
    const contact = await this.prisma.sms_staffEmergencyContacts.findFirst({
      where: { id: contactId, staffId },
    });

    if (!contact) {
      throw new NotFoundException({
        code: 'CONTACT_NOT_FOUND',
        message: 'Emergency contact not found',
      });
    }

    const settingPrimary = dto.priority === 'primary';

    const updated = await this.prisma.$transaction(async (tx) => {
      if (settingPrimary) {
        await tx.sms_staffEmergencyContacts.updateMany({
          where: { staffId, priority: 'primary', id: { not: contactId } },
          data: { priority: 'secondary' as sms_branchManagerAssignments_assignmentType },
        });
      }

      return tx.sms_staffEmergencyContacts.update({
        where: { id: contactId },
        data: {
          ...(dto.contactName && { contactName: dto.contactName.trim() }),
          ...(dto.relationship !== undefined && {
            relationship: dto.relationship?.trim() || null,
          }),
          ...(dto.phoneNumber && { phoneNumber: dto.phoneNumber.trim() }),
          ...(dto.priority && {
            priority: dto.priority as sms_branchManagerAssignments_assignmentType,
          }),
        },
      });
    });

    await this.logAudit({
      organizationId,
      performedById,
      action: 'EMERGENCY_CONTACT_UPDATED',
      newValue: { contactId, priority: updated.priority },
    });

    return updated;
  }

  async deleteEmergencyContact(
    organizationId: string,
    staffId: string,
    contactId: string,
    performedById?: string,
  ) {
    const contact = await this.prisma.sms_staffEmergencyContacts.findFirst({
      where: { id: contactId, staffId },
    });

    if (!contact) {
      throw new NotFoundException({
        code: 'CONTACT_NOT_FOUND',
        message: 'Emergency contact not found',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.sms_staffEmergencyContacts.delete({ where: { id: contactId } });

      // If the deleted contact was primary, promote earliest secondary contact
      if (contact.priority === 'primary') {
        const nextContact = await tx.sms_staffEmergencyContacts.findFirst({
          where: { staffId },
          orderBy: { createdAt: 'asc' },
        });
        if (nextContact) {
          await tx.sms_staffEmergencyContacts.update({
            where: { id: nextContact.id },
            data: { priority: 'primary' },
          });
        }
      }
    });

    await this.logAudit({
      organizationId,
      performedById,
      action: 'EMERGENCY_CONTACT_DELETED',
      oldValue: { contactId, name: contact.contactName },
    });

    return { message: 'Emergency contact removed successfully' };
  }

  // =========================================================================
  // TASK 5.4: EMPLOYMENT & DEPARTMENT HISTORY
  // =========================================================================

  async getEmploymentHistory(organizationId: string, staffId: string) {
    const staff = await this.prisma.sms_staff.findFirst({
      where: { id: staffId, organizationId, deletedAt: null },
    });

    if (!staff) {
      throw new NotFoundException({
        code: 'STAFF_NOT_FOUND',
        message: 'Employee not found',
      });
    }

    const history = await this.prisma.sms_staffEmploymentHistory.findMany({
      where: { staffId },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
      include: {
        recordedBy: {
          select: { id: true, displayName: true, email: true },
        },
      },
    });

    const now = new Date();
    const current = history.find((h) => new Date(h.effectiveFrom) <= now) || history[0] || null;

    return {
      current,
      history,
    };
  }

  async createEmploymentHistory(
    organizationId: string,
    staffId: string,
    dto: CreateEmploymentHistoryDto,
    performedById?: string,
  ) {
    const staff = await this.prisma.sms_staff.findFirst({
      where: { id: staffId, organizationId, deletedAt: null },
    });

    if (!staff) {
      throw new NotFoundException({
        code: 'STAFF_NOT_FOUND',
        message: 'Employee not found',
      });
    }

    // Historical records are versioned and immutable; insert new record
    const record = await this.prisma.sms_staffEmploymentHistory.create({
      data: {
        staffId,
        designation: dto.designation.trim(),
        department: dto.department.trim(),
        employmentType: dto.employmentType,
        joiningDate: new Date(dto.joiningDate),
        effectiveFrom: new Date(dto.effectiveFrom),
        confirmationDate: dto.confirmationDate ? new Date(dto.confirmationDate) : null,
        changeReason: dto.changeReason || 'promotion',
        recordedById: performedById || null,
      },
      include: {
        recordedBy: { select: { id: true, displayName: true, email: true } },
      },
    });

    await this.logAudit({
      organizationId,
      performedById,
      action: 'EMPLOYMENT_HISTORY_RECORDED',
      newValue: {
        staffId,
        designation: record.designation,
        department: record.department,
        changeReason: record.changeReason,
        effectiveFrom: record.effectiveFrom,
      },
    });

    return record;
  }

  // =========================================================================
  // TASK 5.5: SKILLS & QUALIFICATIONS
  // =========================================================================

  async getQualifications(organizationId: string, staffId: string) {
    const staff = await this.prisma.sms_staff.findFirst({
      where: { id: staffId, organizationId, deletedAt: null },
    });

    if (!staff) {
      throw new NotFoundException({
        code: 'STAFF_NOT_FOUND',
        message: 'Employee not found',
      });
    }

    const items = await this.prisma.sms_staffQualifications.findMany({
      where: { staffId },
      orderBy: [{ createdAt: 'desc' }],
    });

    const now = new Date();

    const skills = items.filter(
      (item) => item.recordType === sms_staffQualifications_recordType.skill_tag,
    );

    const qualifications = items
      .filter((item) => item.recordType === sms_staffQualifications_recordType.formal_qualification)
      .map((q) => {
        let isExpired = false;
        let isExpiringSoon = false;
        let daysRemaining: number | null = null;

        if (q.expiryDate) {
          const exp = new Date(q.expiryDate);
          isExpired = exp < now;
          daysRemaining = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          isExpiringSoon = !isExpired && daysRemaining <= 30;
        }

        return {
          ...q,
          isExpired,
          isExpiringSoon,
          daysRemaining,
        };
      });

    return {
      skills,
      qualifications,
    };
  }

  async createQualification(
    organizationId: string,
    staffId: string,
    dto: CreateQualificationDto,
    performedById?: string,
  ) {
    const staff = await this.prisma.sms_staff.findFirst({
      where: { id: staffId, organizationId, deletedAt: null },
    });

    if (!staff) {
      throw new NotFoundException({
        code: 'STAFF_NOT_FOUND',
        message: 'Employee not found',
      });
    }

    // Deduplicate skill tags
    if (dto.recordType === sms_staffQualifications_recordType.skill_tag) {
      const existing = await this.prisma.sms_staffQualifications.findFirst({
        where: {
          staffId,
          recordType: sms_staffQualifications_recordType.skill_tag,
          title: { equals: dto.title.trim(), mode: 'insensitive' },
        },
      });

      if (existing) {
        return existing; // Already added, return cleanly
      }
    }

    const created = await this.prisma.sms_staffQualifications.create({
      data: {
        staffId,
        recordType: dto.recordType,
        title: dto.title.trim(),
        issuingInstitution: dto.issuingInstitution?.trim() || null,
        certificateNumber: dto.certificateNumber?.trim() || null,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
        documentUrl: dto.documentUrl || null,
      },
    });

    await this.logAudit({
      organizationId,
      performedById,
      action: 'QUALIFICATION_ADDED',
      newValue: {
        staffId,
        recordType: created.recordType,
        title: created.title,
      },
    });

    return created;
  }

  async updateQualification(
    organizationId: string,
    staffId: string,
    qualificationId: string,
    dto: UpdateQualificationDto,
    performedById?: string,
  ) {
    const existing = await this.prisma.sms_staffQualifications.findFirst({
      where: { id: qualificationId, staffId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'QUALIFICATION_NOT_FOUND',
        message: 'Qualification or skill record not found',
      });
    }

    const updated = await this.prisma.sms_staffQualifications.update({
      where: { id: qualificationId },
      data: {
        ...(dto.title && { title: dto.title.trim() }),
        ...(dto.issuingInstitution !== undefined && {
          issuingInstitution: dto.issuingInstitution?.trim() || null,
        }),
        ...(dto.certificateNumber !== undefined && {
          certificateNumber: dto.certificateNumber?.trim() || null,
        }),
        ...(dto.issueDate !== undefined && {
          issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
        }),
        ...(dto.expiryDate !== undefined && {
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
        }),
        ...(dto.documentUrl !== undefined && {
          documentUrl: dto.documentUrl || null,
        }),
      },
    });

    await this.logAudit({
      organizationId,
      performedById,
      action: 'QUALIFICATION_UPDATED',
      newValue: { qualificationId, title: updated.title },
    });

    return updated;
  }

  async deleteQualification(
    organizationId: string,
    staffId: string,
    qualificationId: string,
    performedById?: string,
  ) {
    const existing = await this.prisma.sms_staffQualifications.findFirst({
      where: { id: qualificationId, staffId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'QUALIFICATION_NOT_FOUND',
        message: 'Qualification record not found',
      });
    }

    await this.prisma.sms_staffQualifications.delete({
      where: { id: qualificationId },
    });

    await this.logAudit({
      organizationId,
      performedById,
      action: 'QUALIFICATION_DELETED',
      oldValue: { qualificationId, title: existing.title },
    });

    return { message: 'Qualification or skill removed successfully' };
  }

  // =========================================================================
  // TASK 5.6: DOCUMENT MANAGEMENT
  // =========================================================================

  async getDocuments(
    organizationId: string,
    staffId: string,
    category?: string,
    status?: string,
  ) {
    const staff = await this.prisma.sms_staff.findFirst({
      where: { id: staffId, organizationId, deletedAt: null },
    });

    if (!staff) {
      throw new NotFoundException({
        code: 'STAFF_NOT_FOUND',
        message: 'Employee not found',
      });
    }

    const where: Prisma.sms_staffDocumentsWhereInput = { staffId };

    if (category) {
      where.category = category as any;
    }

    if (status) {
      where.status = status as any;
    }

    return this.prisma.sms_staffDocuments.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        uploadedBy: {
          select: { id: true, displayName: true, email: true },
        },
        supersedes: {
          select: { id: true, fileName: true, createdAt: true, status: true },
        },
        supersededBy: {
          select: { id: true, fileName: true, createdAt: true, status: true },
        },
      },
    });
  }

  async createDocument(
    organizationId: string,
    staffId: string,
    dto: CreateDocumentDto,
    uploadedById: string,
  ) {
    const staff = await this.prisma.sms_staff.findFirst({
      where: { id: staffId, organizationId, deletedAt: null },
    });

    if (!staff) {
      throw new NotFoundException({
        code: 'STAFF_NOT_FOUND',
        message: 'Employee not found',
      });
    }

    const doc = await this.prisma.$transaction(async (tx) => {
      // If this document supersedes an existing one, update previous document status
      if (dto.supersedesDocumentId) {
        const previousDoc = await tx.sms_staffDocuments.findFirst({
          where: { id: dto.supersedesDocumentId, staffId },
        });

        if (previousDoc) {
          await tx.sms_staffDocuments.update({
            where: { id: dto.supersedesDocumentId },
            data: { status: sms_staffDocuments_status.superseded },
          });
        }
      }

      return tx.sms_staffDocuments.create({
        data: {
          staffId,
          category: dto.category,
          fileName: dto.fileName.trim(),
          fileUrl: dto.fileUrl.trim(),
          fileSizeBytes: dto.fileSizeBytes || null,
          status: dto.status || sms_staffDocuments_status.active,
          supersedesDocumentId: dto.supersedesDocumentId || null,
          uploadedById,
        },
        include: {
          uploadedBy: {
            select: { id: true, displayName: true, email: true },
          },
        },
      });
    });

    await this.logAudit({
      organizationId,
      performedById: uploadedById,
      action: 'DOCUMENT_UPLOADED',
      newValue: {
        staffId,
        documentId: doc.id,
        fileName: doc.fileName,
        category: doc.category,
        supersedesDocumentId: doc.supersedesDocumentId,
      },
    });

    return doc;
  }

  async getDocument(organizationId: string, staffId: string, documentId: string) {
    const doc = await this.prisma.sms_staffDocuments.findFirst({
      where: { id: documentId, staffId },
      include: {
        uploadedBy: {
          select: { id: true, displayName: true, email: true },
        },
        supersedes: true,
        supersededBy: true,
      },
    });

    if (!doc) {
      throw new NotFoundException({
        code: 'DOCUMENT_NOT_FOUND',
        message: 'Document not found',
      });
    }

    return doc;
  }

  async deleteDocument(
    organizationId: string,
    staffId: string,
    documentId: string,
    performedById?: string,
  ) {
    const doc = await this.prisma.sms_staffDocuments.findFirst({
      where: { id: documentId, staffId },
    });

    if (!doc) {
      throw new NotFoundException({
        code: 'DOCUMENT_NOT_FOUND',
        message: 'Document not found',
      });
    }

    // Set status to expired / archived
    const updated = await this.prisma.sms_staffDocuments.update({
      where: { id: documentId },
      data: { status: sms_staffDocuments_status.expired },
    });

    await this.logAudit({
      organizationId,
      performedById,
      action: 'DOCUMENT_ARCHIVED',
      oldValue: { documentId, fileName: doc.fileName },
    });

    return { message: 'Document archived successfully' };
  }

  // =========================================================================
  // TASK 5.7: BRANCH ASSIGNMENT
  // =========================================================================

  async getBranchAssignments(organizationId: string, staffId: string) {
    const staff = await this.prisma.sms_staff.findFirst({
      where: { id: staffId, organizationId, deletedAt: null },
      include: {
        homeBranch: true,
        staffBranchAssignments: {
          orderBy: [{ effectiveFrom: 'desc' }],
          include: {
            branch: {
              select: {
                id: true,
                name: true,
                code: true,
                status: true,
                branchType: true,
              },
            },
            createdBy: {
              select: { id: true, displayName: true, email: true },
            },
          },
        },
      },
    });

    if (!staff) {
      throw new NotFoundException({
        code: 'STAFF_NOT_FOUND',
        message: 'Employee not found',
      });
    }

    const assignments = staff.staffBranchAssignments;
    const now = new Date();

    const homeAssignments = assignments.filter((a) => a.assignmentType === 'home');
    const secondaryAssignments = assignments.filter(
      (a) => a.assignmentType === 'secondary',
    );
    const futureTransfers = homeAssignments.filter(
      (a) => new Date(a.effectiveFrom) > now,
    );

    return {
      homeBranch: staff.homeBranch,
      homeAssignments,
      secondaryAssignments,
      futureTransfers,
      allAssignments: assignments,
    };
  }

  async addSecondaryBranch(
    organizationId: string,
    staffId: string,
    dto: CreateBranchAssignmentDto,
    createdById?: string,
  ) {
    const staff = await this.prisma.sms_staff.findFirst({
      where: { id: staffId, organizationId, deletedAt: null },
    });

    if (!staff) {
      throw new NotFoundException({
        code: 'STAFF_NOT_FOUND',
        message: 'Employee not found',
      });
    }

    const branch = await this.prisma.sms_branches.findFirst({
      where: { id: dto.branchId, organizationId, deletedAt: null },
    });

    if (!branch) {
      throw new NotFoundException({
        code: 'BRANCH_NOT_FOUND',
        message: 'Branch not found in your organization',
      });
    }

    if (branch.status === 'permanently_closed') {
      throw new BadRequestException({
        code: 'BRANCH_CLOSED',
        message: 'Cannot assign employee to a permanently closed branch',
      });
    }

    // Check duplicate active assignment for this branch
    const existing = await this.prisma.sms_staffBranchAssignments.findFirst({
      where: {
        staffId,
        branchId: dto.branchId,
        effectiveTo: null,
      },
    });

    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_BRANCH_ASSIGNMENT',
        message: `Employee is already actively assigned to ${branch.name}`,
      });
    }

    const assignment = await this.prisma.sms_staffBranchAssignments.create({
      data: {
        staffId,
        branchId: dto.branchId,
        assignmentType: sms_staffBranchAssignments_assignmentType.secondary,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        createdById: createdById || null,
      },
      include: {
        branch: { select: { id: true, name: true, code: true, status: true } },
      },
    });

    await this.logAudit({
      organizationId,
      performedById: createdById,
      action: 'STAFF_BRANCH_ASSIGNED',
      newValue: {
        staffId,
        branchId: dto.branchId,
        branchName: branch.name,
        type: 'secondary',
      },
    });

    return assignment;
  }

  async endSecondaryBranch(
    organizationId: string,
    staffId: string,
    assignmentId: string,
    performedById?: string,
  ) {
    const assignment = await this.prisma.sms_staffBranchAssignments.findFirst({
      where: { id: assignmentId, staffId },
      include: { branch: true },
    });

    if (!assignment) {
      throw new NotFoundException({
        code: 'ASSIGNMENT_NOT_FOUND',
        message: 'Branch assignment record not found',
      });
    }

    if (assignment.assignmentType === 'home') {
      throw new BadRequestException({
        code: 'CANNOT_END_HOME_BRANCH',
        message: 'Cannot directly end a Home Branch assignment; use Transfer Home Branch instead',
      });
    }

    const updated = await this.prisma.sms_staffBranchAssignments.update({
      where: { id: assignmentId },
      data: { effectiveTo: new Date() },
    });

    await this.logAudit({
      organizationId,
      performedById,
      action: 'STAFF_BRANCH_ASSIGNMENT_ENDED',
      newValue: { assignmentId, branchId: assignment.branchId },
    });

    return updated;
  }

  async transferHomeBranch(
    organizationId: string,
    staffId: string,
    dto: TransferHomeBranchDto,
    performedById?: string,
  ) {
    const staff = await this.prisma.sms_staff.findFirst({
      where: { id: staffId, organizationId, deletedAt: null },
      include: { homeBranch: true },
    });

    if (!staff) {
      throw new NotFoundException({
        code: 'STAFF_NOT_FOUND',
        message: 'Employee not found',
      });
    }

    const newBranch = await this.prisma.sms_branches.findFirst({
      where: { id: dto.newBranchId, organizationId, deletedAt: null },
    });

    if (!newBranch) {
      throw new NotFoundException({
        code: 'BRANCH_NOT_FOUND',
        message: 'Target branch not found in your organization',
      });
    }

    if (newBranch.status === 'permanently_closed') {
      throw new BadRequestException({
        code: 'BRANCH_CLOSED',
        message: 'Cannot transfer employee to a permanently closed branch',
      });
    }

    if (staff.homeBranchId === dto.newBranchId) {
      throw new BadRequestException({
        code: 'SAME_HOME_BRANCH',
        message: 'Target branch is already the employee\'s current Home Branch',
      });
    }

    const effectiveDate = dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date();
    const isImmediate = effectiveDate <= new Date();

    await this.prisma.$transaction(async (tx) => {
      // 1. Close current active home assignment
      await tx.sms_staffBranchAssignments.updateMany({
        where: {
          staffId,
          assignmentType: 'home',
          effectiveTo: null,
        },
        data: {
          effectiveTo: effectiveDate,
        },
      });

      // 2. Create new home assignment
      await tx.sms_staffBranchAssignments.create({
        data: {
          staffId,
          branchId: dto.newBranchId,
          assignmentType: sms_staffBranchAssignments_assignmentType.home,
          effectiveFrom: effectiveDate,
          createdById: performedById || null,
        },
      });

      // 3. If immediate, update master staff table
      if (isImmediate) {
        await tx.sms_staff.update({
          where: { id: staffId },
          data: { homeBranchId: dto.newBranchId },
        });
      }
    });

    await this.logAudit({
      organizationId,
      performedById,
      action: 'STAFF_HOME_BRANCH_TRANSFERRED',
      oldValue: { homeBranchId: staff.homeBranchId, branchName: staff.homeBranch.name },
      newValue: {
        newBranchId: dto.newBranchId,
        newBranchName: newBranch.name,
        effectiveDate,
        reason: dto.reason,
      },
    });

    return this.findOne(organizationId, staffId);
  }
}


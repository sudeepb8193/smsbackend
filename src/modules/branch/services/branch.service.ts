import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateBranchDto } from '../dto/create-branch.dto';
import { UpdateBranchDto } from '../dto/update-branch.dto';
import { QueryBranchDto } from '../dto/query-branch.dto';
import { CopyBranchSettingsDto } from '../dto/copy-branch-settings.dto';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { sms_branches_status, Prisma } from '@prisma/client';

@Injectable()
export class BranchService {
  private readonly logger = new Logger(BranchService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to normalize a branch code consistently
   */
  normalizeCode(code: string): string {
    return (code || '').trim().toUpperCase();
  }

  /**
   * Suggest the next available branch code if a conflict occurs
   */
  async generateSuggestedCode(
    organizationId: string,
    baseCode: string,
  ): Promise<string> {
    const normalized = this.normalizeCode(baseCode);

    // Match patterns like "BLR-01", "BLR-1", "NYC"
    const match = normalized.match(/^(.*?)[-_]?(\d+)$/);
    let prefix = normalized;
    let currentNum = 1;
    let padLength = 2;

    if (match) {
      prefix = match[1] || normalized;
      currentNum = parseInt(match[2], 10);
      padLength = match[2].length;
    }

    // Clean trailing hyphens or underscores from prefix
    prefix = prefix.replace(/[-_]+$/, '');

    // Find all branches in the org that start with this prefix
    const existing = await this.prisma.sms_branches.findMany({
      where: {
        organizationId,
        code: {
          startsWith: prefix,
          mode: 'insensitive',
        },
      },
      select: { code: true },
    });

    const existingCodes = new Set(existing.map((b) => b.code.toUpperCase()));

    let candidateNum = currentNum + 1;
    while (candidateNum < currentNum + 100) {
      const padded = String(candidateNum).padStart(padLength, '0');
      const candidateCode = `${prefix}-${padded}`;
      if (!existingCodes.has(candidateCode)) {
        return candidateCode;
      }
      candidateNum++;
    }

    return `${prefix}-${Date.now().toString().slice(-4)}`;
  }

  /**
   * Check branch code availability and propose suggestion if taken
   */
  async checkCodeAvailability(
    organizationId: string,
    rawCode: string,
  ): Promise<{
    available: boolean;
    code: string;
    suggestedCode: string | null;
  }> {
    const code = this.normalizeCode(rawCode);
    if (!code || code.length < 2) {
      return { available: false, code, suggestedCode: null };
    }

    // Check organization-level uniqueness
    const existingInOrg = await this.prisma.sms_branches.findFirst({
      where: {
        organizationId,
        code: { equals: code, mode: 'insensitive' },
        deletedAt: null,
      },
    });

    // Check global constraint uniqueness
    const existingGlobal = await this.prisma.sms_branches.findFirst({
      where: {
        code: { equals: code, mode: 'insensitive' },
        deletedAt: null,
      },
    });

    if (existingInOrg || existingGlobal) {
      const suggestedCode = await this.generateSuggestedCode(
        organizationId,
        code,
      );
      return {
        available: false,
        code,
        suggestedCode,
      };
    }

    return {
      available: true,
      code,
      suggestedCode: null,
    };
  }

  /**
   * Resolve user's permitted branch IDs if they have branch-scoped access
   */
  private async getPermittedBranchIds(
    user: AuthenticatedUser,
  ): Promise<string[] | null> {
    const roles = (user.roles || []).map((r) => r.toLowerCase().replace(/_/g, '-'));
    const isOwnerOrAdmin = roles.some(
      (r) => r === 'owner' || r === 'super-admin',
    );

    if (isOwnerOrAdmin) {
      return null; // Null indicates full organization access
    }

    // Find branches assigned to this user via sms_userBranchAssignments
    const userAssignments = await this.prisma.sms_userBranchAssignments.findMany({
      where: {
        userId: user.id,
      },
      select: { branchId: true },
    });

    // Also check staff assignments if linked
    const staff = await this.prisma.sms_staff.findFirst({
      where: {
        userId: user.id,
        organizationId: user.organizationId,
        deletedAt: null,
      },
      include: {
        staffBranchAssignments: { select: { branchId: true } },
      },
    });

    const branchIds = new Set<string>();
    userAssignments.forEach((a) => branchIds.add(a.branchId));
    if (staff?.homeBranchId) {
      branchIds.add(staff.homeBranchId);
    }
    staff?.staffBranchAssignments?.forEach((sba) => branchIds.add(sba.branchId));

    return Array.from(branchIds);
  }

  /**
   * 1. Create a Branch (Draft or Active)
   */
  async create(
    dto: CreateBranchDto,
    user: AuthenticatedUser,
    clientIp?: string,
  ) {
    const roles = (user.roles || []).map((r) => r.toLowerCase().replace(/_/g, '-'));
    const isSuperAdmin = roles.includes('super-admin');
    const targetOrgId =
      (isSuperAdmin && dto.organizationId) || dto.organizationId || user.organizationId;

    if (!targetOrgId) {
      throw new BadRequestException({
        code: 'MISSING_ORGANIZATION',
        message: 'Active organization context is required to create a branch',
      });
    }

    // Verify organization exists and is active
    const org = await this.prisma.sms_organizations.findUnique({
      where: { id: targetOrgId },
      select: { id: true, name: true, status: true },
    });

    if (!org || org.status === 'inactive') {
      throw new NotFoundException({
        code: 'ORGANIZATION_NOT_FOUND',
        message: 'Organization does not exist or is inactive',
      });
    }

    const code = this.normalizeCode(dto.code);

    // Verify code availability
    const codeCheck = await this.checkCodeAvailability(targetOrgId, code);
    if (!codeCheck.available) {
      throw new BadRequestException({
        code: 'DUPLICATE_BRANCH_CODE',
        message: `Branch code "${code}" is already in use within this organization`,
        suggestedCode: codeCheck.suggestedCode,
      });
    }

    // If copying settings from an existing branch, verify source
    if (dto.copySettingsFromBranchId) {
      const source = await this.prisma.sms_branches.findFirst({
        where: {
          id: dto.copySettingsFromBranchId,
          organizationId: targetOrgId,
          deletedAt: null,
        },
      });
      if (!source) {
        throw new NotFoundException({
          code: 'SOURCE_BRANCH_NOT_FOUND',
          message: 'The source branch to copy settings from does not exist',
        });
      }
    }

    // Execute branch creation transaction
    const newBranch = await this.prisma.$transaction(async (tx) => {
      const branch = await tx.sms_branches.create({
        data: {
          organizationId: targetOrgId,
          name: dto.name.trim(),
          code,
          branchType: dto.branchType || 'standard',
          coverImageUrl: dto.coverImageUrl || null,
          status: dto.status || 'draft',
          launchedAt: dto.launchedAt ? new Date(dto.launchedAt) : null,
          createdById: user.id,
        },
        include: {
          organization: {
            select: { id: true, name: true, slug: true },
          },
        },
      });

      // If requested, copy settings from source branch
      if (dto.copySettingsFromBranchId) {
        const sourceSettings = await tx.sms_branchSettings.findUnique({
          where: { branchId: dto.copySettingsFromBranchId },
        });

        if (sourceSettings) {
          await tx.sms_branchSettings.create({
            data: {
              branchId: branch.id,
              onlineBookingEnabled: sourceSettings.onlineBookingEnabled,
              maxConcurrentAppointments: sourceSettings.maxConcurrentAppointments,
              minBookingLeadMinutes: sourceSettings.minBookingLeadMinutes,
              maxBookingAdvanceDays: sourceSettings.maxBookingAdvanceDays,
              walkinQueueEnabled: sourceSettings.walkinQueueEnabled,
              giftCardsEnabled: sourceSettings.giftCardsEnabled,
              membershipSalesEnabled: sourceSettings.membershipSalesEnabled,
              onlinePaymentsEnabled: sourceSettings.onlinePaymentsEnabled,
              cancellationPolicyText: sourceSettings.cancellationPolicyText,
              noShowFeeAmount: sourceSettings.noShowFeeAmount,
              taxRateOverridePercentage: sourceSettings.taxRateOverridePercentage,
            },
          });
        }

        // Copy source custom business hours if any exist
        const sourceHours = await tx.sms_businessHours.findMany({
          where: { branchId: dto.copySettingsFromBranchId },
        });

        if (sourceHours.length > 0) {
          for (const sh of sourceHours) {
            await tx.sms_businessHours.create({
              data: {
                organizationId: targetOrgId,
                branchId: branch.id,
                dayOfWeek: sh.dayOfWeek,
                isOpen: sh.isOpen,
                openTime: sh.openTime,
                closeTime: sh.closeTime,
                breakStartTime: sh.breakStartTime,
                breakEndTime: sh.breakEndTime,
                spansMidnight: sh.spansMidnight,
              },
            });
          }
        }
      }

      // Create branch address if provided
      if (dto.address && dto.address.addressLine1) {
        await tx.sms_branchAddresses.create({
          data: {
            branchId: branch.id,
            addressLine1: dto.address.addressLine1.trim(),
            addressLine2: dto.address.addressLine2?.trim() || null,
            landmark: dto.address.landmark?.trim() || null,
            city: dto.address.city?.trim() || '',
            state: dto.address.state?.trim() || '',
            postalCode: dto.address.postalCode?.trim() || '',
            countryCode: (dto.address.countryCode?.trim() || 'IN').slice(0, 2).toUpperCase(),
            latitude: dto.address.latitude != null ? dto.address.latitude : null,
            longitude: dto.address.longitude != null ? dto.address.longitude : null,
            mapsUrl: dto.address.mapsUrl?.trim() || null,
          },
        });
      }

      // Create branch contact if provided
      if (dto.contact) {
        await tx.sms_branchContacts.create({
          data: {
            branchId: branch.id,
            phoneCountryCode: dto.contact.phoneCountryCode || '+91',
            phoneNumber: dto.contact.phoneNumber?.trim() || null,
            email: dto.contact.email?.trim() || null,
            whatsappNumber: dto.contact.whatsappNumber?.trim() || null,
          },
        });
      }

      // Create custom business hours if provided (and not already copied from another branch)
      if (dto.businessHours && dto.businessHours.length > 0 && !dto.copySettingsFromBranchId) {
        for (const h of dto.businessHours) {
          await tx.sms_businessHours.create({
            data: {
              organizationId: targetOrgId,
              branchId: branch.id,
              dayOfWeek: h.dayOfWeek,
              isOpen: h.isOpen !== false,
              openTime: h.openTime || '09:00',
              closeTime: h.closeTime || '19:00',
            },
          });
        }
      }

      return branch;
    });

    this.logger.log(
      `Branch "${newBranch.name}" (${newBranch.code}) created under org ${targetOrgId} by user ${user.id}`,
    );

    return newBranch;
  }

  /**
   * 2. Find All Branches (Searchable, filterable, paginated)
   */
  async findAll(query: QueryBranchDto, user: AuthenticatedUser) {
    const targetOrgId = user.organizationId;
    if (!targetOrgId) {
      throw new BadRequestException('Organization context missing');
    }

    const permittedBranchIds = await this.getPermittedBranchIds(user);

    const where: Prisma.sms_branchesWhereInput = {
      organizationId: targetOrgId,
      ...(query.includeDeleted ? {} : { deletedAt: null }),
    };

    // Branch manager scope enforcement
    if (permittedBranchIds !== null) {
      if (permittedBranchIds.length === 0) {
        return {
          data: [],
          meta: {
            total: 0,
            page: query.page || 1,
            limit: query.limit || 10,
            totalPages: 0,
          },
        };
      }
      where.id = { in: permittedBranchIds };
    }

    // Search query across name and code
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Status filter
    if (query.status && query.status !== 'all') {
      where.status = query.status;
    }

    // Branch type filter
    if (query.branchType && query.branchType !== 'all') {
      where.branchType = query.branchType;
    }

    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = (query.sortOrder || 'desc').toLowerCase() as 'asc' | 'desc';

    const [total, branches] = await Promise.all([
      this.prisma.sms_branches.count({ where }),
      this.prisma.sms_branches.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          organizationId: true,
          name: true,
          code: true,
          branchType: true,
          status: true,
          coverImageUrl: true,
          launchedAt: true,
          createdAt: true,
          branchAddress: {
            select: {
              city: true,
              state: true,
            },
          },
          _count: {
            select: {
              staff: true,
            },
          },
        },
      }),
    ]);

    return {
      data: branches,
      items: branches,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      total,
    };
  }

  /**
   * 3. Find One Branch by ID
   */
  async findOne(id: string, user: AuthenticatedUser) {
    const roles = (user.roles || []).map((r) => r.toLowerCase().replace(/_/g, '-'));
    const isSuperAdmin = roles.includes('super-admin');

    const branch = await this.prisma.sms_branches.findFirst({
      where: {
        id,
        ...(isSuperAdmin ? {} : { organizationId: user.organizationId }),
      },
      include: {
        organization: {
          select: { id: true, name: true, slug: true },
        },
        branchAddress: true,
        branchContact: true,
        branchSettings: true,
        businessHours: {
          orderBy: { dayOfWeek: 'asc' },
        },
        branchManagerAssignments: {
          where: {
            endDate: null,
          },
          include: {
            staff: {
              select: {
                id: true,
                fullName: true,
                employeeCode: true,
                profilePhotoUrl: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
        _count: {
          select: {
            staff: true,
            customers: true,
            resources: true,
          },
        },
      },
    });

    if (!branch) {
      throw new NotFoundException({
        code: 'BRANCH_NOT_FOUND',
        message: 'Branch not found or inaccessible in your organization',
      });
    }

    // Role-based branch restriction check
    const permittedBranchIds = await this.getPermittedBranchIds(user);
    if (permittedBranchIds !== null && !permittedBranchIds.includes(branch.id)) {
      throw new ForbiddenException({
        code: 'BRANCH_ACCESS_DENIED',
        message: 'You are not authorized to view or manage this branch',
      });
    }

    return branch;
  }

  /**
   * 4. Update Branch Profile
   */
  async update(
    id: string,
    dto: UpdateBranchDto,
    user: AuthenticatedUser,
    clientIp?: string,
  ) {
    const roles = (user.roles || []).map((r) => r.toLowerCase().replace(/_/g, '-'));
    const isSuperAdmin = roles.includes('super-admin');

    const branch = await this.prisma.sms_branches.findFirst({
      where: {
        id,
        ...(isSuperAdmin ? {} : { organizationId: user.organizationId }),
        deletedAt: null,
      },
    });

    if (!branch) {
      throw new NotFoundException({
        code: 'BRANCH_NOT_FOUND',
        message: 'Branch not found or inaccessible in your organization',
      });
    }

    // Check manager authorization
    const permittedBranchIds = await this.getPermittedBranchIds(user);
    if (permittedBranchIds !== null && !permittedBranchIds.includes(branch.id)) {
      throw new ForbiddenException({
        code: 'BRANCH_ACCESS_DENIED',
        message: 'You are not authorized to update this branch',
      });
    }

    const data: Prisma.sms_branchesUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }

    if (dto.code !== undefined) {
      const code = this.normalizeCode(dto.code);
      if (code !== branch.code) {
        const codeCheck = await this.checkCodeAvailability(
          branch.organizationId,
          code,
        );
        if (!codeCheck.available) {
          throw new BadRequestException({
            code: 'DUPLICATE_BRANCH_CODE',
            message: `Branch code "${code}" is already in use`,
            suggestedCode: codeCheck.suggestedCode,
          });
        }
        data.code = code;
      }
    }

    if (dto.branchType !== undefined) {
      data.branchType = dto.branchType;
    }

    if (dto.coverImageUrl !== undefined) {
      data.coverImageUrl = dto.coverImageUrl;
    }

    if (dto.status !== undefined) {
      data.status = dto.status;
    }

    if (dto.launchedAt !== undefined) {
      data.launchedAt = dto.launchedAt ? new Date(dto.launchedAt) : null;
    }

    // Handle address update/upsert
    if (dto.address) {
      await this.prisma.sms_branchAddresses.upsert({
        where: { branchId: branch.id },
        create: {
          branchId: branch.id,
          addressLine1: dto.address.addressLine1?.trim() || '',
          addressLine2: dto.address.addressLine2?.trim() || null,
          landmark: dto.address.landmark?.trim() || null,
          city: dto.address.city?.trim() || '',
          state: dto.address.state?.trim() || '',
          postalCode: dto.address.postalCode?.trim() || '',
          countryCode: (dto.address.countryCode?.trim() || 'IN').slice(0, 2).toUpperCase(),
          latitude: dto.address.latitude != null ? dto.address.latitude : null,
          longitude: dto.address.longitude != null ? dto.address.longitude : null,
          mapsUrl: dto.address.mapsUrl?.trim() || null,
        },
        update: {
          ...(dto.address.addressLine1 !== undefined && { addressLine1: dto.address.addressLine1.trim() }),
          ...(dto.address.addressLine2 !== undefined && { addressLine2: dto.address.addressLine2?.trim() || null }),
          ...(dto.address.landmark !== undefined && { landmark: dto.address.landmark?.trim() || null }),
          ...(dto.address.city !== undefined && { city: dto.address.city.trim() }),
          ...(dto.address.state !== undefined && { state: dto.address.state.trim() }),
          ...(dto.address.postalCode !== undefined && { postalCode: dto.address.postalCode.trim() }),
          ...(dto.address.countryCode !== undefined && {
            countryCode: (dto.address.countryCode.trim() || 'IN').slice(0, 2).toUpperCase(),
          }),
          ...(dto.address.latitude !== undefined && { latitude: dto.address.latitude }),
          ...(dto.address.longitude !== undefined && { longitude: dto.address.longitude }),
          ...(dto.address.mapsUrl !== undefined && { mapsUrl: dto.address.mapsUrl }),
        },
      });
    }

    // Handle contact update/upsert
    if (dto.contact) {
      await this.prisma.sms_branchContacts.upsert({
        where: { branchId: branch.id },
        create: {
          branchId: branch.id,
          phoneCountryCode: dto.contact.phoneCountryCode || '+91',
          phoneNumber: dto.contact.phoneNumber?.trim() || null,
          email: dto.contact.email?.trim() || null,
          whatsappNumber: dto.contact.whatsappNumber?.trim() || null,
        },
        update: {
          ...(dto.contact.phoneCountryCode !== undefined && { phoneCountryCode: dto.contact.phoneCountryCode }),
          ...(dto.contact.phoneNumber !== undefined && { phoneNumber: dto.contact.phoneNumber?.trim() || null }),
          ...(dto.contact.email !== undefined && { email: dto.contact.email?.trim() || null }),
          ...(dto.contact.whatsappNumber !== undefined && { whatsappNumber: dto.contact.whatsappNumber?.trim() || null }),
        },
      });
    }

    // Handle business hours update/upsert
    if (dto.businessHours && dto.businessHours.length > 0) {
      for (const h of dto.businessHours) {
        const existingHour = await this.prisma.sms_businessHours.findFirst({
          where: { branchId: branch.id, dayOfWeek: h.dayOfWeek },
        });
        if (existingHour) {
          await this.prisma.sms_businessHours.update({
            where: { id: existingHour.id },
            data: {
              isOpen: h.isOpen,
              openTime: h.openTime,
              closeTime: h.closeTime,
            },
          });
        } else {
          await this.prisma.sms_businessHours.create({
            data: {
              organizationId: branch.organizationId,
              branchId: branch.id,
              dayOfWeek: h.dayOfWeek,
              isOpen: h.isOpen,
              openTime: h.openTime || '09:00',
              closeTime: h.closeTime || '19:00',
            },
          });
        }
      }
    }

    const updated = await this.prisma.sms_branches.update({
      where: { id },
      data,
      include: {
        branchAddress: true,
        branchContact: true,
        branchSettings: true,
        businessHours: {
          orderBy: { dayOfWeek: 'asc' },
        },
      },
    });

    this.logger.log(
      `Branch ${id} updated by user ${user.id} (${user.email}) from IP ${clientIp || 'unknown'}`,
    );

    return updated;
  }

  /**
   * 5. Check Deletion Blockers for a Branch
   */
  async getBlockers(id: string, user: AuthenticatedUser) {
    const branch = await this.prisma.sms_branches.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
    });

    if (!branch) {
      throw new NotFoundException({
        code: 'BRANCH_NOT_FOUND',
        message: 'Branch not found in your organization',
      });
    }

    const [
      homeStaffCount,
      assignedStaffCount,
      customerCount,
      resourceCount,
      packageCount,
    ] = await Promise.all([
      this.prisma.sms_staff.count({
        where: { homeBranchId: id, deletedAt: null },
      }),
      this.prisma.sms_staffBranchAssignments.count({
        where: { branchId: id },
      }),
      this.prisma.sms_customers.count({
        where: { registeredBranchId: id },
      }),
      this.prisma.sms_resources.count({
        where: { branchId: id },
      }),
      this.prisma.sms_customerPackagePurchases.count({
        where: { branchId: id },
      }),
    ]);

    const totalStaffCount = homeStaffCount + assignedStaffCount;
    const totalDependencies =
      totalStaffCount + customerCount + resourceCount + packageCount;

    return {
      branchId: id,
      branchName: branch.name,
      branchCode: branch.code,
      status: branch.status,
      canDelete: totalDependencies === 0,
      totalDependencies,
      blockers: {
        homeStaffCount,
        assignedStaffCount,
        customerCount,
        resourceCount,
        packageCount,
      },
      recommendedAction:
        totalDependencies > 0
          ? 'permanently_closed'
          : 'delete',
    };
  }

  /**
   * 6. Soft-delete a Branch (Protected against dependent records)
   */
  async delete(id: string, user: AuthenticatedUser, clientIp?: string) {
    const roles = (user.roles || []).map((r) => r.toLowerCase().replace(/_/g, '-'));
    if (!roles.includes('owner') && !roles.includes('super-admin')) {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Only organization owners can delete branches',
      });
    }

    const blockers = await this.getBlockers(id, user);

    if (!blockers.canDelete) {
      throw new ConflictException({
        code: 'BRANCH_HAS_DEPENDENCIES',
        message: `Cannot delete branch "${blockers.branchName}" because it has ${blockers.totalDependencies} active associated records. Please close the branch instead.`,
        blockers: blockers.blockers,
        recommendedAction: blockers.recommendedAction,
      });
    }

    const deleted = await this.prisma.sms_branches.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'permanently_closed',
      },
    });

    this.logger.warn(
      `Branch ${id} (${deleted.name}) soft-deleted by user ${user.id} from IP ${clientIp || 'unknown'}`,
    );

    return {
      success: true,
      message: `Branch "${deleted.name}" has been deleted successfully.`,
      branchId: id,
    };
  }

  /**
   * 7. Copy Settings from an Existing Branch
   */
  async copySettings(
    targetBranchId: string,
    dto: CopyBranchSettingsDto,
    user: AuthenticatedUser,
  ) {
    const [sourceBranch, targetBranch] = await Promise.all([
      this.prisma.sms_branches.findFirst({
        where: {
          id: dto.sourceBranchId,
          organizationId: user.organizationId,
          deletedAt: null,
        },
        include: {
          branchSettings: true,
          businessHours: true,
        },
      }),
      this.prisma.sms_branches.findFirst({
        where: {
          id: targetBranchId,
          organizationId: user.organizationId,
          deletedAt: null,
        },
      }),
    ]);

    if (!sourceBranch) {
      throw new NotFoundException({
        code: 'SOURCE_BRANCH_NOT_FOUND',
        message: 'Source branch not found in your organization',
      });
    }

    if (!targetBranch) {
      throw new NotFoundException({
        code: 'TARGET_BRANCH_NOT_FOUND',
        message: 'Target branch not found in your organization',
      });
    }

    if (sourceBranch.id === targetBranch.id) {
      throw new BadRequestException({
        code: 'INVALID_COPY_SOURCE',
        message: 'Cannot copy settings to the same branch',
      });
    }

    const preview = {
      sourceBranch: {
        id: sourceBranch.id,
        name: sourceBranch.name,
        code: sourceBranch.code,
      },
      targetBranch: {
        id: targetBranch.id,
        name: targetBranch.name,
        code: targetBranch.code,
      },
      settingsToCopy: {
        hasSettings: Boolean(sourceBranch.branchSettings),
        businessHoursDaysCount: sourceBranch.businessHours.length,
        settingsSummary: sourceBranch.branchSettings
          ? {
              onlineBookingEnabled: sourceBranch.branchSettings.onlineBookingEnabled,
              maxConcurrentAppointments: sourceBranch.branchSettings.maxConcurrentAppointments,
              minBookingLeadMinutes: sourceBranch.branchSettings.minBookingLeadMinutes,
              maxBookingAdvanceDays: sourceBranch.branchSettings.maxBookingAdvanceDays,
              walkinQueueEnabled: sourceBranch.branchSettings.walkinQueueEnabled,
              onlinePaymentsEnabled: sourceBranch.branchSettings.onlinePaymentsEnabled,
            }
          : null,
      },
    };

    if (dto.previewOnly) {
      return {
        preview: true,
        ...preview,
      };
    }

    // Apply copying in transaction
    await this.prisma.$transaction(async (tx) => {
      if (dto.copySettings && sourceBranch.branchSettings) {
        await tx.sms_branchSettings.upsert({
          where: { branchId: targetBranchId },
          create: {
            branchId: targetBranchId,
            onlineBookingEnabled: sourceBranch.branchSettings.onlineBookingEnabled,
            maxConcurrentAppointments: sourceBranch.branchSettings.maxConcurrentAppointments,
            minBookingLeadMinutes: sourceBranch.branchSettings.minBookingLeadMinutes,
            maxBookingAdvanceDays: sourceBranch.branchSettings.maxBookingAdvanceDays,
            walkinQueueEnabled: sourceBranch.branchSettings.walkinQueueEnabled,
            giftCardsEnabled: sourceBranch.branchSettings.giftCardsEnabled,
            membershipSalesEnabled: sourceBranch.branchSettings.membershipSalesEnabled,
            onlinePaymentsEnabled: sourceBranch.branchSettings.onlinePaymentsEnabled,
            cancellationPolicyText: sourceBranch.branchSettings.cancellationPolicyText,
            noShowFeeAmount: sourceBranch.branchSettings.noShowFeeAmount,
            taxRateOverridePercentage: sourceBranch.branchSettings.taxRateOverridePercentage,
          },
          update: {
            onlineBookingEnabled: sourceBranch.branchSettings.onlineBookingEnabled,
            maxConcurrentAppointments: sourceBranch.branchSettings.maxConcurrentAppointments,
            minBookingLeadMinutes: sourceBranch.branchSettings.minBookingLeadMinutes,
            maxBookingAdvanceDays: sourceBranch.branchSettings.maxBookingAdvanceDays,
            walkinQueueEnabled: sourceBranch.branchSettings.walkinQueueEnabled,
            giftCardsEnabled: sourceBranch.branchSettings.giftCardsEnabled,
            membershipSalesEnabled: sourceBranch.branchSettings.membershipSalesEnabled,
            onlinePaymentsEnabled: sourceBranch.branchSettings.onlinePaymentsEnabled,
            cancellationPolicyText: sourceBranch.branchSettings.cancellationPolicyText,
            noShowFeeAmount: sourceBranch.branchSettings.noShowFeeAmount,
            taxRateOverridePercentage: sourceBranch.branchSettings.taxRateOverridePercentage,
          },
        });
      }

      if (dto.copyHours && sourceBranch.businessHours.length > 0) {
        // Delete existing custom branch hours if any
        await tx.sms_businessHours.deleteMany({
          where: { branchId: targetBranchId },
        });

        // Insert new hours
        for (const sh of sourceBranch.businessHours) {
          await tx.sms_businessHours.create({
            data: {
              organizationId: user.organizationId,
              branchId: targetBranchId,
              dayOfWeek: sh.dayOfWeek,
              isOpen: sh.isOpen,
              openTime: sh.openTime,
              closeTime: sh.closeTime,
              breakStartTime: sh.breakStartTime,
              breakEndTime: sh.breakEndTime,
              spansMidnight: sh.spansMidnight,
            },
          });
        }
      }
    });

    return {
      success: true,
      message: `Settings copied from "${sourceBranch.name}" to "${targetBranch.name}" successfully.`,
      applied: preview,
    };
  }
}

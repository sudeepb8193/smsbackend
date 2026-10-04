import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { QueryOrganisationDto } from './dto/query-organisation.dto';
import { CreateOrganisationDto } from './dto/create-organisation.dto';
import { UpdateOrganisationDto } from './dto/update-organisation.dto';
import { sms_organizations_status } from '@prisma/client';

@Injectable()
export class OrganisationRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find paginated list of organisations with search & filters
   */
  async findMany(query: QueryOrganisationDto) {
    const {
      search,
      status,
      plan,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * limit;

    const whereClause: any = {
      deletedAt: null,
    };

    if (status && status !== 'all') {
      whereClause.status = status as sms_organizations_status;
    }

    if (plan && plan !== 'all') {
      whereClause.subscription = {
        planName: { equals: plan, mode: 'insensitive' },
      };
    }

    if (search && search.trim() !== '') {
      const searchTerm = search.trim();
      whereClause.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { code: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
        { phone: { contains: searchTerm, mode: 'insensitive' } },
        {
          users: {
            some: {
              displayName: { contains: searchTerm, mode: 'insensitive' },
            },
          },
        },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.sms_organizations.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          subscription: true,
          organizationContacts: {
            where: { isDefaultPublic: true },
            take: 1,
          },
          organizationAddresses: {
            take: 1,
          },
          users: {
            where: {
              userRolesAssignedToMe: {
                some: {
                  role: {
                    name: { in: ['Owner', 'OWNER', 'Super Admin'] },
                  },
                },
              },
            },
            take: 1,
            select: {
              id: true,
              displayName: true,
              email: true,
              phoneNumber: true,
            },
          },
          _count: {
            select: {
              branches: true,
              users: true,
            },
          },
        },
      }),
      this.prisma.sms_organizations.count({ where: whereClause }),
    ]);

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find single organization by ID with deep relations and statistics
   */
  async findById(id: string) {
    const org = await this.prisma.sms_organizations.findFirst({
      where: { id, deletedAt: null },
      include: {
        subscription: true,
        organizationSettings: true,
        organizationAddresses: true,
        organizationContacts: true,
        organizationTaxProfiles: true,
        branches: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            code: true,
            branchType: true,
            status: true,
            createdAt: true,
          },
        },
        users: {
          where: { deletedAt: null },
          select: {
            id: true,
            displayName: true,
            email: true,
            phoneNumber: true,
            status: true,
            createdAt: true,
            userRolesAssignedToMe: {
              include: {
                role: {
                  select: { id: true, name: true, slug: true },
                },
              },
            },
          },
        },
        _count: {
          select: {
            branches: true,
            users: true,
            customers: true,
            services: true,
          },
        },
      },
    });

    if (!org) return null;

    // Fetch staff count
    const staffCount = await this.prisma.sms_staff.count({
      where: {
        organizationId: id,
        deletedAt: null,
      },
    });

    return {
      ...org,
      stats: {
        totalBranches: org._count.branches,
        totalUsers: org._count.users,
        totalStaff: staffCount,
        totalCustomers: org._count.customers,
        totalAppointments: 0, // Placeholder until appointment module is linked
      },
    };
  }

  /**
   * Find organization by unique code
   */
  async findByCode(code: string) {
    return this.prisma.sms_organizations.findFirst({
      where: {
        code: { equals: code.trim(), mode: 'insensitive' },
        deletedAt: null,
      },
    });
  }

  /**
   * Find organization by unique email
   */
  async findByEmail(email: string) {
    return this.prisma.sms_organizations.findFirst({
      where: {
        email: { equals: email.trim(), mode: 'insensitive' },
        deletedAt: null,
      },
    });
  }

  /**
   * Find user by email across all organizations
   */
  async findUserByEmail(email: string) {
    return this.prisma.sms_users.findFirst({
      where: {
        email: { equals: email.trim(), mode: 'insensitive' },
        deletedAt: null,
      },
    });
  }

  /**
   * Execute atomic transaction for organization creation
   */
  async createWithTransaction(data: {
    orgData: any;
    ownerData: any;
    addressData: any;
    contactData: any;
    settingsData: any;
    subscriptionData: any;
    performedById?: string;
    clientIp?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Create Organisation
      const org = await tx.sms_organizations.create({
        data: data.orgData,
      });

      // 2. Create Owner User
      const owner = await tx.sms_users.create({
        data: {
          ...data.ownerData,
          organizationId: org.id,
        },
      });

      // 3. Create or fetch System Owner Role for Org
      let ownerRole = await tx.sms_roles.findFirst({
        where: {
          organizationId: org.id,
          slug: 'owner',
        },
      });

      if (!ownerRole) {
        ownerRole = await tx.sms_roles.create({
          data: {
            organizationId: org.id,
            name: 'Owner',
            slug: 'owner',
            description: 'Organization Owner with full operational management rights',
            roleType: 'system',
            status: 'active',
          },
        });
      }

      // Assign Owner role to user
      await tx.sms_userRoles.create({
        data: {
          userId: owner.id,
          roleId: ownerRole.id,
          isPrimary: true,
          assignedAt: new Date(),
        },
      });

      // Update Org createdById to Owner
      await tx.sms_organizations.update({
        where: { id: org.id },
        data: { createdById: owner.id },
      });

      // 4. Create Address
      if (data.addressData) {
        await tx.sms_organizationAddresses.create({
          data: {
            ...data.addressData,
            organizationId: org.id,
          },
        });
      }

      // 5. Create Contact
      if (data.contactData) {
        await tx.sms_organizationContacts.create({
          data: {
            ...data.contactData,
            organizationId: org.id,
          },
        });
      }

      // 6. Create Settings
      await tx.sms_organizationSettings.create({
        data: {
          ...data.settingsData,
          organizationId: org.id,
        },
      });

      // 7. Create Subscription
      const subscription = await tx.sms_subscriptions.create({
        data: {
          ...data.subscriptionData,
          organizationId: org.id,
        },
      });

      // 8. Create Audit Log
      await tx.sms_auditLogs.create({
        data: {
          organizationId: org.id,
          performedById: data.performedById || owner.id,
          action: 'ORGANISATION_CREATED',
          newValue: {
            organizationName: org.name,
            code: org.code,
            ownerEmail: owner.email,
            plan: subscription.planName,
          },
          ipAddress: data.clientIp || null,
        },
      });

      return { org, owner, subscription };
    });
  }

  /**
   * Execute atomic transaction for organization updates
   */
  async updateWithTransaction(
    id: string,
    data: {
      orgData: any;
      subscriptionData?: any;
      addressData?: any;
      contactData?: any;
      settingsData?: any;
      performedById?: string;
      clientIp?: string;
      oldValues: any;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Update Organisation
      const org = await tx.sms_organizations.update({
        where: { id },
        data: data.orgData,
      });

      // 2. Update Subscription if provided
      if (data.subscriptionData) {
        await tx.sms_subscriptions.upsert({
          where: { organizationId: id },
          create: {
            ...data.subscriptionData,
            organizationId: id,
          },
          update: data.subscriptionData,
        });
      }

      // 3. Update or create Address if provided
      if (data.addressData) {
        const existingAddress = await tx.sms_organizationAddresses.findFirst({
          where: { organizationId: id },
        });

        if (existingAddress) {
          await tx.sms_organizationAddresses.update({
            where: { id: existingAddress.id },
            data: data.addressData,
          });
        } else {
          await tx.sms_organizationAddresses.create({
            data: {
              ...data.addressData,
              organizationId: id,
            },
          });
        }
      }

      // 4. Update Settings if provided
      if (data.settingsData) {
        await tx.sms_organizationSettings.upsert({
          where: { organizationId: id },
          create: {
            ...data.settingsData,
            organizationId: id,
          },
          update: data.settingsData,
        });
      }

      // 5. Audit Log
      await tx.sms_auditLogs.create({
        data: {
          organizationId: id,
          performedById: data.performedById || null,
          action: 'ORGANISATION_UPDATED',
          oldValue: data.oldValues,
          newValue: data.orgData,
          ipAddress: data.clientIp || null,
        },
      });

      return org;
    });
  }

  /**
   * Update organization status (active, inactive, suspended) & log audit
   */
  async updateStatus(
    id: string,
    status: sms_organizations_status,
    oldStatus: sms_organizations_status,
    performedById?: string,
    clientIp?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const org = await tx.sms_organizations.update({
        where: { id },
        data: { status },
      });

      // Also update subscription status if exists
      await tx.sms_subscriptions.updateMany({
        where: { organizationId: id },
        data: { status },
      });

      let action = 'ORGANISATION_UPDATED';
      if (status === 'active') action = 'ORGANISATION_ACTIVATED';
      else if (status === 'inactive') action = 'ORGANISATION_DEACTIVATED';
      else if (status === 'suspended') action = 'ORGANISATION_SUSPENDED';

      await tx.sms_auditLogs.create({
        data: {
          organizationId: id,
          performedById: performedById || null,
          action,
          oldValue: { status: oldStatus },
          newValue: { status },
          ipAddress: clientIp || null,
        },
      });

      return org;
    });
  }

  /**
   * Soft delete organization & log audit action
   */
  async softDelete(
    id: string,
    performedById?: string,
    clientIp?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();

      const org = await tx.sms_organizations.update({
        where: { id },
        data: {
          deletedAt: now,
          deletedById: performedById || null,
          status: 'inactive',
        },
      });

      await tx.sms_auditLogs.create({
        data: {
          organizationId: id,
          performedById: performedById || null,
          action: 'ORGANISATION_DELETED',
          oldValue: { deletedAt: null },
          newValue: { deletedAt: now, deletedById: performedById || null },
          ipAddress: clientIp || null,
        },
      });

      return org;
    });
  }
}

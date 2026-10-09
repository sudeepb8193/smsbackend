import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { QueryOrganisationDto } from './dto/query-organisation.dto';
import { CreateOrganisationDto } from './dto/create-organisation.dto';
import { UpdateOrganisationDto } from './dto/update-organisation.dto';
import { UpdateOrganisationSetupDto } from './dto/update-organisation-setup.dto';
import {
  sms_organizationAddresses_addressType,
  sms_organizationContacts_contactType,
  sms_organizationSettings_currencySymbolPosition,
  sms_organizationSettings_timeFormat,
  sms_organizationTaxProfiles_taxIdentifierType,
  sms_organizations_businessType,
  sms_organizations_status,
} from '@prisma/client';

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
        organizationAddresses: { where: { deletedAt: null } },
        organizationContacts: { where: { deletedAt: null } },
        organizationTaxProfiles: true,
        businessHours: { where: { branchId: null, deletedAt: null }, orderBy: { dayOfWeek: 'asc' } },
        holidays: { where: { deletedAt: null }, orderBy: { holidayDate: 'asc' } },
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

  async findBySlug(slug: string, exceptId?: string) {
    return this.prisma.sms_organizations.findFirst({
      where: {
        slug: { equals: slug, mode: 'insensitive' },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true, slug: true },
    });
  }

  async updateSetup(
    id: string,
    dto: UpdateOrganisationSetupDto,
    performedById?: string,
    clientIp?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.sms_organizations.findUnique({
        where: { id },
        select: { name: true, slug: true, status: true },
      });
      if (!existing) return null;

      const primaryContact = dto.contacts.find(
        (contact) => contact.contactType === 'primary',
      );
      const org = await tx.sms_organizations.update({
        where: { id },
        data: {
          name: dto.profile.name.trim(),
          legalName: dto.profile.legalName?.trim() || null,
          slug: dto.profile.slug.trim().toLowerCase(),
          ...(dto.profile.slug.trim().toLowerCase() !== existing.slug
            ? { slugChangedAt: new Date() }
            : {}),
          businessType: dto.profile.businessType as sms_organizations_businessType,
          logoUrl: dto.profile.logoUrl || null,
          logoSquareUrl: dto.profile.logoSquareUrl || null,
          logoWideUrl: dto.profile.logoWideUrl || null,
          faviconUrl: dto.profile.faviconUrl || null,
          brandPrimaryColor: dto.profile.brandPrimaryColor || null,
          brandSecondaryColor: dto.profile.brandSecondaryColor || null,
          status: dto.profile.status as sms_organizations_status,
          onboardingStep:
            dto.profile.status === 'active' ? 7 : dto.profile.onboardingStep,
          ...(primaryContact
            ? {
              email: primaryContact.email?.trim().toLowerCase() || null,
              phone: primaryContact.phoneNumber?.trim() || null,
            }
            : {}),
        },
      });
      if (dto.profile.status !== existing.status) {
        await tx.sms_subscriptions.updateMany({
          where: { organizationId: id },
          data: { status: dto.profile.status as sms_organizations_status },
        });
      }

      const contacts = dto.contacts;
      const retainedContactIds = contacts.flatMap((contact) =>
        contact.id ? [contact.id] : [],
      );
      await tx.sms_organizationContacts.updateMany({
        where: {
          organizationId: id,
          deletedAt: null,
          ...(retainedContactIds.length
            ? { id: { notIn: retainedContactIds } }
            : {}),
        },
        data: { deletedAt: new Date() },
      });
      for (const contact of contacts) {
        const existingContact = contact.id
          ? await tx.sms_organizationContacts.findFirst({
            where: { id: contact.id, organizationId: id },
            select: { email: true, emailVerified: true },
          })
          : null;
        const normalizedEmail = contact.email?.trim().toLowerCase() || null;
        const emailChanged =
          existingContact?.email?.toLowerCase() !== normalizedEmail;
        const contactData = {
          contactType: contact.contactType as sms_organizationContacts_contactType,
          contactName: contact.contactName?.trim() || null,
          phoneCountryCode: contact.phoneCountryCode?.trim() || null,
          phoneNumber: contact.phoneNumber?.trim() || null,
          email: normalizedEmail,
          emailVerified: existingContact && !emailChanged
            ? existingContact.emailVerified
            : false,
          ...(emailChanged
            ? {
              emailVerificationTokenHash: null,
              emailVerificationExpiresAt: null,
            }
            : {}),
          isDefaultPublic: contact.isDefaultPublic,
          sameAsPrimary: contact.sameAsPrimary || false,
        };
        if (contact.id) {
          const updatedContact = await tx.sms_organizationContacts.updateMany({
            where: { id: contact.id, organizationId: id },
            data: contactData,
          });
          if (updatedContact.count !== 1) {
            throw new BadRequestException(
              'A selected contact does not belong to this organization.',
            );
          }
        } else {
          await tx.sms_organizationContacts.create({
            data: { ...contactData, organizationId: id },
          });
        }
      }

      for (const address of dto.addresses) {
        const addressType = address.addressType as sms_organizationAddresses_addressType;
        const values = {
          addressLine1: address.addressLine1?.trim() || '',
          addressLine2: address.addressLine2?.trim() || null,
          landmark: address.landmark?.trim() || null,
          city: address.city?.trim() || '',
          state: address.state?.trim() || '',
          postalCode: address.postalCode?.trim() || '',
          country: address.country?.trim() || '',
          latitude: address.latitude ?? null,
          longitude: address.longitude ?? null,
          sameAsRegistered: address.sameAsRegistered,
          deletedAt: null,
        };
        const existingAddress = await tx.sms_organizationAddresses.findFirst({
          where: { organizationId: id, addressType },
        });
        if (address.addressType === 'billing' && !values.addressLine1) {
          if (existingAddress) {
            await tx.sms_organizationAddresses.update({
              where: { id: existingAddress.id },
              data: { deletedAt: new Date() },
            });
          }
          continue;
        }
        if (existingAddress) {
          await tx.sms_organizationAddresses.update({
            where: { id: existingAddress.id },
            data: values,
          });
        } else {
          await tx.sms_organizationAddresses.create({
            data: { ...values, organizationId: id, addressType },
          });
        }
      }

      const taxProfile = dto.taxProfile;
      const existingTaxProfile = await tx.sms_organizationTaxProfiles.findFirst({
        where: { organizationId: id },
        orderBy: { createdAt: 'asc' },
      });
      if (taxProfile?.taxIdentifierNumber?.trim()) {
        const isSameTaxRegistration = Boolean(
          existingTaxProfile &&
            existingTaxProfile.taxIdentifierNumber ===
              taxProfile.taxIdentifierNumber.trim().toUpperCase() &&
            existingTaxProfile.taxIdentifierType === taxProfile.taxIdentifierType &&
            existingTaxProfile.registeredBusinessName ===
              taxProfile.registeredBusinessName.trim() &&
            (existingTaxProfile.taxRegistrationDate?.toISOString().slice(0, 10) ||
              null) === (taxProfile.taxRegistrationDate || null) &&
            existingTaxProfile.isTaxExempt === taxProfile.isTaxExempt &&
            existingTaxProfile.documentUrl === (taxProfile.documentUrl || null),
        );
        const verificationStatus = isSameTaxRegistration
          ? taxProfile.verificationStatus ||
            existingTaxProfile?.verificationStatus ||
            'pending'
          : 'pending';
        const taxData = {
          taxIdentifierType: taxProfile.taxIdentifierType as sms_organizationTaxProfiles_taxIdentifierType,
          taxIdentifierNumber: taxProfile.taxIdentifierNumber.trim().toUpperCase(),
          registeredBusinessName: taxProfile.registeredBusinessName.trim(),
          taxRegistrationDate: taxProfile.taxRegistrationDate
            ? new Date(taxProfile.taxRegistrationDate)
            : null,
          isTaxExempt: taxProfile.isTaxExempt,
          documentUrl: taxProfile.documentUrl || null,
          verificationStatus:
            verificationStatus as 'pending' | 'verified' | 'rejected',
          verifiedAt:
            verificationStatus === 'verified'
              ? existingTaxProfile?.verifiedAt || new Date()
              : null,
          verificationNotes: isSameTaxRegistration
            ? taxProfile.verificationNotes?.trim() || null
            : null,
        };
        if (existingTaxProfile) {
          await tx.sms_organizationTaxProfiles.update({
            where: { id: existingTaxProfile.id },
            data: taxData,
          });
        } else {
          await tx.sms_organizationTaxProfiles.create({
            data: { ...taxData, organizationId: id },
          });
        }
      } else if (existingTaxProfile) {
        await tx.sms_organizationTaxProfiles.deleteMany({
          where: { organizationId: id },
        });
      }

      const settingsData = {
        ...dto.settings,
        currencySymbolPosition:
          dto.settings.currencySymbolPosition as sms_organizationSettings_currencySymbolPosition,
        timeFormat: dto.settings.timeFormat as sms_organizationSettings_timeFormat,
      };
      await tx.sms_organizationSettings.upsert({
        where: { organizationId: id },
        create: {
          organizationId: id,
          ...settingsData,
        },
        update: settingsData,
      });

      for (const hour of dto.businessHours) {
        const existingHour = await tx.sms_businessHours.findFirst({
          where: { organizationId: id, branchId: null, dayOfWeek: hour.dayOfWeek },
        });
        const values = {
          isOpen: hour.isOpen,
          openTime: hour.isOpen ? hour.openTime || null : null,
          closeTime: hour.isOpen ? hour.closeTime || null : null,
          breakStartTime: hour.isOpen ? hour.breakStartTime || null : null,
          breakEndTime: hour.isOpen ? hour.breakEndTime || null : null,
          spansMidnight: hour.isOpen && hour.spansMidnight,
          deletedAt: null,
        };
        if (existingHour) {
          await tx.sms_businessHours.update({
            where: { id: existingHour.id },
            data: values,
          });
        } else {
          await tx.sms_businessHours.create({
            data: { ...values, organizationId: id, branchId: null, dayOfWeek: hour.dayOfWeek },
          });
        }
      }

      const retainedHolidayIds = dto.holidays.flatMap((holiday) =>
        holiday.id ? [holiday.id] : [],
      );
      await tx.sms_holidays.updateMany({
        where: {
          organizationId: id,
          deletedAt: null,
          ...(retainedHolidayIds.length
            ? { id: { notIn: retainedHolidayIds } }
            : {}),
        },
        data: { status: 'cancelled' },
      });
      for (const holiday of dto.holidays) {
        const holidayData = {
          branchId: holiday.branchId || null,
          name: holiday.name.trim(),
          description: holiday.description?.trim() || null,
          holidayDate: new Date(`${holiday.holidayDate.slice(0, 10)}T00:00:00.000Z`),
          isRecurringAnnually: holiday.isRecurringAnnually,
          status: holiday.status as 'active' | 'cancelled',
          deletedAt: null,
        };
        if (holiday.id) {
          const updatedHoliday = await tx.sms_holidays.updateMany({
            where: { id: holiday.id, organizationId: id },
            data: holidayData,
          });
          if (updatedHoliday.count !== 1) {
            throw new BadRequestException(
              'A selected holiday does not belong to this organization.',
            );
          }
        } else {
          await tx.sms_holidays.create({
            data: { ...holidayData, organizationId: id, createdById: performedById || null },
          });
        }
      }

      await tx.sms_auditLogs.create({
        data: {
          organizationId: id,
          performedById: performedById || null,
          action: 'ORGANISATION_SETUP_UPDATED',
          oldValue: { name: existing.name, slug: existing.slug, status: existing.status },
          newValue: { name: org.name, slug: org.slug, status: org.status },
          ipAddress: clientIp || null,
        },
      });
      return org;
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
        data: {
          status,
          ...(status === 'active' ? { onboardingStep: 7 } : {}),
        },
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

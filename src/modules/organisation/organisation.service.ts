import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { OrganisationRepository } from './organisation.repository';
import { CreateOrganisationDto } from './dto/create-organisation.dto';
import { UpdateOrganisationDto } from './dto/update-organisation.dto';
import { UpdateOrganisationStatusDto } from './dto/update-organisation-status.dto';
import { QueryOrganisationDto } from './dto/query-organisation.dto';
import { UpdateOrganisationSetupDto } from './dto/update-organisation-setup.dto';
import * as bcrypt from 'bcrypt';
import { sms_organizations_status } from '@prisma/client';

@Injectable()
export class OrganisationService {
  constructor(
    private readonly organisationRepository: OrganisationRepository,
  ) {}

  /**
   * Helper to generate a URL-safe unique slug for an organization
   */
  private generateSlug(name: string): string {
    return (
      name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 140) || 'salon'
    );
  }

  /**
   * Create a new Organisation (Super Admin only)
   */
  async create(
    dto: CreateOrganisationDto,
    performedById?: string,
    clientIp?: string,
  ) {
    const code = dto.code.trim().toUpperCase();
    const ownerEmail = dto.ownerEmail.trim().toLowerCase();
    const orgEmail = dto.email.trim().toLowerCase();

    // 1. Check Organisation Code uniqueness
    const existingCode = await this.organisationRepository.findByCode(code);
    if (existingCode) {
      throw new ConflictException({
        code: 'ORGANISATION_CODE_EXISTS',
        message: `Organisation code "${code}" is already in use. Please use a unique code.`,
      });
    }

    // 2. Check Owner Email uniqueness
    const existingUser = await this.organisationRepository.findUserByEmail(
      ownerEmail,
    );
    if (existingUser) {
      throw new ConflictException({
        code: 'OWNER_EMAIL_EXISTS',
        message: `An account with email "${ownerEmail}" already exists.`,
      });
    }

    // 3. Generate unique slug
    let baseSlug = this.generateSlug(dto.name);
    let slug = `${baseSlug}-${code.toLowerCase()}`;

    // 4. Hash owner password (default Owner@123 as requested)
    const rawPassword = dto.ownerPassword || 'Owner@123';
    const passwordHash = await bcrypt.hash(rawPassword, 12);

    // 5. Build Transaction Payload
    const orgData = {
      name: dto.name.trim(),
      code,
      slug,
      businessType: dto.businessType,
      description: dto.description || null,
      email: orgEmail,
      phone: dto.phone.trim(),
      website: dto.website || null,
      logoUrl: dto.logoUrl || null,
      status: (dto.status || 'active') as sms_organizations_status,
    };

    const ownerData = {
      displayName: dto.ownerName.trim(),
      email: ownerEmail,
      phoneNumber: dto.ownerPhone || null,
      passwordHash,
      status: 'active' as const,
      inviteAcceptedAt: new Date(),
    };

    const addressData = dto.addressLine1
      ? {
          addressType: 'registered' as const,
          addressLine1: dto.addressLine1,
          city: dto.city || 'N/A',
          state: dto.state || 'N/A',
          country: dto.country || 'India',
          postalCode: dto.pincode || '000000',
        }
      : null;

    const contactData = {
      contactType: 'primary' as const,
      contactName: dto.ownerName.trim(),
      email: orgEmail,
      phoneNumber: dto.phone.trim(),
      isDefaultPublic: true,
    };

    const settingsData = {
      currencyCode: (dto.currency || 'INR').toUpperCase().substring(0, 3),
      timezone: dto.timeZone || 'Asia/Kolkata',
    };

    const subscriptionData = {
      planName: dto.subscriptionPlan.trim(),
      startDate: dto.subscriptionStartDate
        ? new Date(dto.subscriptionStartDate)
        : new Date(),
      endDate: dto.subscriptionEndDate
        ? new Date(dto.subscriptionEndDate)
        : null,
      maxBranches: dto.maxBranches || 1,
      maxUsers: dto.maxUsers || 5,
      status: dto.status || 'active',
    };

    const result = await this.organisationRepository.createWithTransaction({
      orgData,
      ownerData,
      addressData,
      contactData,
      settingsData,
      subscriptionData,
      performedById,
      clientIp,
    });

    return {
      message: 'Organisation created successfully.',
      organisation: result.org,
    };
  }

  /**
   * List paginated organisations with search and filter parameters
   */
  async findAll(query: QueryOrganisationDto) {
    return this.organisationRepository.findMany(query);
  }

  /**
   * Get organisation details by ID
   */
  async findOne(id: string) {
    const org = await this.organisationRepository.findById(id);
    if (!org) {
      throw new NotFoundException({
        code: 'ORGANISATION_NOT_FOUND',
        message: 'Organisation not found',
      });
    }
    return org;
  }

  async checkSlugAvailability(id: string, slug: string) {
    await this.findOne(id);
    const normalizedSlug = slug?.trim().toLowerCase() || '';
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug)) {
      return { available: false, suggestions: [] };
    }
    const match = await this.organisationRepository.findBySlug(
      normalizedSlug,
      id,
    );
    if (!match) return { available: true, suggestions: [] };

    const suggestions: string[] = [];
    for (let suffix = 2; suggestions.length < 3 && suffix < 100; suffix += 1) {
      const candidate = `${normalizedSlug.slice(0, 156)}-${suffix}`;
      if (!(await this.organisationRepository.findBySlug(candidate, id))) {
        suggestions.push(candidate);
      }
    }
    return { available: false, suggestions };
  }

  async updateSetup(
    id: string,
    dto: UpdateOrganisationSetupDto,
    performedById?: string,
    clientIp?: string,
  ) {
    const existingOrg = await this.findOne(id);
    if (/<\/?[a-z][\s\S]*>/i.test(dto.profile.name)) {
      throw new BadRequestException('Business name cannot contain HTML tags.');
    }

    const slugMatch = await this.organisationRepository.findBySlug(
      dto.profile.slug.trim().toLowerCase(),
      id,
    );
    if (
      dto.profile.slug.trim().toLowerCase() !== existingOrg.slug &&
      existingOrg.slugChangedAt
    ) {
      throw new BadRequestException(
        'The customer portal URL can only be changed once.',
      );
    }
    if (slugMatch) {
      throw new ConflictException({
        code: 'ORGANISATION_SLUG_EXISTS',
        message: `The portal URL "${dto.profile.slug}" is already in use.`,
      });
    }

    const registeredAddress = dto.addresses.find(
      (address) => address.addressType === 'registered',
    );
    if (
      !registeredAddress?.addressLine1?.trim() ||
      !registeredAddress.city?.trim() ||
      !registeredAddress.state?.trim() ||
      !registeredAddress.postalCode?.trim() ||
      !registeredAddress.country?.trim()
    ) {
      throw new BadRequestException(
        'Registered address requires a street, city, state, postal code, and country.',
      );
    }
    const postalCode = registeredAddress.postalCode?.trim() || '';
    if (
      (registeredAddress.country === 'India' && !/^\d{6}$/.test(postalCode)) ||
      (registeredAddress.country === 'United States' && !/^\d{5}(?:-\d{4})?$/.test(postalCode))
    ) {
      throw new BadRequestException(
        `Enter a valid postal code for ${registeredAddress.country}.`,
      );
    }
    if (new Set(dto.addresses.map((address) => address.addressType)).size !== 2) {
      throw new BadRequestException(
        'Provide one registered office and one billing address entry.',
      );
    }

    const seenContactTypes = new Set<string>();
    for (const contact of dto.contacts) {
      if (contact.isDefaultPublic && seenContactTypes.has(contact.contactType)) {
        throw new BadRequestException(
          `Only one ${contact.contactType} contact can be the public default.`,
        );
      }
      if (contact.isDefaultPublic) seenContactTypes.add(contact.contactType);
      if (contact.phoneNumber && !/^\+[1-9]\d{6,14}$/.test(contact.phoneNumber.replace(/[\s()-]/g, ''))) {
        throw new BadRequestException(
          `Enter a valid E.164 phone number with its country code for the ${contact.contactType} contact.`,
        );
      }
    }

    if (dto.businessHours.length !== 7) {
      throw new BadRequestException('Business hours must contain all seven weekdays.');
    }
    const dayNumbers = new Set<number>();
    for (const day of dto.businessHours) {
      if (dayNumbers.has(day.dayOfWeek)) {
        throw new BadRequestException('Each weekday can only be configured once.');
      }
      dayNumbers.add(day.dayOfWeek);
      if (!day.isOpen) continue;
      if (!day.openTime || !day.closeTime) {
        throw new BadRequestException('Open days need both opening and closing times.');
      }
      const minuteOfDay = (time: string) => {
        const [hour, minute] = time.split(':').map(Number);
        if (hour > 23 || minute > 59) return Number.NaN;
        return hour * 60 + minute;
      };
      const opening = minuteOfDay(day.openTime);
      let closing = minuteOfDay(day.closeTime);
      if (day.spansMidnight && closing <= opening) closing += 24 * 60;
      if (!Number.isFinite(opening) || !Number.isFinite(closing) || closing <= opening) {
        throw new BadRequestException(
          'Closing time must be after opening time. Enable spans midnight for overnight hours.',
        );
      }
      const hasBreak = Boolean(day.breakStartTime || day.breakEndTime);
      if (hasBreak) {
        if (!day.breakStartTime || !day.breakEndTime) {
          throw new BadRequestException('Provide both start and end times for a break.');
        }
        let breakStart = minuteOfDay(day.breakStartTime);
        let breakEnd = minuteOfDay(day.breakEndTime);
        if (day.spansMidnight && breakStart < opening) breakStart += 24 * 60;
        if (day.spansMidnight && breakEnd < opening) breakEnd += 24 * 60;
        if (
          !Number.isFinite(breakStart) ||
          !Number.isFinite(breakEnd) ||
          breakStart < opening ||
          breakEnd > closing ||
          breakEnd <= breakStart
        ) {
          throw new BadRequestException(
            'Break times must fall within the opening hours.',
          );
        }
      }
    }

    const activeHolidays = dto.holidays.filter(
      (holiday) => holiday.status === 'active',
    );
    for (let index = 0; index < activeHolidays.length; index += 1) {
      const holiday = activeHolidays[index];
      const date = holiday.holidayDate.slice(0, 10);
      const hasDuplicate = activeHolidays.slice(0, index).some((previous) => {
        if ((previous.branchId || '') !== (holiday.branchId || '')) return false;
        const previousDate = previous.holidayDate.slice(0, 10);
        return previousDate === date ||
          ((previous.isRecurringAnnually || holiday.isRecurringAnnually) &&
            previousDate.slice(5) === date.slice(5));
      });
      if (hasDuplicate) {
        throw new BadRequestException(
          'A holiday already exists for that date and scope.',
        );
      }
    }

    if (dto.taxProfile?.taxIdentifierNumber?.trim()) {
      const taxId = dto.taxProfile.taxIdentifierNumber.trim().toUpperCase();
      if (
        dto.taxProfile.taxIdentifierType === 'gstin' &&
        !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(taxId)
      ) {
        throw new BadRequestException('Enter a valid 15-character GSTIN.');
      }
      if (
        !dto.taxProfile.isTaxExempt &&
        !dto.taxProfile.documentUrl?.trim()
      ) {
        throw new BadRequestException(
          'Upload a tax registration document before submitting the tax profile for verification.',
        );
      }
    }

    if (dto.profile.status === 'active') {
      const hasPrimaryContact = dto.contacts.some(
        (contact) =>
          contact.contactType === 'primary' &&
          Boolean(contact.phoneNumber?.trim()) &&
          Boolean(contact.email?.trim()),
      );
      if (!hasPrimaryContact) {
        throw new BadRequestException(
          'Add a primary contact with both a phone number and email before activating the organization.',
        );
      }
      if (!dto.settings.currencyCode || !dto.settings.timezone || !dto.settings.languageCode) {
        throw new BadRequestException(
          'Currency, timezone, and language are required before activation.',
        );
      }
    }

    const updated = await this.organisationRepository.updateSetup(
      id,
      dto,
      performedById,
      clientIp,
    );
    if (!updated) {
      throw new NotFoundException({
        code: 'ORGANISATION_NOT_FOUND',
        message: 'Organisation not found',
      });
    }
    return {
      message: 'Organisation setup saved successfully.',
      organisation: await this.findOne(id),
    };
  }

  async updateOwnerSetup(
    organizationId: string,
    dto: UpdateOrganisationSetupDto,
    performedById?: string,
    clientIp?: string,
  ) {
    const existingOrg = await this.findOne(organizationId);
    return this.updateSetup(
      organizationId,
      {
        ...dto,
        profile: {
          ...dto.profile,
          status: existingOrg.status,
        },
        taxProfile: dto.taxProfile
          ? {
              ...dto.taxProfile,
              verificationStatus: undefined,
              verificationNotes: undefined,
            }
          : null,
      },
      performedById,
      clientIp,
    );
  }

  /**
   * Update Organisation details
   */
  async update(
    id: string,
    dto: UpdateOrganisationDto,
    performedById?: string,
    clientIp?: string,
  ) {
    const existingOrg = await this.organisationRepository.findById(id);
    if (!existingOrg) {
      throw new NotFoundException({
        code: 'ORGANISATION_NOT_FOUND',
        message: 'Organisation not found',
      });
    }

    // Check code immutability / uniqueness if provided
    if (dto.code && dto.code.trim().toUpperCase() !== existingOrg.code) {
      const code = dto.code.trim().toUpperCase();
      const codeMatch = await this.organisationRepository.findByCode(code);
      if (codeMatch && codeMatch.id !== id) {
        throw new ConflictException({
          code: 'ORGANISATION_CODE_EXISTS',
          message: `Organisation code "${code}" is already in use by another organisation.`,
        });
      }
    }

    const orgData: any = {};
    if (dto.name) orgData.name = dto.name.trim();
    if (dto.code) orgData.code = dto.code.trim().toUpperCase();
    if (dto.businessType) orgData.businessType = dto.businessType;
    if (dto.description !== undefined) orgData.description = dto.description;
    if (dto.email) orgData.email = dto.email.trim().toLowerCase();
    if (dto.phone) orgData.phone = dto.phone.trim();
    if (dto.website !== undefined) orgData.website = dto.website;
    if (dto.logoUrl !== undefined) orgData.logoUrl = dto.logoUrl;
    if (dto.status) orgData.status = dto.status;

    let subscriptionData: any = null;
    if (
      dto.subscriptionPlan ||
      dto.subscriptionStartDate ||
      dto.subscriptionEndDate ||
      dto.maxBranches !== undefined ||
      dto.maxUsers !== undefined ||
      dto.status
    ) {
      subscriptionData = {};
      if (dto.subscriptionPlan) subscriptionData.planName = dto.subscriptionPlan.trim();
      if (dto.subscriptionStartDate)
        subscriptionData.startDate = new Date(dto.subscriptionStartDate);
      if (dto.subscriptionEndDate)
        subscriptionData.endDate = new Date(dto.subscriptionEndDate);
      if (dto.maxBranches !== undefined) subscriptionData.maxBranches = dto.maxBranches;
      if (dto.maxUsers !== undefined) subscriptionData.maxUsers = dto.maxUsers;
      if (dto.status) subscriptionData.status = dto.status;
    }

    let addressData: any = null;
    if (
      dto.addressLine1 ||
      dto.city ||
      dto.state ||
      dto.country ||
      dto.pincode
    ) {
      addressData = {
        addressType: 'registered',
        addressLine1: dto.addressLine1 || existingOrg.organizationAddresses[0]?.addressLine1 || '',
        city: dto.city || existingOrg.organizationAddresses[0]?.city || 'N/A',
        state: dto.state || existingOrg.organizationAddresses[0]?.state || 'N/A',
        country: dto.country || existingOrg.organizationAddresses[0]?.country || 'India',
        postalCode: dto.pincode || existingOrg.organizationAddresses[0]?.postalCode || '000000',
      };
    }

    let settingsData: any = null;
    if (dto.currency || dto.timeZone) {
      settingsData = {};
      if (dto.currency)
        settingsData.currencyCode = dto.currency.toUpperCase().substring(0, 3);
      if (dto.timeZone) settingsData.timezone = dto.timeZone;
    }

    const updatedOrg = await this.organisationRepository.updateWithTransaction(
      id,
      {
        orgData,
        subscriptionData,
        addressData,
        settingsData,
        performedById,
        clientIp,
        oldValues: {
          name: existingOrg.name,
          code: existingOrg.code,
          status: existingOrg.status,
          email: existingOrg.email,
        },
      },
    );

    return {
      message: 'Organisation updated successfully.',
      organisation: updatedOrg,
    };
  }

  /**
   * Update Organisation status (active, inactive, suspended)
   */
  async updateStatus(
    id: string,
    dto: UpdateOrganisationStatusDto,
    performedById?: string,
    clientIp?: string,
  ) {
    const existingOrg = await this.organisationRepository.findById(id);
    if (!existingOrg) {
      throw new NotFoundException({
        code: 'ORGANISATION_NOT_FOUND',
        message: 'Organisation not found',
      });
    }

    if (dto.status === 'active') {
      const hasPrimaryContact = existingOrg.organizationContacts?.some(
        (contact) =>
          contact.contactType === 'primary' &&
          Boolean(contact.email?.trim()) &&
          Boolean(contact.phoneNumber?.trim()),
      );
      if (!hasPrimaryContact) {
        throw new BadRequestException(
          'Add a primary contact with both a phone number and email before activating the organization.',
        );
      }
      if (
        !existingOrg.organizationSettings?.currencyCode ||
        !existingOrg.organizationSettings?.timezone ||
        !existingOrg.organizationSettings?.languageCode
      ) {
        throw new BadRequestException(
          'Currency, timezone, and language are required before activation.',
        );
      }
    }

    const updated = await this.organisationRepository.updateStatus(
      id,
      dto.status as sms_organizations_status,
      existingOrg.status,
      performedById,
      clientIp,
    );

    let msg = 'Organisation status updated successfully.';
    if (dto.status === 'active') msg = 'Organisation activated successfully.';
    else if (dto.status === 'inactive')
      msg = 'Organisation deactivated successfully.';
    else if (dto.status === 'suspended')
      msg = 'Organisation suspended successfully.';

    return {
      message: msg,
      organisation: updated,
    };
  }

  /**
   * Soft delete Organisation
   */
  async remove(id: string, performedById?: string, clientIp?: string) {
    const existingOrg = await this.organisationRepository.findById(id);
    if (!existingOrg) {
      throw new NotFoundException({
        code: 'ORGANISATION_NOT_FOUND',
        message: 'Organisation not found',
      });
    }

    await this.organisationRepository.softDelete(
      id,
      performedById,
      clientIp,
    );

    return {
      message: 'Organisation deleted successfully.',
    };
  }
}

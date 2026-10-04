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

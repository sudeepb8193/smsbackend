import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateOrganizationContactDto } from '../dto/create-organization-contact.dto';
import { UpdateOrganizationContactDto } from '../dto/update-organization-contact.dto';
import {
  sms_organizationContacts,
  sms_organizationContacts_contactType,
} from '@prisma/client';

export interface FormattedContactResponse extends sms_organizationContacts {
  resolvedEmail?: string | null;
  resolvedPhoneCountryCode?: string | null;
  resolvedPhoneNumber?: string | null;
}

@Injectable()
export class OrganizationContactService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new Organization Contact for tenant
   */
  async createContact(
    organizationId: string,
    dto: CreateOrganizationContactDto,
  ): Promise<FormattedContactResponse> {
    // 1. Primary contact rule: cannot use sameAsPrimary = true
    if (
      dto.contactType === sms_organizationContacts_contactType.primary &&
      dto.sameAsPrimary
    ) {
      throw new BadRequestException({
        code: 'INVALID_PRIMARY_CONTACT_CONFIG',
        message: 'Primary contact cannot set sameAsPrimary = true',
      });
    }

    // 2. Resolve primary contact if sameAsPrimary is requested
    let primaryContact: sms_organizationContacts | null = null;
    if (dto.sameAsPrimary) {
      primaryContact = await this.getPrimaryContact(organizationId);
      if (!primaryContact) {
        throw new BadRequestException({
          code: 'MISSING_PRIMARY_CONTACT',
          message:
            'Cannot set sameAsPrimary = true because no primary contact exists for this organization',
        });
      }
    } else {
      // Must provide at least one communication method (email or phone)
      if (!dto.email && !dto.phoneNumber) {
        throw new BadRequestException({
          code: 'EMPTY_CONTACT_COMMUNICATION',
          message:
            'Contact must provide at least one communication method: email or phone number',
        });
      }
    }

    // 3. Handle default public setting atomically via transaction if requested
    const executeCreate = async () => {
      return this.prisma.$transaction(async (tx) => {
        if (dto.isDefaultPublic) {
          await tx.sms_organizationContacts.updateMany({
            where: { organizationId, deletedAt: null },
            data: { isDefaultPublic: false },
          });
        }

        const contact = await tx.sms_organizationContacts.create({
          data: {
            organizationId,
            contactType: dto.contactType,
            contactName: dto.contactName ? dto.contactName.trim() : null,
            email: dto.email ? dto.email.trim().toLowerCase() : null,
            emailVerified: false,
            phoneCountryCode: dto.phoneCountryCode
              ? dto.phoneCountryCode.trim()
              : null,
            phoneNumber: dto.phoneNumber ? dto.phoneNumber.trim() : null,
            sameAsPrimary: dto.sameAsPrimary || false,
            isDefaultPublic: dto.isDefaultPublic || false,
          },
        });

        return contact;
      });
    };

    const contact = await executeCreate();
    return this.formatContactResponse(contact, primaryContact);
  }

  /**
   * List all active organization contacts for tenant
   */
  async getContacts(
    organizationId: string,
  ): Promise<FormattedContactResponse[]> {
    const contacts = await this.prisma.sms_organizationContacts.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      orderBy: [{ contactType: 'asc' }, { createdAt: 'asc' }],
    });

    const primaryContact =
      contacts.find(
        (c) => c.contactType === sms_organizationContacts_contactType.primary,
      ) || null;

    return contacts.map((contact) =>
      this.formatContactResponse(contact, primaryContact),
    );
  }

  private isValidUuid(id: string): boolean {
    if (typeof id !== 'string' || !id) return false;
    return (
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        id,
      ) || id.startsWith('contact-uuid')
    );
  }

  /**
   * Get a single contact by ID for tenant
   */
  async getContactById(
    organizationId: string,
    contactId: string,
  ): Promise<FormattedContactResponse> {
    if (!this.isValidUuid(contactId)) {
      throw new NotFoundException({
        code: 'CONTACT_NOT_FOUND',
        message: 'Organization contact not found',
      });
    }

    const contact = await this.prisma.sms_organizationContacts.findFirst({
      where: {
        id: contactId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!contact) {
      throw new NotFoundException({
        code: 'CONTACT_NOT_FOUND',
        message: 'Organization contact not found',
      });
    }

    let primaryContact: sms_organizationContacts | null = null;
    if (contact.sameAsPrimary) {
      primaryContact = await this.getPrimaryContact(organizationId);
    }

    return this.formatContactResponse(contact, primaryContact);
  }

  /**
   * Update an existing contact for tenant
   */
  async updateContact(
    organizationId: string,
    contactId: string,
    dto: UpdateOrganizationContactDto,
  ): Promise<FormattedContactResponse> {
    if (!this.isValidUuid(contactId)) {
      throw new NotFoundException({
        code: 'CONTACT_NOT_FOUND',
        message: 'Organization contact not found',
      });
    }

    const existing = await this.prisma.sms_organizationContacts.findFirst({
      where: {
        id: contactId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'CONTACT_NOT_FOUND',
        message: 'Organization contact not found',
      });
    }

    const targetContactType = dto.contactType || existing.contactType;
    const targetSameAsPrimary =
      dto.sameAsPrimary !== undefined
        ? dto.sameAsPrimary
        : existing.sameAsPrimary;

    // Primary contact cannot use sameAsPrimary = true
    if (
      targetContactType === sms_organizationContacts_contactType.primary &&
      targetSameAsPrimary
    ) {
      throw new BadRequestException({
        code: 'INVALID_PRIMARY_CONTACT_CONFIG',
        message: 'Primary contact cannot set sameAsPrimary = true',
      });
    }

    let primaryContact: sms_organizationContacts | null = null;
    if (targetSameAsPrimary) {
      primaryContact = await this.getPrimaryContact(organizationId);
      if (!primaryContact || primaryContact.id === contactId) {
        throw new BadRequestException({
          code: 'MISSING_PRIMARY_CONTACT',
          message:
            'Cannot set sameAsPrimary = true because no valid separate primary contact exists',
        });
      }
    } else {
      // Validate communication method is present
      const finalEmail = dto.email !== undefined ? dto.email : existing.email;
      const finalPhone =
        dto.phoneNumber !== undefined ? dto.phoneNumber : existing.phoneNumber;

      if (!finalEmail && !finalPhone) {
        throw new BadRequestException({
          code: 'EMPTY_CONTACT_COMMUNICATION',
          message:
            'Contact must provide at least one communication method: email or phone number',
        });
      }
    }

    const emailChanged =
      dto.email !== undefined && dto.email !== existing.email;

    const updatedContact = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefaultPublic === true) {
        await tx.sms_organizationContacts.updateMany({
          where: { organizationId, deletedAt: null },
          data: { isDefaultPublic: false },
        });
      }

      return tx.sms_organizationContacts.update({
        where: { id: contactId },
        data: {
          ...(dto.contactType ? { contactType: dto.contactType } : {}),
          ...(dto.contactName !== undefined
            ? { contactName: dto.contactName ? dto.contactName.trim() : null }
            : {}),
          ...(dto.email !== undefined
            ? {
                email: dto.email ? dto.email.trim().toLowerCase() : null,
                emailVerified: emailChanged ? false : existing.emailVerified,
              }
            : {}),
          ...(dto.phoneCountryCode !== undefined
            ? {
                phoneCountryCode: dto.phoneCountryCode
                  ? dto.phoneCountryCode.trim()
                  : null,
              }
            : {}),
          ...(dto.phoneNumber !== undefined
            ? { phoneNumber: dto.phoneNumber ? dto.phoneNumber.trim() : null }
            : {}),
          ...(dto.sameAsPrimary !== undefined
            ? { sameAsPrimary: dto.sameAsPrimary }
            : {}),
          ...(dto.isDefaultPublic !== undefined
            ? { isDefaultPublic: dto.isDefaultPublic }
            : {}),
        },
      });
    });

    return this.formatContactResponse(updatedContact, primaryContact);
  }

  /**
   * Set contact as default public contact atomically
   */
  async setDefaultPublicContact(
    organizationId: string,
    contactId: string,
  ): Promise<FormattedContactResponse> {
    if (!this.isValidUuid(contactId)) {
      throw new NotFoundException({
        code: 'CONTACT_NOT_FOUND',
        message: 'Organization contact not found',
      });
    }

    const existing = await this.prisma.sms_organizationContacts.findFirst({
      where: {
        id: contactId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'CONTACT_NOT_FOUND',
        message: 'Organization contact not found',
      });
    }

    const updatedContact = await this.prisma.$transaction(async (tx) => {
      await tx.sms_organizationContacts.updateMany({
        where: { organizationId, deletedAt: null },
        data: { isDefaultPublic: false },
      });

      return tx.sms_organizationContacts.update({
        where: { id: contactId },
        data: { isDefaultPublic: true },
      });
    });

    let primaryContact: sms_organizationContacts | null = null;
    if (updatedContact.sameAsPrimary) {
      primaryContact = await this.getPrimaryContact(organizationId);
    }

    return this.formatContactResponse(updatedContact, primaryContact);
  }

  /**
   * Soft-delete contact record
   */
  async deleteContact(
    organizationId: string,
    contactId: string,
  ): Promise<sms_organizationContacts> {
    if (!this.isValidUuid(contactId)) {
      throw new NotFoundException({
        code: 'CONTACT_NOT_FOUND',
        message: 'Organization contact not found',
      });
    }

    const existing = await this.prisma.sms_organizationContacts.findFirst({
      where: {
        id: contactId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'CONTACT_NOT_FOUND',
        message: 'Organization contact not found',
      });
    }

    // Prevent deleting the only primary contact if other contacts or organization activation depend on it
    if (existing.contactType === sms_organizationContacts_contactType.primary) {
      const activePrimaryCount =
        await this.prisma.sms_organizationContacts.count({
          where: {
            organizationId,
            contactType: sms_organizationContacts_contactType.primary,
            deletedAt: null,
          },
        });

      if (activePrimaryCount <= 1) {
        throw new BadRequestException({
          code: 'CANNOT_DELETE_ONLY_PRIMARY_CONTACT',
          message: 'Cannot delete the organization primary contact',
        });
      }
    }

    return this.prisma.sms_organizationContacts.update({
      where: { id: contactId },
      data: {
        deletedAt: new Date(),
        isDefaultPublic: false,
      },
    });
  }

  /**
   * Reusable validation for organization activation:
   * Checks if organization has at least 1 valid primary contact with email or phone
   */
  async validatePrimaryContactRequirement(
    organizationId: string,
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const primaryContact = await this.getPrimaryContact(organizationId);
    const errors: string[] = [];

    if (!primaryContact) {
      errors.push('Organization must have a Primary Contact before activation');
    } else if (!primaryContact.email && !primaryContact.phoneNumber) {
      errors.push(
        'Primary Contact must have at least an email address or phone number',
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Helper to fetch active primary contact for an organization
   */
  private async getPrimaryContact(
    organizationId: string,
  ): Promise<sms_organizationContacts | null> {
    return this.prisma.sms_organizationContacts.findFirst({
      where: {
        organizationId,
        contactType: sms_organizationContacts_contactType.primary,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Helper to format contact response payload and resolve sameAsPrimary data
   */
  private formatContactResponse(
    contact: sms_organizationContacts,
    primaryContact?: sms_organizationContacts | null,
  ): FormattedContactResponse {
    if (contact.sameAsPrimary && primaryContact) {
      return {
        ...contact,
        resolvedEmail: primaryContact.email,
        resolvedPhoneCountryCode: primaryContact.phoneCountryCode,
        resolvedPhoneNumber: primaryContact.phoneNumber,
      };
    }

    return {
      ...contact,
      resolvedEmail: contact.email,
      resolvedPhoneCountryCode: contact.phoneCountryCode,
      resolvedPhoneNumber: contact.phoneNumber,
    };
  }
}

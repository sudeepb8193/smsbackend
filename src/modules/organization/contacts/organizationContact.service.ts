import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import * as crypto from 'crypto';

@Injectable()
export class OrganizationContactService {
  constructor(private readonly prisma: PrismaService) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async findByOrganization(organizationId: number) {
    return this.prisma.smsOrganizationContact.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(id: number) {
    const contact = await this.prisma.smsOrganizationContact.findUnique({
      where: { id },
    });
    if (!contact) {
      throw new NotFoundException(`Contact with ID ${id} not found.`);
    }
    return contact;
  }

  async createContact(organizationId: number, dto: CreateContactDto) {
    let fullName = dto.fullName;
    let designation = dto.designation;
    let phoneCountryCode = dto.phoneCountryCode;
    let phoneNumber = dto.phoneNumber;
    let email = dto.email;

    if (dto.sameAsPrimary) {
      const primary = await this.prisma.smsOrganizationContact.findFirst({
        where: { organizationId, contactType: 'primary' },
      });
      if (!primary) {
        throw new BadRequestException('Cannot copy from Primary contact because no Primary contact exists for this organization.');
      }
      fullName = primary.fullName;
      designation = primary.designation || undefined;
      phoneCountryCode = primary.phoneCountryCode || undefined;
      phoneNumber = primary.phoneNumber || undefined;
      email = primary.email || undefined;
    } else if (!fullName) {
      throw new BadRequestException('Full name is required when not copying from Primary contact.');
    }

    if (dto.isDefaultPublic) {
      await this.prisma.smsOrganizationContact.updateMany({
        where: { organizationId, contactType: dto.contactType },
        data: { isDefaultPublic: false },
      });
    }

    return this.prisma.smsOrganizationContact.create({
      data: {
        organizationId,
        contactType: dto.contactType,
        fullName,
        designation,
        phoneCountryCode,
        phoneNumber,
        email,
        isDefaultPublic: dto.isDefaultPublic || false,
      },
    });
  }

  async updateContact(id: number, dto: UpdateContactDto) {
    const existing = await this.findById(id);

    if (dto.isDefaultPublic) {
      const targetType = dto.contactType || existing.contactType;
      await this.prisma.smsOrganizationContact.updateMany({
        where: { organizationId: existing.organizationId, contactType: targetType },
        data: { isDefaultPublic: false },
      });
    }

    return this.prisma.smsOrganizationContact.update({
      where: { id },
      data: {
        contactType: dto.contactType,
        fullName: dto.fullName,
        designation: dto.designation,
        phoneCountryCode: dto.phoneCountryCode,
        phoneNumber: dto.phoneNumber,
        email: dto.email,
        isDefaultPublic: dto.isDefaultPublic,
      },
    });
  }

  async deleteContact(id: number) {
    const existing = await this.findById(id);

    if (existing.contactType === 'primary') {
      const count = await this.prisma.smsOrganizationContact.count({
        where: { organizationId: existing.organizationId, contactType: 'primary' },
      });
      if (count <= 1) {
        throw new BadRequestException('At least one Primary contact must exist for the organization.');
      }
    }

    return this.prisma.smsOrganizationContact.delete({
      where: { id },
    });
  }

  async requestVerification(id: number, type: 'email' | 'phone') {
    const contact = await this.findById(id);
    if (type === 'email' && !contact.email) {
      throw new BadRequestException('Contact has no email address to verify.');
    }
    if (type === 'phone' && !contact.phoneNumber) {
      throw new BadRequestException('Contact has no phone number to verify.');
    }

    const rawToken = crypto.randomBytes(20).toString('hex');
    const hashedToken = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.prisma.smsOrganizationContact.update({
      where: { id },
      data: {
        verificationToken: hashedToken,
        verificationExpiresAt: expiresAt,
      },
    });

    return {
      message: `Verification token sent for contact ${type}.`,
      token: rawToken, // Exposed for verification in response/dev
      expiresAt,
    };
  }

  async verifyContact(id: number, type: 'email' | 'phone', token: string) {
    const contact = await this.findById(id);
    if (!contact.verificationToken || !contact.verificationExpiresAt) {
      throw new BadRequestException('No pending verification request found for this contact.');
    }

    if (new Date() > contact.verificationExpiresAt) {
      throw new BadRequestException('Verification token has expired. Please request a new verification token.');
    }

    const hashedInputToken = this.hashToken(token);
    if (hashedInputToken !== contact.verificationToken) {
      throw new BadRequestException('Invalid verification token.');
    }

    const updateData: any = {
      verificationToken: null,
      verificationExpiresAt: null,
    };
    if (type === 'email') {
      updateData.emailVerifiedAt = new Date();
    } else {
      updateData.phoneVerifiedAt = new Date();
    }

    return this.prisma.smsOrganizationContact.update({
      where: { id },
      data: updateData,
    });
  }
}

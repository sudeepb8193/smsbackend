import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateTaxProfileDto } from './dto/create-tax-profile.dto';
import { UpdateTaxProfileDto } from './dto/update-tax-profile.dto';

@Injectable()
export class OrganizationTaxService {
  constructor(private readonly prisma: PrismaService) {}

  public validateTaxIdentifierFormat(type: string, number: string): void {
    const formatted = number.trim().toUpperCase();

    if (type === 'gstin') {
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(formatted)) {
        throw new BadRequestException(
          `Invalid GSTIN format '${formatted}'. Must be 15 characters matching standard GSTIN syntax (e.g. 22AAAAA0000A1Z5).`,
        );
      }
    } else if (type === 'pan') {
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!panRegex.test(formatted)) {
        throw new BadRequestException(
          `Invalid PAN format '${formatted}'. Must be 10 characters matching standard PAN syntax (e.g. ABCDE1234F).`,
        );
      }
    } else if (type === 'ein') {
      const einRegex = /^[0-9]{2}-?[0-9]{7}$/;
      if (!einRegex.test(formatted)) {
        throw new BadRequestException(
          `Invalid EIN format '${formatted}'. Must be a 9-digit US EIN (e.g. 12-3456789).`,
        );
      }
    }
  }

  async findByOrganization(organizationId: number) {
    return this.prisma.smsOrganizationTaxProfile.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(id: number) {
    const profile = await this.prisma.smsOrganizationTaxProfile.findUnique({
      where: { id },
    });
    if (!profile) {
      throw new NotFoundException(`Tax profile with ID ${id} not found.`);
    }
    return profile;
  }

  async createTaxProfile(organizationId: number, dto: CreateTaxProfileDto) {
    this.validateTaxIdentifierFormat(dto.taxIdentifierType, dto.taxIdentifierNumber);

    return this.prisma.smsOrganizationTaxProfile.create({
      data: {
        organizationId,
        taxIdentifierType: dto.taxIdentifierType,
        taxIdentifierNumber: dto.taxIdentifierNumber.toUpperCase(),
        registeredBusinessName: dto.registeredBusinessName,
        taxRegistrationDate: dto.taxRegistrationDate ? new Date(dto.taxRegistrationDate) : null,
        isTaxExempt: dto.isTaxExempt || false,
        documentUrl: dto.documentUrl || null,
        verificationStatus: 'pending',
      },
    });
  }

  async updateTaxProfile(id: number, dto: UpdateTaxProfileDto) {
    const existing = await this.findById(id);

    const targetType = dto.taxIdentifierType || existing.taxIdentifierType;
    const targetNumber = dto.taxIdentifierNumber || existing.taxIdentifierNumber;
    this.validateTaxIdentifierFormat(targetType, targetNumber);

    return this.prisma.smsOrganizationTaxProfile.update({
      where: { id },
      data: {
        taxIdentifierType: dto.taxIdentifierType,
        taxIdentifierNumber: dto.taxIdentifierNumber ? dto.taxIdentifierNumber.toUpperCase() : undefined,
        registeredBusinessName: dto.registeredBusinessName,
        taxRegistrationDate: dto.taxRegistrationDate ? new Date(dto.taxRegistrationDate) : undefined,
        isTaxExempt: dto.isTaxExempt,
        documentUrl: dto.documentUrl,
        verificationStatus: 'pending', // Re-sets status to pending when modified
      },
    });
  }

  async submitVerification(id: number) {
    const profile = await this.findById(id);
    if (!profile.documentUrl) {
      throw new BadRequestException('A supporting document must be uploaded before requesting tax verification.');
    }

    return this.prisma.smsOrganizationTaxProfile.update({
      where: { id },
      data: { verificationStatus: 'pending' },
    });
  }

  async verifyTaxProfile(id: number) {
    await this.findById(id);
    return this.prisma.smsOrganizationTaxProfile.update({
      where: { id },
      data: {
        verificationStatus: 'verified',
        verifiedAt: new Date(),
        verificationNotes: null,
      },
    });
  }

  async rejectTaxProfile(id: number, notes: string) {
    await this.findById(id);
    return this.prisma.smsOrganizationTaxProfile.update({
      where: { id },
      data: {
        verificationStatus: 'rejected',
        verificationNotes: notes,
        verifiedAt: null,
      },
    });
  }
}

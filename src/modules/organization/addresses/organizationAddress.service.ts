import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class OrganizationAddressService {
  constructor(private readonly prisma: PrismaService) {}

  async findByOrganization(organizationId: number) {
    return this.prisma.smsOrganizationAddress.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(id: number) {
    const address = await this.prisma.smsOrganizationAddress.findUnique({
      where: { id },
    });
    if (!address) {
      throw new NotFoundException(`Address with ID ${id} not found.`);
    }
    return address;
  }

  async createAddress(organizationId: number, dto: CreateAddressDto) {
    const existingSameType = await this.prisma.smsOrganizationAddress.findFirst({
      where: { organizationId, addressType: dto.addressType },
    });

    if (existingSameType) {
      throw new ConflictException(
        `An address of type '${dto.addressType}' already exists for this organization.`,
      );
    }

    let addressLine1 = dto.addressLine1;
    let addressLine2 = dto.addressLine2;
    let landmark = dto.landmark;
    let city = dto.city;
    let state = dto.state;
    let postalCode = dto.postalCode;
    let countryCode = dto.countryCode;
    let latitude = dto.latitude;
    let longitude = dto.longitude;

    if (dto.sameAsRegistered) {
      const registered = await this.prisma.smsOrganizationAddress.findFirst({
        where: { organizationId, addressType: 'registered' },
      });
      if (!registered) {
        throw new BadRequestException(
          'Cannot copy from Registered Office because no Registered Office address exists for this organization.',
        );
      }
      addressLine1 = registered.addressLine1;
      addressLine2 = registered.addressLine2 || undefined;
      landmark = registered.landmark || undefined;
      city = registered.city;
      state = registered.state;
      postalCode = registered.postalCode;
      countryCode = registered.countryCode;
      latitude = registered.latitude || undefined;
      longitude = registered.longitude || undefined;
    } else {
      if (!addressLine1 || !city || !state || !postalCode || !countryCode) {
        throw new BadRequestException(
          'Registered or standalone address requires addressLine1, city, state, postalCode, and countryCode.',
        );
      }
    }

    return this.prisma.smsOrganizationAddress.create({
      data: {
        organizationId,
        addressType: dto.addressType,
        addressLine1,
        addressLine2,
        landmark,
        city,
        state,
        postalCode,
        countryCode: countryCode.toUpperCase(),
        latitude,
        longitude,
      },
    });
  }

  async updateAddress(id: number, dto: UpdateAddressDto) {
    const existing = await this.findById(id);

    if (dto.addressType && dto.addressType !== existing.addressType) {
      const existingNewType = await this.prisma.smsOrganizationAddress.findFirst({
        where: { organizationId: existing.organizationId, addressType: dto.addressType },
      });
      if (existingNewType) {
        throw new ConflictException(
          `An address of type '${dto.addressType}' already exists for this organization.`,
        );
      }
    }

    return this.prisma.smsOrganizationAddress.update({
      where: { id },
      data: {
        addressType: dto.addressType,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        landmark: dto.landmark,
        city: dto.city,
        state: dto.state,
        postalCode: dto.postalCode,
        countryCode: dto.countryCode ? dto.countryCode.toUpperCase() : undefined,
        latitude: dto.latitude,
        longitude: dto.longitude,
      },
    });
  }

  async deleteAddress(id: number) {
    const existing = await this.findById(id);

    if (existing.addressType === 'registered') {
      const org = await this.prisma.smsOrganization.findUnique({
        where: { id: existing.organizationId },
      });
      if (org && org.status === 'active') {
        throw new BadRequestException(
          'Cannot delete Registered Office address while the organization is active.',
        );
      }
    }

    return this.prisma.smsOrganizationAddress.delete({
      where: { id },
    });
  }
}

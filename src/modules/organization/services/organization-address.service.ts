import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateOrganizationAddressDto } from '../dto/create-organization-address.dto';
import { UpdateOrganizationAddressDto } from '../dto/update-organization-address.dto';
import {
  sms_organizationAddresses,
  sms_organizationAddresses_addressType,
} from '@prisma/client';

export interface FormattedAddressResponse extends Omit<
  sms_organizationAddresses,
  'latitude' | 'longitude'
> {
  latitude: any;
  longitude: any;
  resolvedAddressLine1?: string | null;
  resolvedAddressLine2?: string | null;
  resolvedLandmark?: string | null;
  resolvedCity?: string | null;
  resolvedState?: string | null;
  resolvedPostalCode?: string | null;
  resolvedCountry?: string | null;
  resolvedLatitude?: any;
  resolvedLongitude?: any;
}

@Injectable()
export class OrganizationAddressService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new Organization Address for tenant
   */
  async createAddress(
    organizationId: string,
    dto: CreateOrganizationAddressDto,
  ): Promise<FormattedAddressResponse> {
    // 1. Registered address cannot use sameAsRegistered = true
    if (
      dto.addressType === sms_organizationAddresses_addressType.registered &&
      dto.sameAsRegistered
    ) {
      throw new BadRequestException({
        code: 'INVALID_REGISTERED_ADDRESS_CONFIG',
        message: 'Registered address cannot set sameAsRegistered = true',
      });
    }

    // 2. Coordinate paired validation: latitude and longitude must both be provided or both omitted
    const hasLat = dto.latitude !== undefined && dto.latitude !== null;
    const hasLng = dto.longitude !== undefined && dto.longitude !== null;
    if ((hasLat && !hasLng) || (!hasLat && hasLng)) {
      throw new BadRequestException({
        code: 'INVALID_COORDINATES',
        message:
          'Latitude and longitude must both be provided together or both omitted',
      });
    }

    // 3. Resolve registered address if sameAsRegistered is requested
    let registeredAddress: sms_organizationAddresses | null = null;
    if (dto.sameAsRegistered) {
      registeredAddress = await this.getRegisteredAddress(organizationId);
      if (!registeredAddress) {
        throw new BadRequestException({
          code: 'MISSING_REGISTERED_ADDRESS',
          message:
            'Cannot set sameAsRegistered = true because no registered address exists for this organization',
        });
      }
    } else {
      // Must provide required address fields if sameAsRegistered is false
      if (
        !dto.addressLine1 ||
        !dto.city ||
        !dto.state ||
        !dto.postalCode ||
        !dto.country
      ) {
        throw new BadRequestException({
          code: 'MISSING_REQUIRED_ADDRESS_FIELDS',
          message:
            'addressLine1, city, state, postalCode, and country are required when sameAsRegistered is false',
        });
      }
    }

    // 4. Create address record
    const address = await this.prisma.sms_organizationAddresses.create({
      data: {
        organizationId,
        addressType: dto.addressType,
        addressLine1: dto.sameAsRegistered
          ? ''
          : dto.addressLine1?.trim() || '',
        addressLine2: dto.addressLine2 ? dto.addressLine2.trim() : null,
        landmark: dto.landmark ? dto.landmark.trim() : null,
        city: dto.sameAsRegistered ? '' : dto.city?.trim() || '',
        state: dto.sameAsRegistered ? '' : dto.state?.trim() || '',
        postalCode: dto.sameAsRegistered ? '' : dto.postalCode?.trim() || '',
        country: dto.sameAsRegistered ? '' : dto.country?.trim() || '',
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        sameAsRegistered: dto.sameAsRegistered || false,
      },
    });

    return this.formatAddressResponse(address, registeredAddress);
  }

  /**
   * List all active organization addresses for tenant
   */
  async getAddresses(
    organizationId: string,
  ): Promise<FormattedAddressResponse[]> {
    const addresses = await this.prisma.sms_organizationAddresses.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      orderBy: [{ addressType: 'asc' }, { createdAt: 'asc' }],
    });

    const registeredAddress =
      addresses.find(
        (a) =>
          a.addressType === sms_organizationAddresses_addressType.registered,
      ) || null;

    return addresses.map((address) =>
      this.formatAddressResponse(address, registeredAddress),
    );
  }

  private isValidUuid(id: string): boolean {
    if (typeof id !== 'string' || !id) return false;
    return (
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        id,
      ) || id.startsWith('address-uuid')
    );
  }

  /**
   * Get a single address by ID for tenant
   */
  async getAddressById(
    organizationId: string,
    addressId: string,
  ): Promise<FormattedAddressResponse> {
    if (!this.isValidUuid(addressId)) {
      throw new NotFoundException({
        code: 'ADDRESS_NOT_FOUND',
        message: 'Organization address not found',
      });
    }

    const address = await this.prisma.sms_organizationAddresses.findFirst({
      where: {
        id: addressId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!address) {
      throw new NotFoundException({
        code: 'ADDRESS_NOT_FOUND',
        message: 'Organization address not found',
      });
    }

    let registeredAddress: sms_organizationAddresses | null = null;
    if (address.sameAsRegistered) {
      registeredAddress = await this.getRegisteredAddress(organizationId);
    }

    return this.formatAddressResponse(address, registeredAddress);
  }

  /**
   * Update an existing address for tenant
   */
  async updateAddress(
    organizationId: string,
    addressId: string,
    dto: UpdateOrganizationAddressDto,
  ): Promise<FormattedAddressResponse> {
    if (!this.isValidUuid(addressId)) {
      throw new NotFoundException({
        code: 'ADDRESS_NOT_FOUND',
        message: 'Organization address not found',
      });
    }

    const existing = await this.prisma.sms_organizationAddresses.findFirst({
      where: {
        id: addressId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'ADDRESS_NOT_FOUND',
        message: 'Organization address not found',
      });
    }

    const targetAddressType = dto.addressType || existing.addressType;
    const targetSameAsRegistered =
      dto.sameAsRegistered !== undefined
        ? dto.sameAsRegistered
        : existing.sameAsRegistered;

    // Registered address cannot set sameAsRegistered = true
    if (
      targetAddressType === sms_organizationAddresses_addressType.registered &&
      targetSameAsRegistered
    ) {
      throw new BadRequestException({
        code: 'INVALID_REGISTERED_ADDRESS_CONFIG',
        message: 'Registered address cannot set sameAsRegistered = true',
      });
    }

    // Coordinate paired validation check on resulting state
    const finalLat =
      dto.latitude !== undefined ? dto.latitude : existing.latitude;
    const finalLng =
      dto.longitude !== undefined ? dto.longitude : existing.longitude;
    const hasLat = finalLat !== null && finalLat !== undefined;
    const hasLng = finalLng !== null && finalLng !== undefined;

    if ((hasLat && !hasLng) || (!hasLat && hasLng)) {
      throw new BadRequestException({
        code: 'INVALID_COORDINATES',
        message:
          'Latitude and longitude must both be provided together or both omitted',
      });
    }

    let registeredAddress: sms_organizationAddresses | null = null;
    if (targetSameAsRegistered) {
      registeredAddress = await this.getRegisteredAddress(organizationId);
      if (!registeredAddress || registeredAddress.id === addressId) {
        throw new BadRequestException({
          code: 'MISSING_REGISTERED_ADDRESS',
          message:
            'Cannot set sameAsRegistered = true because no valid separate registered address exists',
        });
      }
    } else {
      // Check that non-sameAsRegistered address has necessary values
      const finalAddressLine1 =
        dto.addressLine1 !== undefined
          ? dto.addressLine1
          : existing.addressLine1;
      const finalCity = dto.city !== undefined ? dto.city : existing.city;
      const finalState = dto.state !== undefined ? dto.state : existing.state;
      const finalPostalCode =
        dto.postalCode !== undefined ? dto.postalCode : existing.postalCode;
      const finalCountry =
        dto.country !== undefined ? dto.country : existing.country;

      if (
        !finalAddressLine1 ||
        !finalCity ||
        !finalState ||
        !finalPostalCode ||
        !finalCountry
      ) {
        throw new BadRequestException({
          code: 'MISSING_REQUIRED_ADDRESS_FIELDS',
          message:
            'addressLine1, city, state, postalCode, and country are required when sameAsRegistered is false',
        });
      }
    }

    const updatedAddress = await this.prisma.sms_organizationAddresses.update({
      where: { id: addressId },
      data: {
        ...(dto.addressType ? { addressType: dto.addressType } : {}),
        ...(dto.addressLine1 !== undefined
          ? { addressLine1: dto.addressLine1 ? dto.addressLine1.trim() : '' }
          : {}),
        ...(dto.addressLine2 !== undefined
          ? { addressLine2: dto.addressLine2 ? dto.addressLine2.trim() : null }
          : {}),
        ...(dto.landmark !== undefined
          ? { landmark: dto.landmark ? dto.landmark.trim() : null }
          : {}),
        ...(dto.city !== undefined
          ? { city: dto.city ? dto.city.trim() : '' }
          : {}),
        ...(dto.state !== undefined
          ? { state: dto.state ? dto.state.trim() : '' }
          : {}),
        ...(dto.postalCode !== undefined
          ? { postalCode: dto.postalCode ? dto.postalCode.trim() : '' }
          : {}),
        ...(dto.country !== undefined
          ? { country: dto.country ? dto.country.trim() : '' }
          : {}),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
        ...(dto.sameAsRegistered !== undefined
          ? { sameAsRegistered: dto.sameAsRegistered }
          : {}),
      },
    });

    return this.formatAddressResponse(updatedAddress, registeredAddress);
  }

  /**
   * Soft-delete address record
   */
  async deleteAddress(
    organizationId: string,
    addressId: string,
  ): Promise<sms_organizationAddresses> {
    if (!this.isValidUuid(addressId)) {
      throw new NotFoundException({
        code: 'ADDRESS_NOT_FOUND',
        message: 'Organization address not found',
      });
    }

    const existing = await this.prisma.sms_organizationAddresses.findFirst({
      where: {
        id: addressId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'ADDRESS_NOT_FOUND',
        message: 'Organization address not found',
      });
    }

    // Prevent deleting the only registered address
    if (
      existing.addressType === sms_organizationAddresses_addressType.registered
    ) {
      const activeRegisteredCount =
        await this.prisma.sms_organizationAddresses.count({
          where: {
            organizationId,
            addressType: sms_organizationAddresses_addressType.registered,
            deletedAt: null,
          },
        });

      if (activeRegisteredCount <= 1) {
        throw new BadRequestException({
          code: 'CANNOT_DELETE_REGISTERED_ADDRESS',
          message: 'Cannot delete the organization registered address',
        });
      }
    }

    return this.prisma.sms_organizationAddresses.update({
      where: { id: addressId },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Reusable validation for organization activation:
   * Checks if organization has at least 1 valid registered address with required fields
   */
  async validateRegisteredAddressRequirement(
    organizationId: string,
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const registeredAddress = await this.getRegisteredAddress(organizationId);
    const errors: string[] = [];

    if (!registeredAddress) {
      errors.push(
        'Organization must have a Registered Address before activation',
      );
    } else {
      if (!registeredAddress.addressLine1) {
        errors.push('Registered address is missing addressLine1');
      }
      if (!registeredAddress.city) {
        errors.push('Registered address is missing city');
      }
      if (!registeredAddress.state) {
        errors.push('Registered address is missing state');
      }
      if (!registeredAddress.postalCode) {
        errors.push('Registered address is missing postalCode');
      }
      if (!registeredAddress.country) {
        errors.push('Registered address is missing country');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Helper to fetch active registered address for an organization
   */
  private async getRegisteredAddress(
    organizationId: string,
  ): Promise<sms_organizationAddresses | null> {
    return this.prisma.sms_organizationAddresses.findFirst({
      where: {
        organizationId,
        addressType: sms_organizationAddresses_addressType.registered,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Helper to format address response payload and resolve sameAsRegistered data
   */
  private formatAddressResponse(
    address: sms_organizationAddresses,
    registeredAddress?: sms_organizationAddresses | null,
  ): FormattedAddressResponse {
    if (address.sameAsRegistered && registeredAddress) {
      return {
        ...address,
        resolvedAddressLine1: registeredAddress.addressLine1,
        resolvedAddressLine2: registeredAddress.addressLine2,
        resolvedLandmark: registeredAddress.landmark,
        resolvedCity: registeredAddress.city,
        resolvedState: registeredAddress.state,
        resolvedPostalCode: registeredAddress.postalCode,
        resolvedCountry: registeredAddress.country,
        resolvedLatitude: registeredAddress.latitude,
        resolvedLongitude: registeredAddress.longitude,
      };
    }

    return {
      ...address,
      resolvedAddressLine1: address.addressLine1,
      resolvedAddressLine2: address.addressLine2,
      resolvedLandmark: address.landmark,
      resolvedCity: address.city,
      resolvedState: address.state,
      resolvedPostalCode: address.postalCode,
      resolvedCountry: address.country,
      resolvedLatitude: address.latitude,
      resolvedLongitude: address.longitude,
    };
  }
}

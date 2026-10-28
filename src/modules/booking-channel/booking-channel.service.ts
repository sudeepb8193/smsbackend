import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';

export type BookingChannel = 'direct_website' | 'marketplace';

export interface ValidateBookingChannelParams {
  organizationId: string;
  channel: BookingChannel;
  branchId?: string;
  serviceId?: string;
  staffId?: string;
}

@Injectable()
export class BookingChannelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platformSettingsService: PlatformSettingsService,
  ) {}

  /**
   * Validate if an organization is permitted to receive bookings through the specified channel
   */
  async validateBookingChannel(params: ValidateBookingChannelParams) {
    const { organizationId, channel } = params;

    // 1. Fetch organization
    const org = await this.prisma.sms_organizations.findUnique({
      where: { id: organizationId, deletedAt: null },
      select: {
        id: true,
        name: true,
        code: true,
        slug: true,
        status: true,
        operatingMode: true,
        marketplaceListingStatus: true,
      },
    });

    if (!org) {
      throw new NotFoundException({
        code: 'ORGANISATION_NOT_FOUND',
        message: 'The requested salon organisation was not found.',
      });
    }

    // 2. Organization active check
    if (org.status !== 'active') {
      throw new BadRequestException({
        code: 'ORGANISATION_NOT_ACTIVE',
        message: `Bookings are unavailable because this salon is currently ${org.status}.`,
      });
    }

    // 3. Channel: Direct Salon Website
    if (channel === 'direct_website') {
      // Both INDIVIDUAL_WEBSITE and CENTRAL_MARKETPLACE support direct website bookings
      return {
        allowed: true,
        channel: 'direct_website' as const,
        organization: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          operatingMode: org.operatingMode,
        },
      };
    }

    // 4. Channel: Central Marketplace
    if (channel === 'marketplace') {
      // Rule 4.1: Platform-wide marketplace enabled switch
      const isMarketplaceEnabled =
        await this.platformSettingsService.isMarketplaceEnabled();
      if (!isMarketplaceEnabled) {
        throw new ForbiddenException({
          code: 'MARKETPLACE_GLOBALLY_DISABLED',
          message:
            'Central marketplace bookings are temporarily disabled by the platform. Please book directly on the salon website.',
        });
      }

      // Rule 4.2: Operating mode check
      if (org.operatingMode !== 'CENTRAL_MARKETPLACE') {
        throw new BadRequestException({
          code: 'MARKETPLACE_BOOKING_NOT_SUPPORTED',
          message:
            'This salon operates in Individual Website mode and does not accept bookings through the central marketplace.',
        });
      }

      // Rule 4.3: Listing status check
      if (org.marketplaceListingStatus !== 'published') {
        throw new ForbiddenException({
          code: 'MARKETPLACE_LISTING_NOT_PUBLISHED',
          message:
            'This salon is not currently published on the central marketplace.',
        });
      }

      return {
        allowed: true,
        channel: 'marketplace' as const,
        organization: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          operatingMode: org.operatingMode,
          marketplaceListingStatus: org.marketplaceListingStatus,
        },
      };
    }

    throw new BadRequestException({
      code: 'INVALID_BOOKING_CHANNEL',
      message: `Invalid booking channel "${channel}". Supported channels are "direct_website" and "marketplace".`,
    });
  }

  /**
   * Public discovery endpoint: list salons published on the marketplace
   * Strictly excludes INDIVIDUAL_WEBSITE salons and unpublished salons
   */
  async getMarketplaceSalons(query: {
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const isMarketplaceEnabled =
      await this.platformSettingsService.isMarketplaceEnabled();
    if (!isMarketplaceEnabled) {
      return {
        marketplaceEnabled: false,
        message: 'The central marketplace is temporarily disabled.',
        data: [],
        meta: { total: 0, page: 1, limit: query.limit || 10, totalPages: 0 },
      };
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const whereClause: any = {
      operatingMode: 'CENTRAL_MARKETPLACE',
      marketplaceListingStatus: 'published',
      status: 'active',
      deletedAt: null,
    };

    if (query.search && query.search.trim() !== '') {
      const term = query.search.trim();
      whereClause.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [salons, total] = await Promise.all([
      this.prisma.sms_organizations.findMany({
        where: whereClause,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          slug: true,
          businessType: true,
          description: true,
          logoUrl: true,
          logoSquareUrl: true,
          brandPrimaryColor: true,
          operatingMode: true,
          marketplaceListingStatus: true,
          branches: {
            where: { status: 'active', deletedAt: null },
            select: {
              id: true,
              name: true,
              code: true,
              branchType: true,
              branchAddress: {
                select: {
                  city: true,
                  state: true,
                },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.sms_organizations.count({ where: whereClause }),
    ]);

    return {
      marketplaceEnabled: true,
      data: salons,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

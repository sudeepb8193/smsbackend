import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PlatformSettingsService {
  private readonly MARKETPLACE_KEY = 'marketplace_enabled';

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if the central marketplace is enabled globally
   */
  async isMarketplaceEnabled(): Promise<boolean> {
    const setting = await this.prisma.sms_platformSettings.findUnique({
      where: { key: this.MARKETPLACE_KEY },
    });

    if (!setting) {
      // Initialize with default 'true' if not yet seeded
      await this.prisma.sms_platformSettings.create({
        data: {
          key: this.MARKETPLACE_KEY,
          value: 'true',
          description: 'Global switch to enable or disable central marketplace bookings & discovery',
        },
      });
      return true;
    }

    return setting.value === 'true';
  }

  /**
   * Get detailed marketplace setting for Super Admin
   */
  async getMarketplaceSetting() {
    let setting = await this.prisma.sms_platformSettings.findUnique({
      where: { key: this.MARKETPLACE_KEY },
      include: {
        updatedBy: {
          select: { id: true, displayName: true, email: true },
        },
      },
    });

    if (!setting) {
      setting = await this.prisma.sms_platformSettings.create({
        data: {
          key: this.MARKETPLACE_KEY,
          value: 'true',
          description: 'Global switch to enable or disable central marketplace bookings & discovery',
        },
        include: {
          updatedBy: {
            select: { id: true, displayName: true, email: true },
          },
        },
      });
    }

    return {
      key: setting.key,
      marketplaceEnabled: setting.value === 'true',
      description: setting.description,
      updatedAt: setting.updatedAt,
      updatedBy: setting.updatedBy,
    };
  }

  /**
   * Update global marketplace setting with audit logging
   */
  async updateMarketplaceSetting(
    enabled: boolean,
    updatedById?: string,
    reason?: string,
    clientIp?: string,
  ) {
    const previous = await this.getMarketplaceSetting();
    const strValue = enabled ? 'true' : 'false';

    const updated = await this.prisma.sms_platformSettings.upsert({
      where: { key: this.MARKETPLACE_KEY },
      create: {
        key: this.MARKETPLACE_KEY,
        value: strValue,
        description: 'Global switch to enable or disable central marketplace bookings & discovery',
        updatedById: updatedById || null,
      },
      update: {
        value: strValue,
        updatedById: updatedById || null,
      },
      include: {
        updatedBy: {
          select: { id: true, displayName: true, email: true },
        },
      },
    });

    // Record audit log
    await this.prisma.sms_auditLogs.create({
      data: {
        performedById: updatedById || null,
        action: 'MARKETPLACE_GLOBAL_SETTING_CHANGED',
        oldValue: { marketplaceEnabled: previous.marketplaceEnabled },
        newValue: { marketplaceEnabled: enabled, reason: reason || null },
        ipAddress: clientIp || null,
      },
    });

    return {
      success: true,
      message: `Central marketplace has been ${enabled ? 'enabled' : 'disabled'} successfully.`,
      marketplaceEnabled: enabled,
      updatedAt: updated.updatedAt,
      updatedBy: updated.updatedBy,
    };
  }
}

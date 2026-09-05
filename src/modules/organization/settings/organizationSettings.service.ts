import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

const VALID_ISO_CURRENCIES = new Set([
  'USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY', 'AED',
  'SAR', 'SGD', 'NZD', 'HKD', 'MXN', 'BRL', 'ZAR', 'RUB', 'KRW', 'SEK',
]);

@Injectable()
export class OrganizationSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  public validateCurrencyCode(code: string): void {
    if (!VALID_ISO_CURRENCIES.has(code.toUpperCase())) {
      throw new BadRequestException(
        `Invalid currency code '${code}'. Must be a valid ISO 4217 currency code (e.g. USD, EUR, GBP, INR).`,
      );
    }
  }

  public validateTimezone(tz: string): void {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
    } catch {
      throw new BadRequestException(
        `Invalid IANA timezone '${tz}'. Example valid timezones: 'UTC', 'America/New_York', 'Asia/Kolkata', 'Europe/London'.`,
      );
    }
  }

  async getSettings(organizationId: number) {
    let settings = await this.prisma.smsOrganizationSettings.findUnique({
      where: { organizationId },
    });

    if (!settings) {
      // Auto-initialize default settings if missing
      settings = await this.prisma.smsOrganizationSettings.create({
        data: {
          organizationId,
          defaultCurrencyCode: 'USD',
          currencySymbolPosition: 'prefix',
          currencyDecimalPlaces: 2,
          timezone: 'UTC',
          dateFormat: 'YYYY-MM-DD',
          timeFormat: '12h',
          firstDayOfWeek: 'monday',
          languageCode: 'en',
          fiscalYearStartMonth: 1,
        },
      });
    }

    return settings;
  }

  async updateSettings(
    organizationId: number,
    dto: UpdateSettingsDto,
    hasTransactions = false,
  ) {
    const existing = await this.getSettings(organizationId);

    if (dto.defaultCurrencyCode) {
      this.validateCurrencyCode(dto.defaultCurrencyCode);

      if (dto.defaultCurrencyCode !== existing.defaultCurrencyCode) {
        if (hasTransactions) {
          if (!dto.confirmCurrencyChange || dto.confirmCurrencyCode !== dto.defaultCurrencyCode) {
            throw new BadRequestException({
              message:
                'Existing financial transactions detected. Changing organization default currency requires explicit confirmation.',
              requiresConfirmation: true,
              expectedCurrencyCode: dto.defaultCurrencyCode,
            });
          }
        }
      }
    }

    if (dto.timezone) {
      this.validateTimezone(dto.timezone);
    }

    return this.prisma.smsOrganizationSettings.update({
      where: { organizationId },
      data: {
        defaultCurrencyCode: dto.defaultCurrencyCode,
        currencySymbolPosition: dto.currencySymbolPosition,
        currencyDecimalPlaces: dto.currencyDecimalPlaces,
        timezone: dto.timezone,
        dateFormat: dto.dateFormat,
        timeFormat: dto.timeFormat,
        firstDayOfWeek: dto.firstDayOfWeek,
        languageCode: dto.languageCode,
        fiscalYearStartMonth: dto.fiscalYearStartMonth,
      },
    });
  }
}

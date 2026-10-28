import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { PlatformSettingsService } from './platform-settings.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import type { Request } from 'express';

export class UpdateMarketplaceSettingDto {
  @IsBoolean()
  enabled: boolean;

  @IsString()
  @IsOptional()
  reason?: string;
}

@Controller()
export class PlatformSettingsController {
  constructor(private readonly settingsService: PlatformSettingsService) {}

  /**
   * Super Admin: Get marketplace setting
   * GET /super-admin/platform-settings/marketplace
   */
  @Get('super-admin/platform-settings/marketplace')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'super-admin')
  @HttpCode(HttpStatus.OK)
  async getMarketplaceSetting() {
    return this.settingsService.getMarketplaceSetting();
  }

  /**
   * Super Admin: Toggle marketplace setting
   * PATCH /super-admin/platform-settings/marketplace
   */
  @Patch('super-admin/platform-settings/marketplace')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'super-admin')
  @HttpCode(HttpStatus.OK)
  async updateMarketplaceSetting(
    @Body() dto: UpdateMarketplaceSettingDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const clientIp = req.ip || req.socket.remoteAddress;
    return this.settingsService.updateMarketplaceSetting(
      dto.enabled,
      user.id,
      dto.reason,
      clientIp,
    );
  }

  /**
   * Public: Query marketplace operational status
   * GET /marketplace/status
   */
  @Get('marketplace/status')
  @HttpCode(HttpStatus.OK)
  async getPublicMarketplaceStatus() {
    const enabled = await this.settingsService.isMarketplaceEnabled();
    return {
      marketplaceEnabled: enabled,
      status: enabled ? 'operational' : 'disabled',
      message: enabled
        ? 'Central marketplace is active and accepting bookings.'
        : 'Central marketplace is temporarily disabled for maintenance.',
    };
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OrganizationService } from '../services/organization.service';
import { OrganizationLifecycleService } from '../services/organization-lifecycle.service';
import { FileStorageService } from '../services/file-storage.service';
import type { ExpressMulterFile } from '../services/file-storage.service';
import { CreateOrganizationDto } from '../dto/create-organization.dto';
import { UpdateOrganizationDto } from '../dto/update-organization.dto';
import { CheckSlugAvailabilityDto } from '../dto/check-slug-availability.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@Controller('organizations')
export class OrganizationController {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly lifecycleService: OrganizationLifecycleService,
    private readonly fileStorageService: FileStorageService,
  ) {}

  /**
   * Create Organization Identity (Super Admin)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'super-admin')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createOrganization(
    @Body() dto: CreateOrganizationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizationService.createOrganization(dto, user.id);
  }

  /**
   * Debounced Slug Availability Check Endpoint
   */
  @Get('slug-availability')
  @HttpCode(HttpStatus.OK)
  async checkSlugAvailability(
    @Query() query: CheckSlugAvailabilityDto,
    @Req() req: any,
  ) {
    const currentOrgId = req.user?.organizationId
      ? String(req.user.organizationId)
      : undefined;
    return this.organizationService.checkSlugAvailability(
      query.slug,
      currentOrgId,
    );
  }

  /**
   * Get Current Authenticated Organization Profile
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getCurrentOrganization(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationService.getOrganization(user.organizationId);
  }

  /**
   * Update Current Organization Identity & Branding (Super Admin)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'super-admin')
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  async updateCurrentOrganization(
    @Body() dto: UpdateOrganizationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizationService.updateOrganization(
      user.organizationId,
      dto,
    );
  }

  /**
   * Activate Organization Status (Lifecycle boundary)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'super-admin')
  @Post('me/activate')
  @HttpCode(HttpStatus.OK)
  async activateOrganization(@CurrentUser() user: AuthenticatedUser) {
    return this.lifecycleService.activateOrganization(user.organizationId);
  }

  /**
   * Upload Logo Asset (Super Admin)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'super-admin')
  @Post('me/logo')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  async uploadLogo(
    @UploadedFile() file: ExpressMulterFile,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const logoUrl = await this.fileStorageService.saveAsset(file, 'logo');
    return this.organizationService.updateOrganization(user.organizationId, {
      logoUrl,
    });
  }

  /**
   * Upload Favicon Asset (Super Admin)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'super-admin')
  @Post('me/favicon')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  async uploadFavicon(
    @UploadedFile() file: ExpressMulterFile,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const faviconUrl = await this.fileStorageService.saveAsset(file, 'favicon');
    return this.organizationService.updateOrganization(user.organizationId, {
      faviconUrl,
    });
  }

  /**
   * Get Tax Profiles (Stub endpoint for Task 1.4)
   */
  @UseGuards(JwtAuthGuard)
  @Get('me/tax-profiles')
  @HttpCode(HttpStatus.OK)
  async getTaxProfiles() {
    return [];
  }

  /**
   * Get Regional Settings (Stub endpoint for Task 1.5)
   */
  @UseGuards(JwtAuthGuard)
  @Get('me/settings')
  @HttpCode(HttpStatus.OK)
  async getRegionalSettings() {
    return {
      currency: 'USD',
      timezone: 'UTC',
      dateFormat: 'YYYY-MM-DD',
      timeFormat: '12h',
    };
  }
}

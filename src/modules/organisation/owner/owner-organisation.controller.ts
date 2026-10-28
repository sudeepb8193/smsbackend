import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { OrganisationService } from '../core/organisation.service';
import { UpdateOrganisationSetupDto } from '../dto/update-organisation-setup.dto';
import { OrganizationContactVerificationService } from '../organization-contact/organization-contact-verification.service';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { PermissionsGuard } from '../../role-permission/guards/permissions.guard';
import { RequirePermissions } from '../../role-permission/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import type { Request } from 'express';

@Controller('owner/organisation')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('OWNER', 'owner', 'SUPER_ADMIN', 'super-admin')
export class OwnerOrganisationController {
  constructor(
    private readonly organisationService: OrganisationService,
    private readonly contactVerificationService: OrganizationContactVerificationService,
  ) {}

  @Get('setup')
  @RequirePermissions('organizations.view')
  @HttpCode(HttpStatus.OK)
  async getSetup(@CurrentUser() user: AuthenticatedUser) {
    return this.organisationService.findOne(user.organizationId);
  }

  @Get('setup/slug-availability')
  @RequirePermissions('organizations.view')
  @HttpCode(HttpStatus.OK)
  async checkSlugAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Query('slug') slug: string,
  ) {
    return this.organisationService.checkSlugAvailability(
      user.organizationId,
      slug,
    );
  }

  @Put('setup')
  @RequirePermissions('organizations.edit')
  @HttpCode(HttpStatus.OK)
  async updateSetup(
    @Body() dto: UpdateOrganisationSetupDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const clientIp = req.ip || req.socket.remoteAddress;
    return this.organisationService.updateOwnerSetup(
      user.organizationId,
      dto,
      user.id,
      clientIp,
    );
  }

  @Post('contacts/:contactId/verify-email')
  @RequirePermissions('organizations.edit')
  @HttpCode(HttpStatus.OK)
  async sendContactVerification(
    @Param('contactId') contactId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contactVerificationService.sendVerification(
      user.organizationId,
      contactId,
    );
  }
}

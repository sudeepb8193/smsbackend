import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
  Param,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { OrganizationContactVerificationService } from './organization-contact-verification.service';

@Controller()
export class OrganizationContactVerificationController {
  constructor(
    private readonly verificationService: OrganizationContactVerificationService,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'super-admin')
  @Post(
    'super-admin/organisations/:organisationId/contacts/:contactId/verify-email',
  )
  @HttpCode(HttpStatus.OK)
  sendVerification(
    @Param('organisationId') organisationId: string,
    @Param('contactId') contactId: string,
  ) {
    return this.verificationService.sendVerification(organisationId, contactId);
  }

  @Get('organization-contact-verification')
  @HttpCode(HttpStatus.OK)
  verify(@Query('token') token: string) {
    return this.verificationService.verify(token);
  }
}

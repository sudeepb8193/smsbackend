import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { OrganizationContactService } from './organizationContact.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Controller('organizations/:organizationId/contacts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationContactController {
  constructor(private readonly contactService: OrganizationContactService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.BRANCH_MANAGER, Role.ACCOUNTANT)
  async findByOrganization(@Param('organizationId', ParseIntPipe) organizationId: number) {
    return this.contactService.findByOrganization(organizationId);
  }

  @Get(':contactId')
  @Roles(Role.SUPER_ADMIN, Role.BRANCH_MANAGER, Role.ACCOUNTANT)
  async findById(@Param('contactId', ParseIntPipe) contactId: number) {
    return this.contactService.findById(contactId);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  async create(
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Body() dto: CreateContactDto,
  ) {
    return this.contactService.createContact(organizationId, dto);
  }

  @Patch(':contactId')
  @Roles(Role.SUPER_ADMIN)
  async update(
    @Param('contactId', ParseIntPipe) contactId: number,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contactService.updateContact(contactId, dto);
  }

  @Delete(':contactId')
  @Roles(Role.SUPER_ADMIN)
  async remove(@Param('contactId', ParseIntPipe) contactId: number) {
    return this.contactService.deleteContact(contactId);
  }

  @Post(':contactId/request-email-verification')
  @Roles(Role.SUPER_ADMIN)
  async requestEmailVerification(@Param('contactId', ParseIntPipe) contactId: number) {
    return this.contactService.requestVerification(contactId, 'email');
  }

  @Post(':contactId/verify-email')
  @Roles(Role.SUPER_ADMIN)
  async verifyEmail(
    @Param('contactId', ParseIntPipe) contactId: number,
    @Body('token') token: string,
  ) {
    return this.contactService.verifyContact(contactId, 'email', token);
  }

  @Post(':contactId/request-phone-verification')
  @Roles(Role.SUPER_ADMIN)
  async requestPhoneVerification(@Param('contactId', ParseIntPipe) contactId: number) {
    return this.contactService.requestVerification(contactId, 'phone');
  }

  @Post(':contactId/verify-phone')
  @Roles(Role.SUPER_ADMIN)
  async verifyPhone(
    @Param('contactId', ParseIntPipe) contactId: number,
    @Body('token') token: string,
  ) {
    return this.contactService.verifyContact(contactId, 'phone', token);
  }
}

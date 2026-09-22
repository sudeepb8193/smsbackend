import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OrganizationContactService } from '../services/organization-contact.service';
import { CreateOrganizationContactDto } from '../dto/create-organization-contact.dto';
import { UpdateOrganizationContactDto } from '../dto/update-organization-contact.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@Controller('organizations/me/contacts')
export class OrganizationContactController {
  constructor(private readonly contactService: OrganizationContactService) {}

  /**
   * Create Organization Contact (Super Admin)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'super-admin')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createContact(
    @Body() dto: CreateOrganizationContactDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contactService.createContact(user.organizationId, dto);
  }

  /**
   * List Organization Contacts (Super Admin, Branch Manager, Accountant)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    'SUPER_ADMIN',
    'BRANCH_MANAGER',
    'ACCOUNTANT',
    'super-admin',
    'branch-manager',
    'accountant',
  )
  @Get()
  @HttpCode(HttpStatus.OK)
  async getContacts(@CurrentUser() user: AuthenticatedUser) {
    return this.contactService.getContacts(user.organizationId);
  }

  /**
   * Get Contact Details by ID (Super Admin, Branch Manager, Accountant)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    'SUPER_ADMIN',
    'BRANCH_MANAGER',
    'ACCOUNTANT',
    'super-admin',
    'branch-manager',
    'accountant',
  )
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getContactById(
    @Param('id') contactId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contactService.getContactById(user.organizationId, contactId);
  }

  /**
   * Update Organization Contact (Super Admin)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'super-admin')
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateContact(
    @Param('id') contactId: string,
    @Body() dto: UpdateOrganizationContactDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contactService.updateContact(
      user.organizationId,
      contactId,
      dto,
    );
  }

  /**
   * Set Contact as Default Public Contact (Super Admin)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'super-admin')
  @Patch(':id/default-public')
  @HttpCode(HttpStatus.OK)
  async setDefaultPublicContact(
    @Param('id') contactId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contactService.setDefaultPublicContact(
      user.organizationId,
      contactId,
    );
  }

  /**
   * Delete Organization Contact (Super Admin)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'super-admin')
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteContact(
    @Param('id') contactId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contactService.deleteContact(user.organizationId, contactId);
  }
}

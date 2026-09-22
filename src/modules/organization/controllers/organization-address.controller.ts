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
import { OrganizationAddressService } from '../services/organization-address.service';
import { CreateOrganizationAddressDto } from '../dto/create-organization-address.dto';
import { UpdateOrganizationAddressDto } from '../dto/update-organization-address.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@Controller('organizations/me/addresses')
export class OrganizationAddressController {
  constructor(private readonly addressService: OrganizationAddressService) {}

  /**
   * Create Organization Address (Super Admin)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'super-admin')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createAddress(
    @Body() dto: CreateOrganizationAddressDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.addressService.createAddress(user.organizationId, dto);
  }

  /**
   * List Organization Addresses (Super Admin, Branch Manager, Accountant)
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
  async getAddresses(@CurrentUser() user: AuthenticatedUser) {
    return this.addressService.getAddresses(user.organizationId);
  }

  /**
   * Get Address Details by ID (Super Admin, Branch Manager, Accountant)
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
  async getAddressById(
    @Param('id') addressId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.addressService.getAddressById(user.organizationId, addressId);
  }

  /**
   * Update Organization Address (Super Admin)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'super-admin')
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateAddress(
    @Param('id') addressId: string,
    @Body() dto: UpdateOrganizationAddressDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.addressService.updateAddress(
      user.organizationId,
      addressId,
      dto,
    );
  }

  /**
   * Delete Organization Address (Super Admin)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'super-admin')
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteAddress(
    @Param('id') addressId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.addressService.deleteAddress(user.organizationId, addressId);
  }
}

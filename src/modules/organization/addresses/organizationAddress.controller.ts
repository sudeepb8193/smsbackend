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
import { OrganizationAddressService } from './organizationAddress.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Controller('organizations/:organizationId/addresses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationAddressController {
  constructor(private readonly addressService: OrganizationAddressService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.BRANCH_MANAGER, Role.ACCOUNTANT)
  async findByOrganization(@Param('organizationId', ParseIntPipe) organizationId: number) {
    return this.addressService.findByOrganization(organizationId);
  }

  @Get(':addressId')
  @Roles(Role.SUPER_ADMIN, Role.BRANCH_MANAGER, Role.ACCOUNTANT)
  async findById(@Param('addressId', ParseIntPipe) addressId: number) {
    return this.addressService.findById(addressId);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  async create(
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Body() dto: CreateAddressDto,
  ) {
    return this.addressService.createAddress(organizationId, dto);
  }

  @Patch(':addressId')
  @Roles(Role.SUPER_ADMIN)
  async update(
    @Param('addressId', ParseIntPipe) addressId: number,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.addressService.updateAddress(addressId, dto);
  }

  @Delete(':addressId')
  @Roles(Role.SUPER_ADMIN)
  async remove(@Param('addressId', ParseIntPipe) addressId: number) {
    return this.addressService.deleteAddress(addressId);
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { OrganizationTaxService } from './organizationTax.service';
import { CreateTaxProfileDto } from './dto/create-tax-profile.dto';
import { UpdateTaxProfileDto, RejectTaxProfileDto } from './dto/update-tax-profile.dto';

@Controller('organizations/:organizationId/tax-profiles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationTaxController {
  constructor(private readonly taxService: OrganizationTaxService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.BRANCH_MANAGER, Role.ACCOUNTANT)
  async findByOrganization(@Param('organizationId', ParseIntPipe) organizationId: number) {
    return this.taxService.findByOrganization(organizationId);
  }

  @Get(':taxId')
  @Roles(Role.SUPER_ADMIN, Role.BRANCH_MANAGER, Role.ACCOUNTANT)
  async findById(@Param('taxId', ParseIntPipe) taxId: number) {
    return this.taxService.findById(taxId);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  async create(
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Body() dto: CreateTaxProfileDto,
  ) {
    return this.taxService.createTaxProfile(organizationId, dto);
  }

  @Patch(':taxId')
  @Roles(Role.SUPER_ADMIN)
  async update(
    @Param('taxId', ParseIntPipe) taxId: number,
    @Body() dto: UpdateTaxProfileDto,
  ) {
    return this.taxService.updateTaxProfile(taxId, dto);
  }

  @Post(':taxId/submit-verification')
  @Roles(Role.SUPER_ADMIN)
  async submitVerification(@Param('taxId', ParseIntPipe) taxId: number) {
    return this.taxService.submitVerification(taxId);
  }

  @Post(':taxId/verify')
  @Roles(Role.SUPER_ADMIN)
  async verify(@Param('taxId', ParseIntPipe) taxId: number) {
    return this.taxService.verifyTaxProfile(taxId);
  }

  @Post(':taxId/reject')
  @Roles(Role.SUPER_ADMIN)
  async reject(
    @Param('taxId', ParseIntPipe) taxId: number,
    @Body() dto: RejectTaxProfileDto,
  ) {
    return this.taxService.rejectTaxProfile(taxId, dto.notes);
  }
}

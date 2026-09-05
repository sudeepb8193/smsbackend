import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get('slug-availability')
  async checkSlugAvailability(
    @Query('slug') slug: string,
    @Query('currentOrgId') currentOrgId?: string,
  ) {
    const orgIdNum = currentOrgId ? parseInt(currentOrgId, 10) : undefined;
    return this.organizationService.checkSlugAvailability(slug || '', orgIdNum);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  async create(
    @Body() dto: CreateOrganizationDto,
    @CurrentUser('id') userId?: number,
  ) {
    return this.organizationService.create(dto, userId);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.BRANCH_MANAGER, Role.ACCOUNTANT)
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.organizationService.findById(id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationService.update(id, dto);
  }
}

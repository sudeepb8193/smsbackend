import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { OrganizationSettingsService } from './organizationSettings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Controller('organizations/:organizationId/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationSettingsController {
  constructor(private readonly settingsService: OrganizationSettingsService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.BRANCH_MANAGER, Role.ACCOUNTANT)
  async getSettings(@Param('organizationId', ParseIntPipe) organizationId: number) {
    return this.settingsService.getSettings(organizationId);
  }

  @Put()
  @Roles(Role.SUPER_ADMIN)
  async updateSettings(
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Body() dto: UpdateSettingsDto,
    @Query('hasTransactions') hasTransactions?: string,
  ) {
    const hasTx = hasTransactions === 'true';
    return this.settingsService.updateSettings(organizationId, dto, hasTx);
  }
}

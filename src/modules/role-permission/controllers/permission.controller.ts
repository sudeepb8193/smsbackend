import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PermissionService } from '../services/permission.service';
import { QueryPermissionsDto } from '../dto/query-permissions.dto';
import { CreateModulePermissionsDto } from '../dto/create-module-permissions.dto';
import { UpdateModulePermissionsDto } from '../dto/update-module-permissions.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@Controller('api/permissions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'super-admin')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  /**
   * Read-only permission catalog (Super Admin only)
   */
  @Get()
  @Roles('SUPER_ADMIN', 'super-admin')
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: QueryPermissionsDto) {
    return this.permissionService.findAll(query);
  }

  /**
   * Get matrix template grouped by module (Super Admin only)
   */
  @Get('matrix-template')
  @Roles('SUPER_ADMIN', 'super-admin')
  @HttpCode(HttpStatus.OK)
  async getMatrixTemplate() {
    return this.permissionService.getMatrixTemplate();
  }

  /**
   * Register a new module with permissions dynamically (Super Admin only)
   */
  @Post('modules')
  @Roles('SUPER_ADMIN', 'super-admin')
  @HttpCode(HttpStatus.CREATED)
  async createModulePermissions(@Body() dto: CreateModulePermissionsDto) {
    return this.permissionService.createModulePermissions(dto);
  }

  /**
   * Update an existing module's display name, description, and actions (Super Admin only)
   */
  @Put('modules/:moduleCode')
  @Roles('SUPER_ADMIN', 'super-admin')
  @HttpCode(HttpStatus.OK)
  async updateModulePermissions(
    @Param('moduleCode') moduleCode: string,
    @Body() dto: UpdateModulePermissionsDto,
  ) {
    return this.permissionService.updateModulePermissions(moduleCode, dto);
  }

  /**
   * Delete a module and all its associated permissions (Super Admin only)
   */
  @Delete('modules/:moduleCode')
  @Roles('SUPER_ADMIN', 'super-admin')
  @HttpCode(HttpStatus.OK)
  async deleteModule(@Param('moduleCode') moduleCode: string) {
    return this.permissionService.deleteModule(moduleCode);
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StaffDesignationService } from '../services/staff-designation.service';
import {
  CreateDesignationDto,
  UpdateDesignationDto,
} from '../dto/designation.dto';
import {
  CreateSkillRatingDto,
  UpdateSkillRatingDto,
  VerifySkillRatingDto,
  RejectSkillRatingDto,
} from '../dto/skill-rating.dto';
import {
  AssignServiceDto,
  BulkAssignServicesDto,
  UpdateDurationOverrideDto,
} from '../dto/staff-service.dto';
import {
  CreateBranchOverrideDto,
} from '../dto/branch-override.dto';
import {
  CreateCommissionOverrideDto,
  UpdateCommissionOverrideDto,
  SetCommissionEligibilityDto,
} from '../dto/commission-rate.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../role-permission/guards/permissions.guard';
import { RequirePermissions } from '../../role-permission/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';

@Controller('staff/:id')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class StaffDesignationController {
  constructor(
    private readonly staffDesignationService: StaffDesignationService,
  ) {}

  private resolveOrgId(user?: AuthenticatedUser, queryOrgId?: string): string {
    const roles = (user?.roles || []).map((r) =>
      r.toLowerCase().replace(/_/g, '-'),
    );
    const isSuperAdmin = roles.includes('super-admin');
    return (isSuperAdmin && queryOrgId) || queryOrgId || user?.organizationId || '';
  }

  // =========================================================================
  // TASK 6.1: SERVICE PROVIDER DESIGNATIONS
  // =========================================================================

  @Get('designations')
  @RequirePermissions('staff_designation.view')
  async getDesignations(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') staffId: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffDesignationService.getStaffDesignations(orgId, staffId, user);
  }

  @Post('designations')
  @RequirePermissions('staff_designation.create')
  @HttpCode(HttpStatus.CREATED)
  async createDesignation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') staffId: string,
    @Body() dto: CreateDesignationDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffDesignationService.createDesignation(
      orgId,
      staffId,
      dto,
      user,
    );
  }

  @Patch('designations/:designationId')
  @RequirePermissions('staff_designation.update')
  async updateDesignation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') staffId: string,
    @Param('designationId') designationId: string,
    @Body() dto: UpdateDesignationDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffDesignationService.updateDesignation(
      orgId,
      staffId,
      designationId,
      dto,
      user,
    );
  }

  @Patch('designations/:designationId/set-primary')
  @RequirePermissions('staff_designation.update')
  async setPrimaryDesignation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') staffId: string,
    @Param('designationId') designationId: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffDesignationService.setPrimaryDesignation(
      orgId,
      staffId,
      designationId,
      user,
    );
  }

  @Delete('designations/:designationId')
  @RequirePermissions('staff_designation.delete')
  async deleteDesignation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') staffId: string,
    @Param('designationId') designationId: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffDesignationService.deleteDesignation(
      orgId,
      staffId,
      designationId,
      user,
    );
  }

  // =========================================================================
  // TASK 6.2: SKILL PROFICIENCY & SPECIALIZATION
  // =========================================================================

  @Get('skills')
  @RequirePermissions('staff_skill_rating.view')
  async getSkillRatings(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') staffId: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffDesignationService.getStaffSkillRatings(orgId, staffId, user);
  }

  @Post('skills')
  @RequirePermissions('staff_skill_rating.create')
  @HttpCode(HttpStatus.CREATED)
  async createSkillRating(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') staffId: string,
    @Body() dto: CreateSkillRatingDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffDesignationService.createSkillRating(
      orgId,
      staffId,
      dto,
      user,
    );
  }

  @Patch('skills/:skillId')
  @RequirePermissions('staff_skill_rating.update')
  async updateSkillRating(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') staffId: string,
    @Param('skillId') skillId: string,
    @Body() dto: UpdateSkillRatingDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffDesignationService.updateSkillRating(
      orgId,
      staffId,
      skillId,
      dto,
      user,
    );
  }

  @Post('skills/:skillId/verify')
  @RequirePermissions('staff_skill_rating.approve')
  async verifySkillRating(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') staffId: string,
    @Param('skillId') skillId: string,
    @Body() dto: VerifySkillRatingDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffDesignationService.verifySkillRating(
      orgId,
      staffId,
      skillId,
      user,
      dto.note,
    );
  }

  @Post('skills/:skillId/reject')
  @RequirePermissions('staff_skill_rating.reject')
  async rejectSkillRating(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') staffId: string,
    @Param('skillId') skillId: string,
    @Body() dto: RejectSkillRatingDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffDesignationService.rejectSkillRating(
      orgId,
      staffId,
      skillId,
      user,
      dto.reason,
    );
  }

  @Delete('skills/:skillId')
  @RequirePermissions('staff_skill_rating.delete')
  async deleteSkillRating(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') staffId: string,
    @Param('skillId') skillId: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffDesignationService.deleteSkillRating(
      orgId,
      staffId,
      skillId,
      user,
    );
  }

  // =========================================================================
  // TASK 6.3: SERVICE ASSIGNMENT
  // =========================================================================

  @Get('services')
  @RequirePermissions('staff_service.view')
  async getAssignedServices(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') staffId: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffDesignationService.getAssignedServices(orgId, staffId, user);
  }

  @Get('available-services')
  @RequirePermissions('staff_service.view')
  async getAvailableServices(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') staffId: string,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffDesignationService.getAvailableCatalogServices(
      orgId,
      staffId,
      user,
      search,
      categoryId,
    );
  }

  @Post('services')
  @RequirePermissions('staff_service.create')
  @HttpCode(HttpStatus.CREATED)
  async assignService(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') staffId: string,
    @Body() dto: AssignServiceDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffDesignationService.assignService(
      orgId,
      staffId,
      dto,
      user,
    );
  }

  @Post('services/bulk')
  @RequirePermissions('staff_service.manage')
  @HttpCode(HttpStatus.CREATED)
  async bulkAssignServices(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') staffId: string,
    @Body() dto: BulkAssignServicesDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffDesignationService.bulkAssignServices(
      orgId,
      staffId,
      dto,
      user,
    );
  }

  @Patch('services/:assignmentId')
  @RequirePermissions('staff_service.update')
  async updateServiceAssignment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') staffId: string,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: UpdateDurationOverrideDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffDesignationService.updateServiceAssignment(
      orgId,
      staffId,
      assignmentId,
      dto,
      user,
    );
  }

  @Delete('services/:assignmentId')
  @RequirePermissions('staff_service.delete')
  async deleteServiceAssignment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') staffId: string,
    @Param('assignmentId') assignmentId: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffDesignationService.deleteServiceAssignment(
      orgId,
      staffId,
      assignmentId,
      user,
    );
  }

  // =========================================================================
  // TASK 6.4: BRANCH-WISE SERVICE AVAILABILITY
  // =========================================================================

  @Get('branch-availability')
  @RequirePermissions('staff_service_branch.view')
  async getBranchServiceAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') staffId: string,
    @Query('staffServiceId') staffServiceId?: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffDesignationService.getBranchServiceAvailability(
      orgId,
      staffId,
      staffServiceId,
      user,
    );
  }

  @Post('services/:staffServiceId/branch-overrides')
  @RequirePermissions('staff_service_branch.create')
  async createBranchOverride(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') staffId: string,
    @Param('staffServiceId') staffServiceId: string,
    @Body() dto: CreateBranchOverrideDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffDesignationService.createOrUpdateBranchOverride(
      orgId,
      staffId,
      staffServiceId,
      dto,
      user,
    );
  }

  @Delete('services/:staffServiceId/branch-overrides/:branchId')
  @RequirePermissions('staff_service_branch.delete')
  async deleteBranchOverride(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') staffId: string,
    @Param('staffServiceId') staffServiceId: string,
    @Param('branchId') branchId: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffDesignationService.deleteBranchOverride(
      orgId,
      staffId,
      staffServiceId,
      branchId,
      user,
    );
  }

  // =========================================================================
  // TASK 6.5: COMMISSION ELIGIBILITY & RATE OVERRIDE
  // =========================================================================

  @Get('commission')
  @RequirePermissions('staff_commission.view')
  async getCommissionConfiguration(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') staffId: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffDesignationService.getStaffCommissionConfiguration(
      orgId,
      staffId,
      user,
    );
  }

  @Patch('commission/eligibility')
  @RequirePermissions('staff_commission.manage')
  async setCommissionEligibility(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') staffId: string,
    @Body() dto: SetCommissionEligibilityDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffDesignationService.setCommissionEligibility(
      orgId,
      staffId,
      dto,
      user,
    );
  }

  @Post('commission/overrides')
  @RequirePermissions('staff_commission.create')
  @HttpCode(HttpStatus.CREATED)
  async createCommissionOverride(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') staffId: string,
    @Body() dto: CreateCommissionOverrideDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffDesignationService.createCommissionOverride(
      orgId,
      staffId,
      dto,
      user,
    );
  }

  @Patch('commission/overrides/:overrideId')
  @RequirePermissions('staff_commission.update')
  async updateCommissionOverride(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') staffId: string,
    @Param('overrideId') overrideId: string,
    @Body() dto: UpdateCommissionOverrideDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffDesignationService.updateCommissionOverride(
      orgId,
      staffId,
      overrideId,
      dto,
      user,
    );
  }

  @Delete('commission/overrides/:overrideId')
  @RequirePermissions('staff_commission.delete')
  async deleteCommissionOverride(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') staffId: string,
    @Param('overrideId') overrideId: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffDesignationService.deleteCommissionOverride(
      orgId,
      staffId,
      overrideId,
      user,
    );
  }
}


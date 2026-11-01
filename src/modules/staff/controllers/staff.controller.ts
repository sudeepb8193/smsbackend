import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { StaffService } from '../services/staff.service';
import { CreateStaffDto } from '../dto/create-staff.dto';
import { UpdateStaffDto } from '../dto/update-staff.dto';
import { QueryStaffDto } from '../dto/query-staff.dto';
import { UpdateStaffStatusDto } from '../dto/update-staff-status.dto';
import { LinkUserDto } from '../dto/link-user.dto';
import { UpsertStaffContactsDto } from '../dto/upsert-staff-contacts.dto';
import {
  CreateEmergencyContactDto,
  UpdateEmergencyContactDto,
} from '../dto/emergency-contact.dto';
import { CreateEmploymentHistoryDto } from '../dto/create-employment-history.dto';
import {
  CreateQualificationDto,
  UpdateQualificationDto,
} from '../dto/qualification.dto';
import { CreateDocumentDto } from '../dto/document.dto';
import {
  CreateBranchAssignmentDto,
  TransferHomeBranchDto,
} from '../dto/branch-assignment.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../role-permission/guards/permissions.guard';
import { RequirePermissions } from '../../role-permission/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';

@Controller('staff')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  /**
   * Helper: Resolve effective organization ID
   */
  private resolveOrgId(user?: AuthenticatedUser, queryOrgId?: string): string {
    const roles = (user?.roles || []).map((r) => r.toLowerCase().replace(/_/g, '-'));
    const isSuperAdmin = roles.includes('super-admin');
    return (isSuperAdmin && queryOrgId) || queryOrgId || user?.organizationId || '';
  }

  // =========================================================================
  // TASK 5.1: EMPLOYEE MASTER PROFILE
  // =========================================================================

  @Get('suggest-code')
  @RequirePermissions('staff.view')
  async suggestCode(
    @CurrentUser() user: AuthenticatedUser,
    @Query('prefix') prefix?: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    const code = await this.staffService.generateEmployeeCode(orgId, prefix || 'EMP');
    return { employeeCode: code };
  }

  @Post()
  @RequirePermissions('staff.create')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateStaffDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffService.create(orgId, user?.id, dto);
  }

  @Get()
  @RequirePermissions('staff.view')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryStaffDto,
  ) {
    const orgId = this.resolveOrgId(user, query.organizationId);
    return this.staffService.findAll(orgId, query, undefined, user);
  }

  @Get('me')
  @RequirePermissions('staff.view')
  async getMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffService.findMyProfile(orgId, user);
  }

  @Patch('me')
  @RequirePermissions('staff.view')
  async updateMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateStaffDto & {
      personalPhone?: string;
      personalEmail?: string;
      addressLine1?: string;
      city?: string;
      postalCode?: string;
    },
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffService.updateMyProfile(orgId, user, dto);
  }

  @Get(':id')
  @RequirePermissions('staff.view')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffService.findOne(orgId, id, user);
  }

  @Patch(':id')
  @RequirePermissions('staff.update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffService.update(orgId, id, dto, user?.id);
  }

  @Patch(':id/status')
  @RequirePermissions('staff.manage_status')
  async updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateStaffStatusDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffService.updateStatus(orgId, id, dto, user?.id);
  }

  @Post(':id/link-user')
  @RequirePermissions('staff.link_user')
  async linkUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: LinkUserDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffService.linkUser(orgId, id, dto.userId, user?.id);
  }

  @Post(':id/unlink-user')
  @RequirePermissions('staff.link_user')
  async unlinkUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffService.unlinkUser(orgId, id, user?.id);
  }

  @Delete(':id')
  @RequirePermissions('staff.terminate')
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffService.remove(orgId, id, user?.id);
  }

  // =========================================================================
  // TASK 5.2: PERSONAL & CONTACT DETAILS
  // =========================================================================

  @Get(':id/contacts')
  @RequirePermissions('staff_contact.view')
  async getContacts(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffService.getContacts(orgId, id);
  }

  @Put(':id/contacts')
  @RequirePermissions('staff_contact.update')
  async upsertContacts(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpsertStaffContactsDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffService.upsertContacts(orgId, id, dto, user?.id);
  }

  @Post(':id/contacts/reveal-national-id')
  @RequirePermissions('staff_contact.reveal_sensitive')
  async revealNationalId(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    const ip = req.ip || req.socket?.remoteAddress;
    return this.staffService.revealNationalId(orgId, id, user?.id, ip);
  }

  // =========================================================================
  // TASK 5.3: EMERGENCY CONTACTS
  // =========================================================================

  @Get(':id/emergency-contacts')
  @RequirePermissions('staff_emergency.view')
  async getEmergencyContacts(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffService.getEmergencyContacts(orgId, id);
  }

  @Post(':id/emergency-contacts')
  @RequirePermissions('staff_emergency.create')
  @HttpCode(HttpStatus.CREATED)
  async createEmergencyContact(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateEmergencyContactDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffService.createEmergencyContact(orgId, id, dto, user?.id);
  }

  @Patch(':id/emergency-contacts/:contactId')
  @RequirePermissions('staff_emergency.update')
  async updateEmergencyContact(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @Body() dto: UpdateEmergencyContactDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffService.updateEmergencyContact(
      orgId,
      id,
      contactId,
      dto,
      user?.id,
    );
  }

  @Delete(':id/emergency-contacts/:contactId')
  @RequirePermissions('staff_emergency.delete')
  async deleteEmergencyContact(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffService.deleteEmergencyContact(
      orgId,
      id,
      contactId,
      user?.id,
    );
  }

  // =========================================================================
  // TASK 5.4: EMPLOYMENT & DEPARTMENT HISTORY
  // =========================================================================

  @Get(':id/employment-history')
  @RequirePermissions('staff_employment.view')
  async getEmploymentHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffService.getEmploymentHistory(orgId, id);
  }

  @Post(':id/employment-history')
  @RequirePermissions('staff_employment.create')
  @HttpCode(HttpStatus.CREATED)
  async createEmploymentHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateEmploymentHistoryDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffService.createEmploymentHistory(orgId, id, dto, user?.id);
  }

  // =========================================================================
  // TASK 5.5: SKILLS & QUALIFICATIONS
  // =========================================================================

  @Get(':id/qualifications')
  @RequirePermissions('staff_qualification.view')
  async getQualifications(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffService.getQualifications(orgId, id);
  }

  @Post(':id/qualifications')
  @RequirePermissions('staff_qualification.create')
  @HttpCode(HttpStatus.CREATED)
  async createQualification(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateQualificationDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffService.createQualification(orgId, id, dto, user?.id);
  }

  @Patch(':id/qualifications/:qualificationId')
  @RequirePermissions('staff_qualification.update')
  async updateQualification(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('qualificationId') qualificationId: string,
    @Body() dto: UpdateQualificationDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffService.updateQualification(
      orgId,
      id,
      qualificationId,
      dto,
      user?.id,
    );
  }

  @Delete(':id/qualifications/:qualificationId')
  @RequirePermissions('staff_qualification.delete')
  async deleteQualification(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('qualificationId') qualificationId: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffService.deleteQualification(
      orgId,
      id,
      qualificationId,
      user?.id,
    );
  }

  // =========================================================================
  // TASK 5.6: DOCUMENT MANAGEMENT
  // =========================================================================

  @Get(':id/documents')
  @RequirePermissions('staff_document.view')
  async getDocuments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffService.getDocuments(orgId, id, category, status);
  }

  @Post(':id/documents')
  @RequirePermissions('staff_document.upload')
  @HttpCode(HttpStatus.CREATED)
  async createDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateDocumentDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffService.createDocument(orgId, id, dto, user?.id);
  }

  @Get(':id/documents/:documentId')
  @RequirePermissions('staff_document.download')
  async getDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffService.getDocument(orgId, id, documentId);
  }

  @Delete(':id/documents/:documentId')
  @RequirePermissions('staff_document.delete')
  async deleteDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffService.deleteDocument(orgId, id, documentId, user?.id);
  }

  // =========================================================================
  // TASK 5.7: BRANCH ASSIGNMENT
  // =========================================================================

  @Get(':id/branch-assignments')
  @RequirePermissions('staff_branch.view')
  async getBranchAssignments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffService.getBranchAssignments(orgId, id);
  }

  @Post(':id/branch-assignments')
  @RequirePermissions('staff_branch.assign')
  @HttpCode(HttpStatus.CREATED)
  async addSecondaryBranch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateBranchAssignmentDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffService.addSecondaryBranch(orgId, id, dto, user?.id);
  }

  @Patch(':id/branch-assignments/:assignmentId/end')
  @RequirePermissions('staff_branch.remove')
  async endSecondaryBranch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffService.endSecondaryBranch(orgId, id, assignmentId, user?.id);
  }

  @Post(':id/branch-assignments/transfer-home')
  @RequirePermissions('staff_branch.transfer')
  async transferHomeBranch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: TransferHomeBranchDto,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const orgId = this.resolveOrgId(user, queryOrgId);
    return this.staffService.transferHomeBranch(orgId, id, dto, user?.id);
  }
}


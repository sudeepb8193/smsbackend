import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { SaveAttendancePolicyDto } from '../dto/attendance-policy.dto';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { AttendanceAccessHelper } from '../utils/attendance-access.util';

export const SYSTEM_DEFAULT_ATTENDANCE_POLICY = {
  lateGraceMinutes: 10,
  earlyExitGraceMinutes: 10,
  halfDayThresholdMinutes: 240,
  overtimeThresholdMinutes: 15,
  overtimeRequiresApproval: true,
  absentCutoffMinutes: 120,
  allowedCheckinMethods: 'biometric,geofenced_app,manual,admin_entry',
};

@Injectable()
export class AttendancePolicyService {
  private readonly logger = new Logger(AttendancePolicyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve effective attendance policy: Branch override -> Org default -> System default
   */
  async getEffectivePolicy(organizationId: string, branchId?: string) {
    if (branchId) {
      // 1. Try branch-specific override
      const branchPolicy = await this.prisma.sms_attendancePolicies.findFirst({
        where: {
          organizationId,
          branchId,
        },
      });

      if (branchPolicy) {
        return {
          ...branchPolicy,
          isBranchOverride: true,
          effectiveScope: 'BRANCH_OVERRIDE',
        };
      }
    }

    // 2. Try organization default
    const orgDefault = await this.prisma.sms_attendancePolicies.findFirst({
      where: {
        organizationId,
        branchId: null,
      },
    });

    if (orgDefault) {
      return {
        ...orgDefault,
        isBranchOverride: false,
        effectiveScope: 'ORGANIZATION_DEFAULT',
      };
    }

    // 3. Fallback to system default baseline
    return {
      id: null,
      organizationId,
      branchId: branchId || null,
      ...SYSTEM_DEFAULT_ATTENDANCE_POLICY,
      isBranchOverride: false,
      effectiveScope: 'SYSTEM_FALLBACK',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Save or update organization default policy
   */
  async saveOrganizationPolicy(
    organizationId: string,
    dto: SaveAttendancePolicyDto,
    user: AuthenticatedUser,
  ) {
    this.validatePolicyDto(dto);

    const existing = await this.prisma.sms_attendancePolicies.findFirst({
      where: {
        organizationId,
        branchId: null,
      },
    });

    const data = {
      lateGraceMinutes: dto.lateGraceMinutes,
      earlyExitGraceMinutes: dto.earlyExitGraceMinutes,
      halfDayThresholdMinutes: dto.halfDayThresholdMinutes,
      overtimeThresholdMinutes: dto.overtimeThresholdMinutes,
      overtimeRequiresApproval: dto.overtimeRequiresApproval,
      absentCutoffMinutes: dto.absentCutoffMinutes,
      allowedCheckinMethods: dto.allowedCheckinMethods,
    };

    let result;
    if (existing) {
      result = await this.prisma.sms_attendancePolicies.update({
        where: { id: existing.id },
        data,
      });
      await AttendanceAccessHelper.recordAuditLog(
        this.prisma,
        organizationId,
        user.id,
        'attendance_policy.update_org_default',
        existing,
        result,
      );
    } else {
      result = await this.prisma.sms_attendancePolicies.create({
        data: {
          organizationId,
          branchId: null,
          ...data,
        },
      });
      await AttendanceAccessHelper.recordAuditLog(
        this.prisma,
        organizationId,
        user.id,
        'attendance_policy.create_org_default',
        null,
        result,
      );
    }

    return {
      ...result,
      isBranchOverride: false,
      effectiveScope: 'ORGANIZATION_DEFAULT',
    };
  }

  /**
   * Save or update branch-specific override policy
   */
  async saveBranchPolicy(
    organizationId: string,
    branchId: string,
    dto: SaveAttendancePolicyDto,
    user: AuthenticatedUser,
  ) {
    this.validatePolicyDto(dto);

    // Verify branch belongs to organization
    const branch = await this.prisma.sms_branches.findFirst({
      where: { id: branchId, organizationId },
    });
    if (!branch) {
      throw new NotFoundException({
        code: 'BRANCH_NOT_FOUND',
        message: 'Specified branch does not exist within this organization',
      });
    }

    const existing = await this.prisma.sms_attendancePolicies.findFirst({
      where: {
        organizationId,
        branchId,
      },
    });

    const data = {
      lateGraceMinutes: dto.lateGraceMinutes,
      earlyExitGraceMinutes: dto.earlyExitGraceMinutes,
      halfDayThresholdMinutes: dto.halfDayThresholdMinutes,
      overtimeThresholdMinutes: dto.overtimeThresholdMinutes,
      overtimeRequiresApproval: dto.overtimeRequiresApproval,
      absentCutoffMinutes: dto.absentCutoffMinutes,
      allowedCheckinMethods: dto.allowedCheckinMethods,
    };

    let result;
    if (existing) {
      result = await this.prisma.sms_attendancePolicies.update({
        where: { id: existing.id },
        data,
      });
      await AttendanceAccessHelper.recordAuditLog(
        this.prisma,
        organizationId,
        user.id,
        'attendance_policy.update_branch_override',
        existing,
        result,
      );
    } else {
      result = await this.prisma.sms_attendancePolicies.create({
        data: {
          organizationId,
          branchId,
          ...data,
        },
      });
      await AttendanceAccessHelper.recordAuditLog(
        this.prisma,
        organizationId,
        user.id,
        'attendance_policy.create_branch_override',
        null,
        result,
      );
    }

    return {
      ...result,
      isBranchOverride: true,
      effectiveScope: 'BRANCH_OVERRIDE',
    };
  }

  /**
   * Delete branch override to revert to organization default
   */
  async deleteBranchPolicy(
    organizationId: string,
    branchId: string,
    user: AuthenticatedUser,
  ) {
    const existing = await this.prisma.sms_attendancePolicies.findFirst({
      where: {
        organizationId,
        branchId,
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'POLICY_NOT_FOUND',
        message: 'No branch-specific policy found to remove',
      });
    }

    await this.prisma.sms_attendancePolicies.delete({
      where: { id: existing.id },
    });

    await AttendanceAccessHelper.recordAuditLog(
      this.prisma,
      organizationId,
      user.id,
      'attendance_policy.delete_branch_override',
      existing,
      null,
    );

    return {
      success: true,
      message: 'Branch policy override removed. Inheriting organization default.',
    };
  }

  /**
   * Internal validation of policy constraints
   */
  private validatePolicyDto(dto: SaveAttendancePolicyDto) {
    if (dto.lateGraceMinutes < 0 || dto.lateGraceMinutes > 120) {
      throw new BadRequestException('Late grace minutes must be between 0 and 120.');
    }
    if (dto.earlyExitGraceMinutes < 0 || dto.earlyExitGraceMinutes > 120) {
      throw new BadRequestException('Early exit grace minutes must be between 0 and 120.');
    }
    if (dto.halfDayThresholdMinutes < 60 || dto.halfDayThresholdMinutes > 720) {
      throw new BadRequestException('Half day threshold must be between 60 and 720 minutes.');
    }
    if (dto.absentCutoffMinutes < 30 || dto.absentCutoffMinutes > 480) {
      throw new BadRequestException('Absent cutoff minutes must be between 30 and 480.');
    }
  }
}

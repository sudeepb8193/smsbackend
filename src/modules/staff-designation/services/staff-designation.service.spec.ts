import { Test, TestingModule } from '@nestjs/testing';
import { StaffDesignationService } from './staff-designation.service';
import { PrismaService } from '../../../database/prisma.service';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  sms_staffDesignations_designationType,
  sms_staffSkillRatings_proficiencyLevel,
  sms_staffSkillRatings_verificationStatus,
  sms_commission_type,
} from '@prisma/client';

describe('StaffDesignationService', () => {
  let service: StaffDesignationService;
  let prisma: any;

  const mockOrgId = 'org-uuid-111';
  const mockStaffId = 'staff-uuid-222';
  const mockUserId = 'user-uuid-333';
  const mockOtherUserId = 'user-uuid-444';
  const mockBranchId = 'branch-uuid-555';
  const mockSecondaryBranchId = 'branch-uuid-666';

  const mockStaff = {
    id: mockStaffId,
    organizationId: mockOrgId,
    fullName: 'Sarah Reddy',
    employeeCode: 'EMP001',
    userId: mockUserId,
    homeBranchId: mockBranchId,
    homeBranch: { id: mockBranchId, name: 'Indiranagar Branch', code: 'IND-01', status: 'active' },
    staffBranchAssignments: [
      {
        branchId: mockSecondaryBranchId,
        branch: { id: mockSecondaryBranchId, name: 'Electronic City', code: 'EC-01', status: 'active' },
      },
    ],
    user: { id: mockUserId, email: 'sarah@example.com', displayName: 'Sarah Reddy' },
  };

  beforeEach(async () => {
    prisma = {
      sms_staff: {
        findFirst: jest.fn(),
      },
      sms_staffDesignations: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      sms_staffSkillRatings: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      sms_staffServices: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
      },
      sms_services: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      sms_staffServiceBranchOverrides: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      sms_staffCommissionRates: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      sms_auditLogs: {
        create: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffDesignationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<StaffDesignationService>(StaffDesignationService);
  });

  // =========================================================================
  // ACCESS & SCOPE
  // =========================================================================
  describe('Organization scoping & Access control', () => {
    it('throws NotFoundException if staff is not found in organization', async () => {
      prisma.sms_staff.findFirst.mockResolvedValue(null);
      await expect(
        service.validateStaff('invalid-staff', mockOrgId),
      ).rejects.toThrow(NotFoundException);
    });

    it('denies Service Staff access to another employee record', async () => {
      const staffRecord = { ...mockStaff, userId: 'other-user' };
      const currentUser = { id: mockUserId, roles: ['SERVICE_STAFF'], organizationId: mockOrgId } as any;

      await expect(service.validateAccess(staffRecord, currentUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows Service Staff access to their own record', async () => {
      const currentUser = { id: mockUserId, roles: ['SERVICE_STAFF'], organizationId: mockOrgId } as any;
      await expect(service.validateAccess(mockStaff, currentUser)).resolves.not.toThrow();
    });
  });

  // =========================================================================
  // TASK 6.1: DESIGNATIONS
  // =========================================================================
  describe('Task 6.1: Service Provider Designation', () => {
    it('first designation added is automatically set as Primary', async () => {
      prisma.sms_staff.findFirst.mockResolvedValue(mockStaff);
      prisma.sms_staffDesignations.findFirst.mockResolvedValue(null);
      prisma.sms_staffDesignations.count.mockResolvedValue(0);
      prisma.sms_staffDesignations.create.mockImplementation(({ data }) => Promise.resolve({ id: 'des-1', ...data }));

      const result = await service.createDesignation(mockOrgId, mockStaffId, {
        designationType: sms_staffDesignations_designationType.stylist,
        yearsOfExperience: 5,
      });

      expect(result.isPrimary).toBe(true);
      expect(prisma.sms_staffDesignations.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isPrimary: true }),
        }),
      );
    });

    it('requires custom label when designation is Other', async () => {
      prisma.sms_staff.findFirst.mockResolvedValue(mockStaff);

      await expect(
        service.createDesignation(mockOrgId, mockStaffId, {
          designationType: sms_staffDesignations_designationType.other,
          customLabel: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects duplicate designations for the same employee', async () => {
      prisma.sms_staff.findFirst.mockResolvedValue(mockStaff);
      prisma.sms_staffDesignations.findFirst.mockResolvedValue({ id: 'existing-des' });

      await expect(
        service.createDesignation(mockOrgId, mockStaffId, {
          designationType: sms_staffDesignations_designationType.stylist,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('setting a designation as primary demotes previous primary within transaction', async () => {
      prisma.sms_staff.findFirst.mockResolvedValue(mockStaff);
      prisma.sms_staffDesignations.findFirst.mockResolvedValue({ id: 'des-2', staffId: mockStaffId });
      prisma.sms_staffDesignations.update.mockResolvedValue({ id: 'des-2', isPrimary: true });

      const result = await service.setPrimaryDesignation(mockOrgId, mockStaffId, 'des-2', mockUserId);

      expect(prisma.sms_staffDesignations.updateMany).toHaveBeenCalledWith({
        where: { staffId: mockStaffId },
        data: { isPrimary: false },
      });
      expect(result.isPrimary).toBe(true);
    });

    it('blocks deleting the only designation if staff has active services assigned', async () => {
      prisma.sms_staff.findFirst.mockResolvedValue(mockStaff);
      prisma.sms_staffDesignations.findFirst.mockResolvedValue({ id: 'des-1', isPrimary: true });
      prisma.sms_staffDesignations.count.mockResolvedValue(1);
      prisma.sms_staffServices.count.mockResolvedValue(2); // Has active services

      await expect(
        service.deleteDesignation(mockOrgId, mockStaffId, 'des-1', mockUserId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // TASK 6.2: SKILLS
  // =========================================================================
  describe('Task 6.2: Skill Proficiency & Specialization', () => {
    it('normalizes skill name and prevents case-insensitive duplicates', async () => {
      prisma.sms_staff.findFirst.mockResolvedValue(mockStaff);
      prisma.sms_staffSkillRatings.findFirst.mockResolvedValue({ id: 'existing-skill' });

      await expect(
        service.createSkillRating(
          mockOrgId,
          mockStaffId,
          {
            skillName: '  balayage  ',
            proficiencyLevel: sms_staffSkillRatings_proficiencyLevel.expert,
          },
          { id: mockUserId, roles: ['OWNER'] } as any,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('manager can verify a declared skill, recording verifier and timestamp', async () => {
      prisma.sms_staff.findFirst.mockResolvedValue(mockStaff);
      prisma.sms_staffSkillRatings.findFirst.mockResolvedValue({
        id: 'skill-1',
        verificationStatus: sms_staffSkillRatings_verificationStatus.self_declared,
      });
      prisma.sms_staffSkillRatings.update.mockResolvedValue({
        id: 'skill-1',
        verificationStatus: sms_staffSkillRatings_verificationStatus.manager_verified,
        verifiedById: mockOtherUserId,
      });

      const managerUser = { id: mockOtherUserId, roles: ['BRANCH_MANAGER'] } as any;
      const result = await service.verifySkillRating(
        mockOrgId,
        mockStaffId,
        'skill-1',
        managerUser,
        'Demonstrated excellent technique during evaluation',
      );

      expect(result.verificationStatus).toBe(
        sms_staffSkillRatings_verificationStatus.manager_verified,
      );
      expect(prisma.sms_staffSkillRatings.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            verificationStatus: sms_staffSkillRatings_verificationStatus.manager_verified,
            verifiedById: mockOtherUserId,
          }),
        }),
      );
    });

    it('forbids employees from verifying their own skills', async () => {
      prisma.sms_staff.findFirst.mockResolvedValue(mockStaff);
      const selfUser = { id: mockUserId, roles: ['SERVICE_STAFF', 'BRANCH_MANAGER'] } as any;

      await expect(
        service.verifySkillRating(mockOrgId, mockStaffId, 'skill-1', selfUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // =========================================================================
  // TASK 6.3: SERVICE ASSIGNMENT
  // =========================================================================
  describe('Task 6.3: Service Assignment', () => {
    it('blocks service assignment if employee has no professional designations', async () => {
      prisma.sms_staff.findFirst.mockResolvedValue(mockStaff);
      prisma.sms_staffDesignations.count.mockResolvedValue(0);

      await expect(
        service.assignService(mockOrgId, mockStaffId, { serviceId: 'srv-1' }, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('blocks assignment of inactive services', async () => {
      prisma.sms_staff.findFirst.mockResolvedValue(mockStaff);
      prisma.sms_staffDesignations.count.mockResolvedValue(1);
      prisma.sms_services.findFirst.mockResolvedValue({
        id: 'srv-1',
        name: 'Discontinued Spa Treatment',
        status: 'inactive',
      });

      await expect(
        service.assignService(mockOrgId, mockStaffId, { serviceId: 'srv-1' }, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('assigns active service with duration override and audits', async () => {
      prisma.sms_staff.findFirst.mockResolvedValue(mockStaff);
      prisma.sms_staffDesignations.count.mockResolvedValue(1);
      prisma.sms_services.findFirst.mockResolvedValue({
        id: 'srv-1',
        name: 'Balayage',
        status: 'active',
        baseDurationMinutes: 180,
      });
      prisma.sms_staffServices.findFirst.mockResolvedValue(null);
      prisma.sms_staffServices.upsert.mockResolvedValue({
        id: 'assign-1',
        serviceId: 'srv-1',
        durationOverrideMinutes: 210,
        isActive: true,
      });

      const result = await service.assignService(
        mockOrgId,
        mockStaffId,
        { serviceId: 'srv-1', durationOverrideMinutes: 210 },
        mockUserId,
      );

      expect(result.durationOverrideMinutes).toBe(210);
      expect(prisma.sms_auditLogs.create).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // TASK 6.4: BRANCH-WISE SERVICE AVAILABILITY
  // =========================================================================
  describe('Task 6.4: Branch-Wise Service Availability', () => {
    it('blocks marking a service unavailable at Home Branch when it is employee only branch', async () => {
      const singleBranchStaff = {
        ...mockStaff,
        staffBranchAssignments: [], // only Home branch
      };
      prisma.sms_staff.findFirst.mockResolvedValue(singleBranchStaff);
      prisma.sms_staffServices.findFirst.mockResolvedValue({ id: 'ss-1' });

      await expect(
        service.createOrUpdateBranchOverride(
          mockOrgId,
          mockStaffId,
          'ss-1',
          { branchId: mockBranchId, isAvailable: false },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates branch exception for secondary branch', async () => {
      prisma.sms_staff.findFirst.mockResolvedValue(mockStaff);
      prisma.sms_staffServices.findFirst.mockResolvedValue({ id: 'ss-1' });
      prisma.sms_staffServiceBranchOverrides.findUnique.mockResolvedValue(null);
      prisma.sms_staffServiceBranchOverrides.upsert.mockResolvedValue({
        id: 'override-1',
        branchId: mockSecondaryBranchId,
        isAvailable: false,
        reason: 'Equipment unavailable at this branch',
      });

      const result = await service.createOrUpdateBranchOverride(
        mockOrgId,
        mockStaffId,
        'ss-1',
        {
          branchId: mockSecondaryBranchId,
          isAvailable: false,
          reason: 'Equipment unavailable at this branch',
        },
        mockUserId,
      );

      expect(result.isAvailable).toBe(false);
      expect(result.reason).toBe('Equipment unavailable at this branch');
    });
  });

  // =========================================================================
  // TASK 6.5: COMMISSION ELIGIBILITY & PRECEDENCE
  // =========================================================================
  describe('Task 6.5: Commission Precedence & Validation', () => {
    it('resolves zero / not eligible when staff commission eligibility is disabled', async () => {
      prisma.sms_staff.findFirst.mockResolvedValue(mockStaff);
      prisma.sms_staffCommissionRates.findMany.mockResolvedValue([
        {
          id: 'comm-1',
          serviceId: null,
          isCommissionEligible: false,
          commissionType: sms_commission_type.percentage,
          commissionValue: 12.0,
          effectiveFrom: new Date('2026-01-01'),
          effectiveTo: null,
        },
      ]);
      prisma.sms_staffServices.findMany.mockResolvedValue([
        {
          serviceId: 'srv-1',
          service: { id: 'srv-1', name: 'Haircut', category: { id: 'cat-1', name: 'Hair' } },
        },
      ]);

      const result = await service.getStaffCommissionConfiguration(mockOrgId, mockStaffId);

      expect(result.isCommissionEligible).toBe(false);
      expect(result.resolvedServices[0].isEligible).toBe(false);
      expect(result.resolvedServices[0].source).toBe('not_eligible');
    });

    it('resolves service-specific override over staff-wide default override', async () => {
      prisma.sms_staff.findFirst.mockResolvedValue(mockStaff);
      prisma.sms_staffCommissionRates.findMany.mockResolvedValue([
        // Staff-wide override: 12%
        {
          id: 'comm-staff-wide',
          serviceId: null,
          isCommissionEligible: true,
          commissionType: sms_commission_type.percentage,
          commissionValue: 12.0,
          effectiveFrom: new Date('2026-01-01'),
          effectiveTo: null,
        },
        // Service-specific override for Balayage: 15%
        {
          id: 'comm-service-specific',
          serviceId: 'srv-balayage',
          isCommissionEligible: true,
          commissionType: sms_commission_type.percentage,
          commissionValue: 15.0,
          effectiveFrom: new Date('2026-01-01'),
          effectiveTo: null,
        },
      ]);

      prisma.sms_staffServices.findMany.mockResolvedValue([
        {
          serviceId: 'srv-haircut',
          service: { id: 'srv-haircut', name: 'Haircut', category: { name: 'Hair' } },
        },
        {
          serviceId: 'srv-balayage',
          service: { id: 'srv-balayage', name: 'Balayage', category: { name: 'Hair' } },
        },
      ]);

      const result = await service.getStaffCommissionConfiguration(mockOrgId, mockStaffId);

      const haircut = result.resolvedServices.find((s) => s.serviceId === 'srv-haircut');
      const balayage = result.resolvedServices.find((s) => s.serviceId === 'srv-balayage');

      expect(haircut.effectiveValue).toBe(12.0);
      expect(haircut.source).toBe('staff_override');

      expect(balayage.effectiveValue).toBe(15.0);
      expect(balayage.source).toBe('service_override');
    });

    it('rejects percentage values greater than 100 or less than 0', async () => {
      prisma.sms_staff.findFirst.mockResolvedValue(mockStaff);

      await expect(
        service.createCommissionOverride(mockOrgId, mockStaffId, {
          commissionType: sms_commission_type.percentage,
          commissionValue: 150,
          effectiveFrom: '2026-11-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects overlapping date ranges for the same commission scope', async () => {
      prisma.sms_staff.findFirst.mockResolvedValue(mockStaff);
      prisma.sms_staffCommissionRates.findMany.mockResolvedValue([
        {
          id: 'existing-override',
          staffId: mockStaffId,
          serviceId: null,
          effectiveFrom: new Date('2026-10-01'),
          effectiveTo: new Date('2026-11-30'),
        },
      ]);

      await expect(
        service.createCommissionOverride(mockOrgId, mockStaffId, {
          serviceId: null,
          commissionType: sms_commission_type.percentage,
          commissionValue: 15,
          effectiveFrom: '2026-11-15', // Overlaps existing
          effectiveTo: '2026-12-15',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // PRODUCTION RBAC & SCOPING RULES (SECTION 8 VERIFICATION)
  // =========================================================================
  describe('Production RBAC & Scoping Rules (Section 8 Verification)', () => {
    const ownerUser = {
      id: 'owner-uuid-1',
      organizationId: mockOrgId,
      roles: ['Owner'],
      email: 'owner@salon.com',
      assignedBranchIds: [],
    };

    const branchManagerUser = {
      id: 'manager-uuid-2',
      organizationId: mockOrgId,
      roles: ['Branch Manager'],
      email: 'manager@salon.com',
      assignedBranchIds: [mockBranchId], // Authorized ONLY for mockBranchId
    };

    const serviceStaffUser = {
      id: mockUserId, // Same as mockStaff.userId (Own record)
      organizationId: mockOrgId,
      roles: ['Service Staff'],
      email: 'sarah@example.com',
      assignedBranchIds: [mockBranchId],
    };

    const otherServiceStaffUser = {
      id: mockOtherUserId, // Different user
      organizationId: mockOrgId,
      roles: ['Service Staff'],
      email: 'other@example.com',
      assignedBranchIds: [mockBranchId],
    };

    it('OWNER has unrestricted access across all employees and branches', async () => {
      await expect(
        service.validateAccess(mockStaff, ownerUser as any, 'staff_designation.manage'),
      ).resolves.not.toThrow();
    });

    it('BRANCH_MANAGER is allowed access to staff working in assigned branch', async () => {
      await expect(
        service.validateAccess(mockStaff, branchManagerUser as any, 'staff_designation.view'),
      ).resolves.not.toThrow();
    });

    it('BRANCH_MANAGER is denied access to staff having no assignment in manager branch', async () => {
      const externalStaff = {
        ...mockStaff,
        homeBranchId: 'unassigned-branch-999',
        staffBranchAssignments: [],
      };

      await expect(
        service.validateAccess(externalStaff, branchManagerUser as any, 'staff_designation.view'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('BRANCH_MANAGER is denied modifying branch overrides for unassigned branches', async () => {
      await expect(
        service.validateAccess(
          mockStaff,
          branchManagerUser as any,
          'staff_service_branch.update',
          'unassigned-branch-999',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('SERVICE_STAFF is denied access to other employee records (FORBIDDEN_OWN_RECORD_ONLY)', async () => {
      await expect(
        service.validateAccess(mockStaff, otherServiceStaffUser as any, 'staff_designation.view'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('SERVICE_STAFF is allowed access to their own record', async () => {
      await expect(
        service.validateAccess(mockStaff, serviceStaffUser as any, 'staff_designation.view'),
      ).resolves.not.toThrow();
    });

    it('SERVICE_STAFF is strictly forbidden from self-verifying skills', async () => {
      prisma.sms_staff.findFirst.mockResolvedValue(mockStaff);
      prisma.sms_staffSkillRatings.findFirst.mockResolvedValue({
        id: 'skill-1',
        staffId: mockStaffId,
        skillName: 'Balayage',
        proficiencyLevel: sms_staffSkillRatings_proficiencyLevel.expert,
        verificationStatus: sms_staffSkillRatings_verificationStatus.self_declared,
      });

      await expect(
        service.verifySkillRating(mockOrgId, mockStaffId, 'skill-1', serviceStaffUser as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('SERVICE_STAFF is prohibited from self-assigning services (preventSelfManagement)', () => {
      expect(() => {
        service.preventSelfManagement(mockStaff, serviceStaffUser as any, 'assigning services');
      }).toThrow(ForbiddenException);
    });

    it('SERVICE_STAFF is prohibited from self-modifying designations (preventSelfManagement)', () => {
      expect(() => {
        service.preventSelfManagement(mockStaff, serviceStaffUser as any, 'modifying designations');
      }).toThrow(ForbiddenException);
    });

    it('SERVICE_STAFF is prohibited from self-modifying commission rules (preventSelfManagement)', () => {
      expect(() => {
        service.preventSelfManagement(mockStaff, serviceStaffUser as any, 'modifying commission rates');
      }).toThrow(ForbiddenException);
    });

    it('prevents non-staff from triggering self-management restriction', () => {
      expect(() => {
        service.preventSelfManagement(mockStaff, ownerUser as any, 'modifying commission rates');
      }).not.toThrow();

      expect(() => {
        service.preventSelfManagement(mockStaff, branchManagerUser as any, 'assigning services');
      }).not.toThrow();
    });
  });
});


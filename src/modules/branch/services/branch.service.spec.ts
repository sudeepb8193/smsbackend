import { Test, TestingModule } from '@nestjs/testing';
import { BranchService } from './branch.service';
import { PrismaService } from '../../../database/prisma.service';
import { ConflictException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';

describe('BranchService', () => {
  let service: BranchService;
  let prisma: any;

  const mockUser: AuthenticatedUser = {
    id: 'user-uuid-1',
    email: 'owner@salon.com',
    displayName: 'Owner User',
    organizationId: 'org-uuid-1',
    status: 'active',
    roles: ['owner'],
  };

  const mockBranchManager: AuthenticatedUser = {
    id: 'mgr-uuid-1',
    email: 'manager@salon.com',
    displayName: 'Manager User',
    organizationId: 'org-uuid-1',
    status: 'active',
    roles: ['branch_manager'],
  };

  const mockBranch = {
    id: 'branch-uuid-1',
    organizationId: 'org-uuid-1',
    name: 'Downtown Flagship',
    code: 'BLR-01',
    branchType: 'flagship',
    coverImageUrl: 'https://example.com/cover.jpg',
    status: 'active',
    launchedAt: new Date('2026-01-01'),
    createdById: 'user-uuid-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    prisma = {
      sms_branches: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      sms_organizations: {
        findUnique: jest.fn(),
      },
      sms_branchSettings: {
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
      },
      sms_businessHours: {
        findMany: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      sms_userBranchAssignments: {
        findMany: jest.fn(),
      },
      sms_staff: {
        findFirst: jest.fn(),
        count: jest.fn(),
      },
      sms_staffBranchAssignments: {
        count: jest.fn(),
      },
      sms_customers: {
        count: jest.fn(),
      },
      sms_resources: {
        count: jest.fn(),
      },
      sms_customerPackagePurchases: {
        count: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BranchService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<BranchService>(BranchService);
  });

  describe('normalizeCode', () => {
    it('should trim and uppercase the branch code', () => {
      expect(service.normalizeCode(' blr-01 ')).toBe('BLR-01');
      expect(service.normalizeCode('ind-flag-2')).toBe('IND-FLAG-2');
    });
  });

  describe('generateSuggestedCode', () => {
    it('should suggest next incremented code for BLR-01', async () => {
      prisma.sms_branches.findMany.mockResolvedValue([
        { code: 'BLR-01' },
      ]);
      const suggestion = await service.generateSuggestedCode('org-uuid-1', 'BLR-01');
      expect(suggestion).toBe('BLR-02');
    });

    it('should suggest next incremented code when multiple exist', async () => {
      prisma.sms_branches.findMany.mockResolvedValue([
        { code: 'BLR-01' },
        { code: 'BLR-02' },
        { code: 'BLR-03' },
      ]);
      const suggestion = await service.generateSuggestedCode('org-uuid-1', 'BLR-01');
      expect(suggestion).toBe('BLR-04');
    });
  });

  describe('checkCodeAvailability', () => {
    it('should return available: true when code is unused', async () => {
      prisma.sms_branches.findFirst.mockResolvedValue(null);
      const res = await service.checkCodeAvailability('org-uuid-1', 'NEW-01');
      expect(res.available).toBe(true);
      expect(res.suggestedCode).toBeNull();
    });

    it('should return available: false with suggestion when code is already taken', async () => {
      prisma.sms_branches.findFirst.mockResolvedValue(mockBranch);
      prisma.sms_branches.findMany.mockResolvedValue([{ code: 'BLR-01' }]);
      const res = await service.checkCodeAvailability('org-uuid-1', 'BLR-01');
      expect(res.available).toBe(false);
      expect(res.suggestedCode).toBe('BLR-02');
    });
  });

  describe('create', () => {
    it('should create a branch successfully', async () => {
      prisma.sms_organizations.findUnique.mockResolvedValue({
        id: 'org-uuid-1',
        name: 'My Salon Org',
        status: 'active',
      });
      prisma.sms_branches.findFirst.mockResolvedValue(null);
      prisma.sms_branches.create.mockResolvedValue(mockBranch);

      const res = await service.create(
        {
          name: 'Downtown Flagship',
          code: 'BLR-01',
          branchType: 'flagship',
          coverImageUrl: 'https://example.com/cover.jpg',
          status: 'active',
        },
        mockUser,
      );

      expect(res).toBeDefined();
      expect(res.name).toBe('Downtown Flagship');
      expect(prisma.sms_branches.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-uuid-1',
            name: 'Downtown Flagship',
            code: 'BLR-01',
          }),
        }),
      );
    });

    it('should reject creation if code is already taken and propose a suggested code', async () => {
      prisma.sms_organizations.findUnique.mockResolvedValue({
        id: 'org-uuid-1',
        status: 'active',
      });
      prisma.sms_branches.findFirst.mockResolvedValue(mockBranch);
      prisma.sms_branches.findMany.mockResolvedValue([{ code: 'BLR-01' }]);

      await expect(
        service.create(
          {
            name: 'Another Branch',
            code: 'BLR-01',
          },
          mockUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return paginated branches for active organization', async () => {
      prisma.sms_branches.count.mockResolvedValue(1);
      prisma.sms_branches.findMany.mockResolvedValue([mockBranch]);

      const res = await service.findAll({}, mockUser);
      expect(res.data).toHaveLength(1);
      expect(res.meta.total).toBe(1);
      expect(res.meta.page).toBe(1);
    });

    it('should restrict branch manager to their assigned branches', async () => {
      prisma.sms_userBranchAssignments.findMany.mockResolvedValue([
        { branchId: 'branch-uuid-1' },
      ]);
      prisma.sms_staff.findFirst.mockResolvedValue(null);
      prisma.sms_branches.count.mockResolvedValue(1);
      prisma.sms_branches.findMany.mockResolvedValue([mockBranch]);

      const res = await service.findAll({}, mockBranchManager);
      expect(res.data).toHaveLength(1);
      expect(prisma.sms_branches.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['branch-uuid-1'] },
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return branch profile if found and authorized', async () => {
      prisma.sms_branches.findFirst.mockResolvedValue(mockBranch);

      const res = await service.findOne('branch-uuid-1', mockUser);
      expect(res).toBeDefined();
      expect(res.id).toBe('branch-uuid-1');
    });

    it('should throw NotFoundException if branch does not exist in org', async () => {
      prisma.sms_branches.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('non-existent-id', mockUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if branch manager accesses an unassigned branch', async () => {
      prisma.sms_branches.findFirst.mockResolvedValue(mockBranch);
      prisma.sms_userBranchAssignments.findMany.mockResolvedValue([
        { branchId: 'other-branch-uuid' },
      ]);
      prisma.sms_staff.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('branch-uuid-1', mockBranchManager),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('should update branch profile fields', async () => {
      prisma.sms_branches.findFirst.mockResolvedValue(mockBranch);
      prisma.sms_branches.update.mockResolvedValue({
        ...mockBranch,
        name: 'Updated Name',
      });

      const res = await service.update(
        'branch-uuid-1',
        { name: 'Updated Name' },
        mockUser,
      );

      expect(res.name).toBe('Updated Name');
      expect(prisma.sms_branches.update).toHaveBeenCalled();
    });
  });

  describe('delete & getBlockers', () => {
    it('should report blockers if branch has active staff or dependencies', async () => {
      prisma.sms_branches.findFirst.mockResolvedValue(mockBranch);
      prisma.sms_staff.count.mockResolvedValue(2);
      prisma.sms_staffBranchAssignments.count.mockResolvedValue(1);
      prisma.sms_customers.count.mockResolvedValue(5);
      prisma.sms_resources.count.mockResolvedValue(0);
      prisma.sms_customerPackagePurchases.count.mockResolvedValue(0);

      const blockers = await service.getBlockers('branch-uuid-1', mockUser);
      expect(blockers.canDelete).toBe(false);
      expect(blockers.totalDependencies).toBe(8);
      expect(blockers.recommendedAction).toBe('permanently_closed');
    });

    it('should block deletion when dependencies exist and offer closure', async () => {
      prisma.sms_branches.findFirst.mockResolvedValue(mockBranch);
      prisma.sms_staff.count.mockResolvedValue(1);
      prisma.sms_staffBranchAssignments.count.mockResolvedValue(0);
      prisma.sms_customers.count.mockResolvedValue(0);
      prisma.sms_resources.count.mockResolvedValue(0);
      prisma.sms_customerPackagePurchases.count.mockResolvedValue(0);

      await expect(
        service.delete('branch-uuid-1', mockUser),
      ).rejects.toThrow(ConflictException);
    });

    it('should soft delete branch when no dependencies exist', async () => {
      prisma.sms_branches.findFirst.mockResolvedValue(mockBranch);
      prisma.sms_staff.count.mockResolvedValue(0);
      prisma.sms_staffBranchAssignments.count.mockResolvedValue(0);
      prisma.sms_customers.count.mockResolvedValue(0);
      prisma.sms_resources.count.mockResolvedValue(0);
      prisma.sms_customerPackagePurchases.count.mockResolvedValue(0);
      prisma.sms_branches.update.mockResolvedValue({
        ...mockBranch,
        deletedAt: new Date(),
        status: 'permanently_closed',
      });

      const res = await service.delete('branch-uuid-1', mockUser);
      expect(res.success).toBe(true);
      expect(prisma.sms_branches.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'branch-uuid-1' },
          data: expect.objectContaining({
            status: 'permanently_closed',
          }),
        }),
      );
    });
  });

  describe('copySettings', () => {
    it('should return preview of settings to copy when previewOnly is true', async () => {
      prisma.sms_branches.findFirst
        .mockResolvedValueOnce({
          ...mockBranch,
          id: 'source-uuid',
          branchSettings: {
            onlineBookingEnabled: true,
            maxConcurrentAppointments: 10,
          },
          businessHours: [{ dayOfWeek: 1, isOpen: true }],
        })
        .mockResolvedValueOnce({
          ...mockBranch,
          id: 'target-uuid',
        });

      const res = await service.copySettings(
        'target-uuid',
        { sourceBranchId: 'source-uuid', previewOnly: true },
        mockUser,
      );

      expect(res.preview).toBe(true);
      expect(res.settingsToCopy.hasSettings).toBe(true);
      expect(res.settingsToCopy.businessHoursDaysCount).toBe(1);
    });
  });
});

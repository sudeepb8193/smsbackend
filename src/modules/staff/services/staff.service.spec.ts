import { Test, TestingModule } from '@nestjs/testing';
import { StaffService } from './staff.service';
import { PrismaService } from '../../../database/prisma.service';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import {
  encryptSensitiveData,
  decryptSensitiveData,
  maskNationalId,
} from '../utils/encryption.util';

describe('StaffService', () => {
  let service: StaffService;
  let prisma: any;

  const mockOrgId = 'org-uuid-1';
  const mockUserId = 'user-uuid-1';
  const mockStaffId = 'staff-uuid-1';
  const mockBranchId = 'branch-uuid-1';

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(async (cb) => cb(prisma)),
      sms_staff: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      sms_branches: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      sms_users: {
        findFirst: jest.fn(),
      },
      sms_staffContacts: {
        findFirst: jest.fn(),
        upsert: jest.fn(),
        create: jest.fn(),
      },
      sms_staffEmergencyContacts: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      sms_staffEmploymentHistory: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      sms_staffQualifications: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      sms_staffDocuments: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      sms_staffBranchAssignments: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      sms_auditLogs: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<StaffService>(StaffService);
  });

  describe('Encryption & Masking Utilities', () => {
    it('should encrypt and decrypt sensitive national ID with AES-256-GCM', () => {
      const plainId = '9876-5432-1098';
      const encrypted = encryptSensitiveData(plainId);

      expect(encrypted).not.toEqual(plainId);
      expect(typeof encrypted).toBe('string');

      const decrypted = decryptSensitiveData(encrypted);
      expect(decrypted).toEqual(plainId);
    });

    it('should mask national ID showing only last 4 digits', () => {
      const plainId = '123456789012';
      const masked = maskNationalId(plainId);
      expect(masked).toContain('9012');
      expect(masked).toContain('•');
    });
  });

  describe('Task 5.1: Employee Profile & Identity', () => {
    it('should generate next sequential employee code', async () => {
      prisma.sms_staff.findMany.mockResolvedValue([
        { employeeCode: 'EMP-0001' },
        { employeeCode: 'EMP-0042' },
      ]);

      const code = await service.generateEmployeeCode(mockOrgId, 'EMP');
      expect(code).toBe('EMP-0043');
    });

    it('should prevent employee creation if Home Branch does not belong to organization', async () => {
      prisma.sms_branches.findFirst.mockResolvedValue(null);

      await expect(
        service.create(mockOrgId, mockUserId, {
          fullName: 'Alice Stylist',
          homeBranchId: 'invalid-branch',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should prevent duplicate user account linking', async () => {
      prisma.sms_branches.findFirst.mockResolvedValue({
        id: mockBranchId,
        status: 'active',
      });
      prisma.sms_users.findFirst.mockResolvedValue({
        id: 'target-user',
        organizationId: mockOrgId,
      });
      prisma.sms_staff.findFirst.mockResolvedValue({
        id: 'other-staff',
        fullName: 'Bob Stylist',
        employeeCode: 'EMP-0010',
      });

      await expect(
        service.create(mockOrgId, mockUserId, {
          fullName: 'Alice Stylist',
          homeBranchId: mockBranchId,
          userId: 'target-user',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should soft-delete employee preserving historical records if transactions exist', async () => {
      prisma.sms_staff.findFirst.mockResolvedValue({
        id: mockStaffId,
        fullName: 'Alice Stylist',
        employeeCode: 'EMP-0001',
        _count: { staffAttendance: 5, staffLeaveRequests: 1, staffServices: 10 },
      });
      prisma.sms_staff.update.mockResolvedValue({
        id: mockStaffId,
        employmentStatus: 'terminated',
      });

      const res = await service.remove(mockOrgId, mockStaffId, mockUserId);
      expect(res.softDeleted).toBe(true);
      expect(prisma.sms_staff.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ employmentStatus: 'terminated' }),
        }),
      );
    });
  });

  describe('Task 5.2: Personal Details & National ID Security', () => {
    it('should encrypt National ID when saving contacts and return masked value by default', async () => {
      prisma.sms_staff.findFirst.mockResolvedValue({
        id: mockStaffId,
        staffContacts: null,
      });

      const plainId = 'IND-987654321';
      prisma.sms_staffContacts.upsert.mockResolvedValue({
        id: 'contact-uuid-1',
        staffId: mockStaffId,
        nationalIdNumberEncrypted: encryptSensitiveData(plainId),
      });

      // Mock getContacts lookup
      prisma.sms_staff.findFirst.mockResolvedValue({
        id: mockStaffId,
        staffContacts: {
          id: 'contact-uuid-1',
          nationalIdNumberEncrypted: encryptSensitiveData(plainId),
        },
      });

      const res = await service.upsertContacts(mockOrgId, mockStaffId, {
        personalEmail: 'alice@personal.com',
        nationalIdNumber: plainId,
      });

      expect(res.nationalIdNumberMasked).toContain('4321');
      expect(res.nationalIdNumberEncrypted).toBeUndefined();
    });

    it('should reveal decrypted National ID and log an audit entry', async () => {
      const plainId = 'AADHAAR-9988-1122';
      prisma.sms_staff.findFirst.mockResolvedValue({
        id: mockStaffId,
        fullName: 'Alice Stylist',
        staffContacts: {
          nationalIdNumberEncrypted: encryptSensitiveData(plainId),
        },
      });

      const res = await service.revealNationalId(
        mockOrgId,
        mockStaffId,
        mockUserId,
        '127.0.0.1',
      );

      expect(res.nationalIdNumber).toBe(plainId);
      expect(prisma.sms_auditLogs.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'STAFF_NATIONAL_ID_REVEALED',
            organizationId: mockOrgId,
          }),
        }),
      );
    });
  });

  describe('Task 5.3: Emergency Contacts', () => {
    it('should set first emergency contact as primary', async () => {
      prisma.sms_staff.findFirst.mockResolvedValue({ id: mockStaffId });
      prisma.sms_staffEmergencyContacts.findMany.mockResolvedValue([]);
      prisma.sms_staffEmergencyContacts.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'c1', ...data }),
      );

      const contact = await service.createEmergencyContact(mockOrgId, mockStaffId, {
        contactName: 'Bob Partner',
        phoneNumber: '+919876543210',
      });

      expect(contact.priority).toBe('primary');
    });

    it('should demote existing primary contact when adding a new primary contact', async () => {
      prisma.sms_staff.findFirst.mockResolvedValue({ id: mockStaffId });
      prisma.sms_staffEmergencyContacts.findMany.mockResolvedValue([
        { id: 'c1', priority: 'primary' },
      ]);
      prisma.sms_staffEmergencyContacts.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'c2', ...data }),
      );

      const contact = await service.createEmergencyContact(mockOrgId, mockStaffId, {
        contactName: 'Charlie Sibling',
        phoneNumber: '+919876543211',
        priority: 'primary',
      });

      expect(prisma.sms_staffEmergencyContacts.updateMany).toHaveBeenCalledWith({
        where: { staffId: mockStaffId, priority: 'primary' },
        data: { priority: 'secondary' },
      });
      expect(contact.priority).toBe('primary');
    });
  });

  describe('Task 5.4: Employment & Department History', () => {
    it('should record versioned employment change without overwriting history', async () => {
      prisma.sms_staff.findFirst.mockResolvedValue({ id: mockStaffId });
      prisma.sms_staffEmploymentHistory.create.mockResolvedValue({
        id: 'hist-2',
        staffId: mockStaffId,
        designation: 'Senior Master Stylist',
        department: 'Hair Care',
        changeReason: 'promotion',
        effectiveFrom: new Date('2026-11-01'),
      });

      const res = await service.createEmploymentHistory(mockOrgId, mockStaffId, {
        designation: 'Senior Master Stylist',
        department: 'Hair Care',
        employmentType: 'full_time',
        joiningDate: '2026-01-01',
        effectiveFrom: '2026-11-01',
        changeReason: 'promotion',
      });

      expect(res.designation).toBe('Senior Master Stylist');
      expect(prisma.sms_staffEmploymentHistory.create).toHaveBeenCalled();
    });
  });

  describe('Task 5.5: Skills & Qualifications', () => {
    it('should deduplicate skill tags for the same staff member', async () => {
      prisma.sms_staff.findFirst.mockResolvedValue({ id: mockStaffId });
      prisma.sms_staffQualifications.findFirst.mockResolvedValue({
        id: 'q1',
        title: 'Balayage',
        recordType: 'skill_tag',
      });

      const res = await service.createQualification(mockOrgId, mockStaffId, {
        recordType: 'skill_tag',
        title: 'balayage',
      });

      expect(res.id).toBe('q1');
      expect(prisma.sms_staffQualifications.create).not.toHaveBeenCalled();
    });
  });

  describe('Task 5.6: Document Management & Versioning', () => {
    it('should supersede previous document version when uploading renewal', async () => {
      prisma.sms_staff.findFirst.mockResolvedValue({ id: mockStaffId });
      prisma.sms_staffDocuments.findFirst.mockResolvedValue({
        id: 'doc-old',
        status: 'active',
      });
      prisma.sms_staffDocuments.create.mockResolvedValue({
        id: 'doc-new',
        supersedesDocumentId: 'doc-old',
        status: 'active',
      });

      const doc = await service.createDocument(
        mockOrgId,
        mockStaffId,
        {
          category: 'employment_contract',
          fileName: 'Contract_2026.pdf',
          fileUrl: 'https://storage/contract2026.pdf',
          supersedesDocumentId: 'doc-old',
        },
        mockUserId,
      );

      expect(prisma.sms_staffDocuments.update).toHaveBeenCalledWith({
        where: { id: 'doc-old' },
        data: { status: 'superseded' },
      });
      expect(doc.supersedesDocumentId).toBe('doc-old');
    });
  });

  describe('Task 5.7: Branch Assignment & Transfer', () => {
    it('should prevent duplicate active secondary branch assignments', async () => {
      prisma.sms_staff.findFirst.mockResolvedValue({ id: mockStaffId });
      prisma.sms_branches.findFirst.mockResolvedValue({
        id: mockBranchId,
        name: 'Indiranagar Branch',
        status: 'active',
      });
      prisma.sms_staffBranchAssignments.findFirst.mockResolvedValue({
        id: 'assign-1',
        branchId: mockBranchId,
        effectiveTo: null,
      });

      await expect(
        service.addSecondaryBranch(mockOrgId, mockStaffId, {
          branchId: mockBranchId,
          effectiveFrom: '2026-11-01',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should transfer Home Branch immediately if effective date is today', async () => {
      prisma.sms_staff.findFirst.mockResolvedValue({
        id: mockStaffId,
        homeBranchId: 'branch-old',
        homeBranch: { name: 'Old Branch' },
      });
      prisma.sms_branches.findFirst.mockResolvedValue({
        id: 'branch-new',
        name: 'New Branch',
        status: 'active',
      });

      // Mock findOne for final return
      jest.spyOn(service, 'findOne').mockResolvedValue({
        id: mockStaffId,
        homeBranchId: 'branch-new',
      } as any);

      await service.transferHomeBranch(
        mockOrgId,
        mockStaffId,
        { newBranchId: 'branch-new' },
        mockUserId,
      );

      expect(prisma.sms_staffBranchAssignments.updateMany).toHaveBeenCalled();
      expect(prisma.sms_staffBranchAssignments.create).toHaveBeenCalled();
      expect(prisma.sms_staff.update).toHaveBeenCalledWith({
        where: { id: mockStaffId },
        data: { homeBranchId: 'branch-new' },
      });
    });
  });
});


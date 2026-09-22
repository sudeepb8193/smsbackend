import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationHolidayService } from './organization-holiday.service';
import { PrismaService } from '../../../database/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { sms_holidays_status } from '@prisma/client';

describe('OrganizationHolidayService', () => {
  let service: OrganizationHolidayService;
  let prismaService: any;

  const mockOrgId = 'org-uuid-1';
  const mockUserId = 'user-uuid-1';

  const mockHoliday = {
    id: 'holiday-uuid-1',
    organizationId: mockOrgId,
    branchId: null,
    name: 'New Year Holiday',
    description: 'Annual New Year Celebration',
    holidayDate: new Date(Date.UTC(2026, 0, 1)),
    isRecurringAnnually: true,
    status: sms_holidays_status.active,
    createdById: mockUserId,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    prismaService = {
      sms_branches: {
        findFirst: jest.fn(),
      },
      sms_holidays: {
        create: jest.fn().mockResolvedValue(mockHoliday),
        findMany: jest.fn().mockResolvedValue([mockHoliday]),
        findFirst: jest.fn().mockResolvedValue(mockHoliday),
        update: jest.fn().mockResolvedValue(mockHoliday),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(prismaService)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationHolidayService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<OrganizationHolidayService>(
      OrganizationHolidayService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createHoliday', () => {
    it('should create an organization-wide holiday', async () => {
      prismaService.sms_holidays.findMany.mockResolvedValue([]); // no duplicates

      const dto = {
        name: 'New Year Holiday',
        holidayDate: '2026-01-01',
        isRecurring: true,
      };

      const result = await service.createHoliday(mockOrgId, mockUserId, dto);

      expect(prismaService.sms_holidays.create).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.id).toBe('holiday-uuid-1');
    });

    it('should throw BadRequestException if branch does not belong to organization', async () => {
      prismaService.sms_branches.findFirst.mockResolvedValue(null);

      const dto = {
        name: 'Branch Special Holiday',
        holidayDate: '2026-05-01',
        branchId: 'invalid-branch-uuid',
      };

      await expect(
        service.createHoliday(mockOrgId, mockUserId, dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if duplicate holiday name exists in scope', async () => {
      prismaService.sms_holidays.findMany.mockResolvedValue([mockHoliday]);

      const dto = {
        name: 'New Year Holiday',
        holidayDate: '2026-01-02',
      };

      await expect(
        service.createHoliday(mockOrgId, mockUserId, dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException on recurring date overlap', async () => {
      prismaService.sms_holidays.findMany.mockResolvedValue([mockHoliday]);

      const dto = {
        name: 'Different Name',
        holidayDate: '2027-01-01', // Same Jan 1 date as mockHoliday
        isRecurring: true,
      };

      await expect(
        service.createHoliday(mockOrgId, mockUserId, dto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getHolidays', () => {
    it('should return list of holidays filtered by organization', async () => {
      const result = await service.getHolidays(mockOrgId, {});

      expect(result).toHaveLength(1);
      expect(prismaService.sms_holidays.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: mockOrgId,
            deletedAt: null,
          }),
        }),
      );
    });
  });

  describe('getHolidayById', () => {
    it('should return holiday details when found', async () => {
      const result = await service.getHolidayById(mockOrgId, 'holiday-uuid-1');
      expect(result).toEqual(mockHoliday);
    });

    it('should throw NotFoundException when holiday does not exist', async () => {
      prismaService.sms_holidays.findFirst.mockResolvedValue(null);

      await expect(
        service.getHolidayById(mockOrgId, 'non-existent-uuid'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancelHoliday', () => {
    it('should set status to cancelled', async () => {
      prismaService.sms_holidays.update.mockResolvedValue({
        ...mockHoliday,
        status: sms_holidays_status.cancelled,
      });

      const result = await service.cancelHoliday(mockOrgId, 'holiday-uuid-1');

      expect(prismaService.sms_holidays.update).toHaveBeenCalledWith({
        where: { id: 'holiday-uuid-1' },
        data: { status: sms_holidays_status.cancelled },
      });
      expect(result.status).toBe(sms_holidays_status.cancelled);
    });
  });

  describe('deleteHoliday', () => {
    it('should soft-delete holiday by setting deletedAt', async () => {
      prismaService.sms_holidays.update.mockResolvedValue({
        ...mockHoliday,
        deletedAt: new Date(),
      });

      const result = await service.deleteHoliday(mockOrgId, 'holiday-uuid-1');

      expect(prismaService.sms_holidays.update).toHaveBeenCalledWith({
        where: { id: 'holiday-uuid-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(result.deletedAt).toBeDefined();
    });
  });
});

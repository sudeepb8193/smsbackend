import { Test, TestingModule } from '@nestjs/testing';
import { HolidayService } from './holiday.service';
import { PrismaService } from '../../../database/prisma.service';
import { ConflictException } from '@nestjs/common';

describe('HolidayService (Task 1.7)', () => {
  let service: HolidayService;
  let prisma: any;

  const mockPrisma = {
    smsHoliday: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    smsHolidayOverride: {
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HolidayService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<HolidayService>(HolidayService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('holiday creation & duplicate prevention', () => {
    it('should create an active holiday successfully', async () => {
      mockPrisma.smsHoliday.findMany.mockResolvedValue([]);
      mockPrisma.smsHoliday.create.mockResolvedValue({
        id: 1,
        organizationId: 10,
        name: 'New Year Day',
        holidayDate: new Date('2027-01-01'),
        status: 'active',
      });

      const res = await service.createHoliday(10, {
        name: 'New Year Day',
        holidayDate: '2027-01-01',
      });

      expect(res.name).toBe('New Year Day');
      expect(mockPrisma.smsHoliday.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if duplicate holiday exists for same date', async () => {
      mockPrisma.smsHoliday.findMany.mockResolvedValue([
        {
          id: 1,
          name: 'Christmas',
          holidayDate: new Date('2026-12-25'),
          status: 'active',
          isRecurringAnnually: false,
        },
      ]);

      await expect(
        service.createHoliday(10, {
          name: 'Xmas Celebration',
          holidayDate: '2026-12-25',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('holiday resolution (isHoliday)', () => {
    it('should resolve active org-wide holiday correctly', async () => {
      mockPrisma.smsHoliday.findMany.mockResolvedValue([
        {
          id: 1,
          name: 'Independence Day',
          holidayDate: new Date('2026-07-04'),
          branchId: null,
          isRecurringAnnually: false,
          overrides: [],
        },
      ]);

      const res = await service.isHoliday(10, null, '2026-07-04');
      expect(res.isHoliday).toBe(true);
      expect(res.reason).toBe('Independence Day');
    });

    it('should match recurring annual holiday in future years', async () => {
      mockPrisma.smsHoliday.findMany.mockResolvedValue([
        {
          id: 1,
          name: 'Annual Holiday',
          holidayDate: new Date('2020-05-01'),
          branchId: null,
          isRecurringAnnually: true,
          overrides: [],
        },
      ]);

      const res = await service.isHoliday(10, 1, '2028-05-01');
      expect(res.isHoliday).toBe(true);
      expect(res.reason).toBe('Annual Holiday');
    });

    it('should respect single-year override cancelling a recurring holiday', async () => {
      mockPrisma.smsHoliday.findMany.mockResolvedValue([
        {
          id: 1,
          name: 'Annual Holiday',
          holidayDate: new Date('2020-05-01'),
          branchId: null,
          isRecurringAnnually: true,
          overrides: [{ id: 10, holidayId: 1, year: 2028, isCancelled: true }],
        },
      ]);

      const res = await service.isHoliday(10, 1, '2028-05-01');
      expect(res.isHoliday).toBe(false);
    });
  });
});

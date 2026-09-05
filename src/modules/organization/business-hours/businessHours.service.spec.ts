import { Test, TestingModule } from '@nestjs/testing';
import { BusinessHoursService } from './businessHours.service';
import { PrismaService } from '../../../database/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('BusinessHoursService (Task 1.6)', () => {
  let service: BusinessHoursService;
  let prisma: any;

  const mockPrisma = {
    smsBusinessHours: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessHoursService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<BusinessHoursService>(BusinessHoursService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('business hours schedule validation', () => {
    it('should pass valid daytime opening schedule', () => {
      expect(() =>
        service.validateDaySchedule({
          dayOfWeek: 1,
          isOpen: true,
          openTime: '09:00',
          closeTime: '18:00',
        }),
      ).not.toThrow();
    });

    it('should throw BadRequestException if closeTime <= openTime on normal schedule', () => {
      expect(() =>
        service.validateDaySchedule({
          dayOfWeek: 1,
          isOpen: true,
          openTime: '18:00',
          closeTime: '09:00',
          spansMidnight: false,
        }),
      ).toThrow(BadRequestException);
    });

    it('should allow closeTime < openTime if spansMidnight is true', () => {
      expect(() =>
        service.validateDaySchedule({
          dayOfWeek: 5,
          isOpen: true,
          openTime: '22:00',
          closeTime: '04:00',
          spansMidnight: true,
        }),
      ).not.toThrow();
    });

    it('should throw BadRequestException if break window is outside opening hours', () => {
      expect(() =>
        service.validateDaySchedule({
          dayOfWeek: 1,
          isOpen: true,
          openTime: '09:00',
          closeTime: '17:00',
          breakStartTime: '12:00',
          breakEndTime: '18:00', // 18:00 is after 17:00 closeTime
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('effective business hours resolution', () => {
    it('should prefer branch override if branch override exists', async () => {
      mockPrisma.smsBusinessHours.findFirst.mockResolvedValueOnce({
        id: 2,
        organizationId: 10,
        branchId: 5,
        dayOfWeek: 1,
        openTime: '10:00',
        closeTime: '20:00',
      });

      const res = await service.getEffectiveBusinessHours(10, 5, 1);
      expect(res?.branchId).toBe(5);
      expect(res?.openTime).toBe('10:00');
    });

    it('should fallback to organization default if branch override does not exist', async () => {
      mockPrisma.smsBusinessHours.findFirst
        .mockResolvedValueOnce(null) // no branch override
        .mockResolvedValueOnce({
          id: 1,
          organizationId: 10,
          branchId: null,
          dayOfWeek: 1,
          openTime: '09:00',
          closeTime: '18:00',
        }); // org default

      const res = await service.getEffectiveBusinessHours(10, 5, 1);
      expect(res?.branchId).toBeNull();
      expect(res?.openTime).toBe('09:00');
    });
  });
});

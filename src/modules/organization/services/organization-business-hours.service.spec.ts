import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationBusinessHoursService } from './organization-business-hours.service';
import { PrismaService } from '../../../database/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('OrganizationBusinessHoursService', () => {
  let service: OrganizationBusinessHoursService;
  let prismaService: any;

  const mockOrgId = 'org-uuid-1';

  const mockBusinessHours = [
    {
      id: 'bh-uuid-1',
      organizationId: mockOrgId,
      branchId: null,
      dayOfWeek: 1,
      isOpen: true,
      openTime: '09:00',
      closeTime: '18:00',
      breakStartTime: '13:00',
      breakEndTime: '14:00',
      spansMidnight: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    },
    {
      id: 'bh-uuid-2',
      organizationId: mockOrgId,
      branchId: null,
      dayOfWeek: 2,
      isOpen: true,
      openTime: '09:00',
      closeTime: '18:00',
      breakStartTime: null,
      breakEndTime: null,
      spansMidnight: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    },
  ];

  beforeEach(async () => {
    prismaService = {
      sms_businessHours: {
        findMany: jest.fn().mockResolvedValue(mockBusinessHours),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(mockBusinessHours[0]),
        update: jest.fn().mockResolvedValue(mockBusinessHours[0]),
        count: jest.fn().mockResolvedValue(2),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(prismaService)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationBusinessHoursService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<OrganizationBusinessHoursService>(
      OrganizationBusinessHoursService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getBusinessHours', () => {
    it('should return business hours formatted with days array', async () => {
      prismaService.sms_businessHours.findMany.mockResolvedValue(
        mockBusinessHours,
      );

      const result = await service.getBusinessHours(mockOrgId);

      expect(result).toBeDefined();
      expect(result.scope).toBe('organization');
      expect(result.days).toHaveLength(7);
    });
  });

  describe('updateBusinessHours', () => {
    it('should update business hours successfully for valid input', async () => {
      const dto = {
        days: [
          {
            dayOfWeek: 1,
            isOpen: true,
            openTime: '09:00',
            closeTime: '18:00',
            breakStartTime: '13:00',
            breakEndTime: '14:00',
          },
        ],
      };

      const result = await service.updateBusinessHours(
        mockOrgId,
        undefined,
        dto,
      );

      expect(prismaService.sms_businessHours.create).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.scope).toBe('organization');
    });

    it('should throw BadRequestException on duplicate dayOfWeek in request', async () => {
      const dto = {
        days: [
          {
            dayOfWeek: 1,
            isOpen: true,
            openTime: '09:00',
            closeTime: '18:00',
          },
          {
            dayOfWeek: 1,
            isOpen: false,
          },
        ],
      };

      await expect(
        service.updateBusinessHours(mockOrgId, undefined, dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if openTime/closeTime are missing when isOpen is true', async () => {
      const dto = {
        days: [
          {
            dayOfWeek: 1,
            isOpen: true,
          },
        ],
      };

      await expect(
        service.updateBusinessHours(mockOrgId, undefined, dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if break is configured when store is closed', async () => {
      const dto = {
        days: [
          {
            dayOfWeek: 1,
            isOpen: false,
            breakStartTime: '12:00',
            breakEndTime: '13:00',
          },
        ],
      };

      await expect(
        service.updateBusinessHours(mockOrgId, undefined, dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if break bounds are invalid outside open/close hours', async () => {
      const dto = {
        days: [
          {
            dayOfWeek: 1,
            isOpen: true,
            openTime: '09:00',
            closeTime: '18:00',
            breakStartTime: '08:00', // before open
            breakEndTime: '09:30',
          },
        ],
      };

      await expect(
        service.updateBusinessHours(mockOrgId, undefined, dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should support overnight shifts with spansMidnight = true', async () => {
      const dto = {
        days: [
          {
            dayOfWeek: 5,
            isOpen: true,
            openTime: '20:00',
            closeTime: '04:00',
            breakStartTime: '23:00',
            breakEndTime: '00:00',
          },
        ],
      };

      const result = await service.updateBusinessHours(
        mockOrgId,
        undefined,
        dto,
      );
      expect(result).toBeDefined();
    });
  });

  describe('validateBusinessHoursRequirement', () => {
    it('should return isValid true when at least one day is open', async () => {
      prismaService.sms_businessHours.count.mockResolvedValue(2);

      const res = await service.validateBusinessHoursRequirement(mockOrgId);

      expect(res.isValid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('should return isValid false when no business hours exist or all are closed', async () => {
      prismaService.sms_businessHours.count.mockResolvedValue(0);

      const res = await service.validateBusinessHoursRequirement(mockOrgId);

      expect(res.isValid).toBe(false);
      expect(res.errors[0]).toContain(
        'Organization must configure business hours',
      );
    });
  });
});

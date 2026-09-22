jest.mock('@nestjs/passport', () => ({
  AuthGuard: jest.fn().mockImplementation(
    () =>
      class MockGuard {
        canActivate() {
          return true;
        }
      },
  ),
  PassportModule: { register: jest.fn().mockReturnValue({}) },
}));

jest.mock('../../../auth/guards/jwt-auth.guard', () => ({
  JwtAuthGuard: class MockJwtAuthGuard {
    canActivate() {
      return true;
    }
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationHolidayController } from './organization-holiday.controller';
import { OrganizationHolidayService } from '../services/organization-holiday.service';
import { PrismaService } from '../../../database/prisma.service';
import { Reflector } from '@nestjs/core';
import { sms_holidays_status } from '@prisma/client';

describe('OrganizationHolidayController', () => {
  let controller: OrganizationHolidayController;
  let holidayService: any;

  const mockUser = {
    id: 'user-uuid-1',
    email: 'admin@salon.com',
    displayName: 'Super Admin',
    organizationId: 'org-uuid-1',
    status: 'active',
  };

  const mockHoliday = {
    id: 'holiday-uuid-1',
    organizationId: 'org-uuid-1',
    branchId: null,
    name: 'New Year Holiday',
    holidayDate: '2026-01-01',
    isRecurringAnnually: true,
    status: sms_holidays_status.active,
  };

  beforeEach(async () => {
    holidayService = {
      createHoliday: jest.fn().mockResolvedValue(mockHoliday),
      getHolidays: jest.fn().mockResolvedValue([mockHoliday]),
      getHolidayById: jest.fn().mockResolvedValue(mockHoliday),
      updateHoliday: jest
        .fn()
        .mockResolvedValue({ ...mockHoliday, name: 'Updated Holiday' }),
      cancelHoliday: jest.fn().mockResolvedValue({
        ...mockHoliday,
        status: sms_holidays_status.cancelled,
      }),
      deleteHoliday: jest
        .fn()
        .mockResolvedValue({ ...mockHoliday, deletedAt: new Date() }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationHolidayController],
      providers: [
        { provide: OrganizationHolidayService, useValue: holidayService },
        { provide: PrismaService, useValue: {} },
        Reflector,
      ],
    }).compile();

    controller = module.get<OrganizationHolidayController>(
      OrganizationHolidayController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createOrgHoliday', () => {
    it('should create organization holiday', async () => {
      const dto = {
        name: 'New Year Holiday',
        holidayDate: '2026-01-01',
        isRecurring: true,
      };

      const res = await controller.createOrgHoliday(dto, mockUser);

      expect(res).toEqual(mockHoliday);
      expect(holidayService.createHoliday).toHaveBeenCalledWith(
        'org-uuid-1',
        'user-uuid-1',
        { ...dto, branchId: undefined },
      );
    });
  });

  describe('getOrgHolidays', () => {
    it('should return org holidays', async () => {
      const res = await controller.getOrgHolidays({}, mockUser);

      expect(res).toEqual([mockHoliday]);
      expect(holidayService.getHolidays).toHaveBeenCalledWith('org-uuid-1', {});
    });
  });

  describe('createBranchHoliday', () => {
    it('should create branch holiday', async () => {
      const dto = {
        name: 'Branch Day',
        holidayDate: '2026-06-01',
      };

      const res = await controller.createBranchHoliday(
        'branch-uuid-1',
        dto,
        mockUser,
      );

      expect(res).toEqual(mockHoliday);
      expect(holidayService.createHoliday).toHaveBeenCalledWith(
        'org-uuid-1',
        'user-uuid-1',
        { ...dto, branchId: 'branch-uuid-1' },
      );
    });
  });

  describe('cancelHoliday', () => {
    it('should cancel holiday', async () => {
      const res = await controller.cancelHoliday('holiday-uuid-1', mockUser);

      expect(res.status).toBe(sms_holidays_status.cancelled);
      expect(holidayService.cancelHoliday).toHaveBeenCalledWith(
        'org-uuid-1',
        'holiday-uuid-1',
      );
    });
  });

  describe('deleteHoliday', () => {
    it('should soft delete holiday', async () => {
      await controller.deleteHoliday('holiday-uuid-1', mockUser);

      expect(holidayService.deleteHoliday).toHaveBeenCalledWith(
        'org-uuid-1',
        'holiday-uuid-1',
      );
    });
  });
});

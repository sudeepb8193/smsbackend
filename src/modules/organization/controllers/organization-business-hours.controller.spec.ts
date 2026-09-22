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
import { OrganizationBusinessHoursController } from './organization-business-hours.controller';
import { OrganizationBusinessHoursService } from '../services/organization-business-hours.service';
import { PrismaService } from '../../../database/prisma.service';
import { Reflector } from '@nestjs/core';

describe('OrganizationBusinessHoursController', () => {
  let controller: OrganizationBusinessHoursController;
  let businessHoursService: any;

  const mockUser = {
    id: 'user-uuid-1',
    email: 'admin@salon.com',
    displayName: 'Super Admin',
    organizationId: 'org-uuid-1',
    status: 'active',
  };

  const mockResponse = {
    scope: 'organization',
    branchId: null,
    days: [
      {
        id: 'bh-uuid-1',
        organizationId: 'org-uuid-1',
        branchId: null,
        dayOfWeek: 1,
        isOpen: true,
        openTime: '09:00',
        closeTime: '18:00',
        breakStartTime: null,
        breakEndTime: null,
        spansMidnight: false,
      },
    ],
  };

  beforeEach(async () => {
    businessHoursService = {
      getBusinessHours: jest.fn().mockResolvedValue(mockResponse),
      updateBusinessHours: jest.fn().mockResolvedValue(mockResponse),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationBusinessHoursController],
      providers: [
        {
          provide: OrganizationBusinessHoursService,
          useValue: businessHoursService,
        },
        { provide: PrismaService, useValue: {} },
        Reflector,
      ],
    }).compile();

    controller = module.get<OrganizationBusinessHoursController>(
      OrganizationBusinessHoursController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getOrganizationBusinessHours', () => {
    it('should return org business hours', async () => {
      const res = await controller.getOrganizationBusinessHours(mockUser);
      expect(res).toEqual(mockResponse);
      expect(businessHoursService.getBusinessHours).toHaveBeenCalledWith(
        'org-uuid-1',
        null,
      );
    });
  });

  describe('updateOrganizationBusinessHours', () => {
    it('should update org business hours', async () => {
      const dto = {
        days: [
          {
            dayOfWeek: 1,
            isOpen: true,
            openTime: '09:00',
            closeTime: '18:00',
          },
        ],
      };

      const res = await controller.updateOrganizationBusinessHours(
        dto,
        mockUser,
      );
      expect(res).toEqual(mockResponse);
      expect(businessHoursService.updateBusinessHours).toHaveBeenCalledWith(
        'org-uuid-1',
        null,
        dto,
      );
    });
  });

  describe('getBranchBusinessHours', () => {
    it('should return branch specific business hours', async () => {
      const res = await controller.getBranchBusinessHours(
        'branch-uuid-1',
        mockUser,
      );
      expect(res).toEqual(mockResponse);
      expect(businessHoursService.getBusinessHours).toHaveBeenCalledWith(
        'org-uuid-1',
        'branch-uuid-1',
      );
    });
  });

  describe('updateBranchBusinessHours', () => {
    it('should update branch specific business hours', async () => {
      const dto = {
        days: [
          {
            dayOfWeek: 1,
            isOpen: true,
            openTime: '09:00',
            closeTime: '18:00',
          },
        ],
      };

      const res = await controller.updateBranchBusinessHours(
        'branch-uuid-1',
        dto,
        mockUser,
      );
      expect(res).toEqual(mockResponse);
      expect(businessHoursService.updateBusinessHours).toHaveBeenCalledWith(
        'org-uuid-1',
        'branch-uuid-1',
        dto,
      );
    });
  });
});

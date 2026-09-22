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
import { OrganizationController } from './organization.controller';
import { OrganizationService } from '../services/organization.service';
import { OrganizationLifecycleService } from '../services/organization-lifecycle.service';
import { FileStorageService } from '../services/file-storage.service';
import { PrismaService } from '../../../database/prisma.service';
import { Reflector } from '@nestjs/core';

describe('OrganizationController', () => {
  let controller: OrganizationController;
  let organizationService: any;
  let lifecycleService: any;
  let fileStorageService: any;

  const mockUser = {
    id: 'user-uuid-1',
    email: 'admin@salon.com',
    displayName: 'Super Admin',
    organizationId: 'org-uuid-1',
    status: 'active',
  };

  const mockOrg = {
    id: 'org-uuid-1',
    name: 'Glow Beauty Salon',
    slug: 'glow-beauty-salon',
    status: 'onboarding',
  };

  beforeEach(async () => {
    organizationService = {
      createOrganization: jest.fn().mockResolvedValue(mockOrg),
      getOrganization: jest.fn().mockResolvedValue(mockOrg),
      updateOrganization: jest
        .fn()
        .mockResolvedValue({ ...mockOrg, name: 'Updated Salon' }),
      checkSlugAvailability: jest.fn().mockResolvedValue({
        slug: 'glow-salon',
        available: true,
        suggestions: [],
      }),
    };

    lifecycleService = {
      activateOrganization: jest
        .fn()
        .mockResolvedValue({ ...mockOrg, status: 'active' }),
    };

    fileStorageService = {
      saveAsset: jest
        .fn()
        .mockResolvedValue('/uploads/organizations/logo/test.png'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationController],
      providers: [
        { provide: OrganizationService, useValue: organizationService },
        { provide: OrganizationLifecycleService, useValue: lifecycleService },
        { provide: FileStorageService, useValue: fileStorageService },
        { provide: PrismaService, useValue: {} },
        Reflector,
      ],
    }).compile();

    controller = module.get<OrganizationController>(OrganizationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createOrganization', () => {
    it('should create an organization and return result directly', async () => {
      const dto = { name: 'Glow Beauty Salon' };
      const res = await controller.createOrganization(dto, mockUser);

      expect(res).toEqual(mockOrg);
      expect(organizationService.createOrganization).toHaveBeenCalledWith(
        dto,
        'user-uuid-1',
      );
    });
  });

  describe('getCurrentOrganization', () => {
    it('should return tenant organization profile', async () => {
      const res = await controller.getCurrentOrganization(mockUser);

      expect(res).toEqual(mockOrg);
      expect(organizationService.getOrganization).toHaveBeenCalledWith(
        'org-uuid-1',
      );
    });
  });

  describe('updateCurrentOrganization', () => {
    it('should update organization for current tenant', async () => {
      const dto = { name: 'Updated Salon' };
      const res = await controller.updateCurrentOrganization(dto, mockUser);

      expect(res.name).toBe('Updated Salon');
      expect(organizationService.updateOrganization).toHaveBeenCalledWith(
        'org-uuid-1',
        dto,
      );
    });
  });

  describe('checkSlugAvailability', () => {
    it('should return availability info', async () => {
      const query = { slug: 'glow-salon' };
      const req = { user: mockUser };
      const res = await controller.checkSlugAvailability(query, req);

      expect(res.available).toBe(true);
      expect(organizationService.checkSlugAvailability).toHaveBeenCalledWith(
        'glow-salon',
        'org-uuid-1',
      );
    });
  });

  describe('activateOrganization', () => {
    it('should activate organization status', async () => {
      const res = await controller.activateOrganization(mockUser);

      expect(res.status).toBe('active');
      expect(lifecycleService.activateOrganization).toHaveBeenCalledWith(
        'org-uuid-1',
      );
    });
  });
});

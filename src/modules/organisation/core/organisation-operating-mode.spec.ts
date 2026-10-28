import { Test, TestingModule } from '@nestjs/testing';
import { OrganisationService } from './organisation.service';
import { OrganisationRepository } from '../organisation.repository';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('OrganisationService - Operating Mode Management', () => {
  let service: OrganisationService;
  let repository: any;

  beforeEach(async () => {
    repository = {
      findByCode: jest.fn(),
      findUserByEmail: jest.fn(),
      findByEmail: jest.fn(),
      findBySlug: jest.fn(),
      findById: jest.fn(),
      createWithTransaction: jest.fn(),
      updateWithTransaction: jest.fn(),
      createAuditLog: jest.fn(),
      findMany: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganisationService,
        { provide: OrganisationRepository, useValue: repository },
      ],
    }).compile();

    service = module.get<OrganisationService>(OrganisationService);
  });

  describe('create organisation with operating modes', () => {
    const baseDto = {
      name: 'Luxe Salon',
      code: 'LUXE01',
      email: 'contact@luxesalon.com',
      phone: '9876543210',
      businessType: 'hair_salon' as any,
      ownerName: 'Jane Doe',
      ownerEmail: 'jane@luxesalon.com',
      ownerPhone: '9876543210',
      ownerPassword: 'Password123!',
      subscriptionPlan: 'Growth',
      subscriptionStartDate: '2026-01-01',
      subscriptionEndDate: '2027-01-01',
    };

    it('should create an organisation with INDIVIDUAL_WEBSITE operating mode', async () => {
      repository.findByCode.mockResolvedValue(null);
      repository.findUserByEmail.mockResolvedValue(null);
      repository.findByEmail.mockResolvedValue(null);
      repository.findBySlug.mockResolvedValue(null);
      repository.createWithTransaction.mockResolvedValue({
        org: {
          id: 'org-ind-1',
          name: 'Luxe Salon',
          code: 'LUXE01',
          operatingMode: 'INDIVIDUAL_WEBSITE',
          marketplaceListingStatus: 'draft',
        },
      });

      const result = await service.create(
        { ...baseDto, operatingMode: 'INDIVIDUAL_WEBSITE' as any },
        'super-admin-1',
      );

      expect(result.organisation.id).toBe('org-ind-1');
      expect(repository.createWithTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          orgData: expect.objectContaining({
            operatingMode: 'INDIVIDUAL_WEBSITE',
          }),
        }),
      );
    });

    it('should create an organisation with CENTRAL_MARKETPLACE operating mode', async () => {
      repository.findByCode.mockResolvedValue(null);
      repository.findUserByEmail.mockResolvedValue(null);
      repository.findByEmail.mockResolvedValue(null);
      repository.findBySlug.mockResolvedValue(null);
      repository.createWithTransaction.mockResolvedValue({
        org: {
          id: 'org-mkt-1',
          name: 'Marketplace Salon',
          code: 'MKT01',
          operatingMode: 'CENTRAL_MARKETPLACE',
          marketplaceListingStatus: 'draft',
        },
      });

      const result = await service.create(
        { ...baseDto, code: 'MKT01', operatingMode: 'CENTRAL_MARKETPLACE' as any },
        'super-admin-1',
      );

      expect(result.organisation.id).toBe('org-mkt-1');
      expect(repository.createWithTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          orgData: expect.objectContaining({
            operatingMode: 'CENTRAL_MARKETPLACE',
          }),
        }),
      );
    });
  });

  describe('update operating mode & audit logging', () => {
    const existingOrg = {
      id: 'org-test-1',
      name: 'Existing Salon',
      code: 'EX01',
      status: 'active',
      email: 'ex@salon.com',
      operatingMode: 'INDIVIDUAL_WEBSITE',
      marketplaceListingStatus: 'draft',
      organizationAddresses: [],
    };

    it('should update operating mode and log ORGANISATION_OPERATING_MODE_CHANGED audit log', async () => {
      repository.findById.mockResolvedValue(existingOrg);
      repository.updateWithTransaction.mockResolvedValue({
        ...existingOrg,
        operatingMode: 'CENTRAL_MARKETPLACE',
      });

      await service.update(
        'org-test-1',
        { operatingMode: 'CENTRAL_MARKETPLACE' as any },
        'super-admin-user',
        '127.0.0.1',
      );

      expect(repository.updateWithTransaction).toHaveBeenCalledWith(
        'org-test-1',
        expect.objectContaining({
          orgData: expect.objectContaining({
            operatingMode: 'CENTRAL_MARKETPLACE',
          }),
        }),
      );

      expect(repository.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-test-1',
          action: 'ORGANISATION_OPERATING_MODE_CHANGED',
          oldValue: { operatingMode: 'INDIVIDUAL_WEBSITE' },
          newValue: { operatingMode: 'CENTRAL_MARKETPLACE' },
          performedById: 'super-admin-user',
          ipAddress: '127.0.0.1',
        }),
      );
    });

    it('should not emit duplicate audit log when operating mode remains unchanged', async () => {
      repository.findById.mockResolvedValue(existingOrg);
      repository.updateWithTransaction.mockResolvedValue(existingOrg);

      await service.update(
        'org-test-1',
        { operatingMode: 'INDIVIDUAL_WEBSITE' as any },
        'super-admin-user',
        '127.0.0.1',
      );

      expect(repository.createAuditLog).not.toHaveBeenCalled();
    });

    it('should preserve existing organization data without modifying branches or contacts', async () => {
      repository.findById.mockResolvedValue(existingOrg);
      repository.updateWithTransaction.mockResolvedValue({
        ...existingOrg,
        operatingMode: 'CENTRAL_MARKETPLACE',
      });

      await service.update('org-test-1', {
        operatingMode: 'CENTRAL_MARKETPLACE' as any,
      });

      // Verify repository update does not pass destructive operations
      const callArgs = repository.updateWithTransaction.mock.calls[0][1];
      expect(callArgs.subscriptionData).toBeNull();
      expect(callArgs.addressData).toBeNull();
      expect(callArgs.settingsData).toBeNull();
      expect(callArgs.orgData).toEqual({ operatingMode: 'CENTRAL_MARKETPLACE' });
    });
  });

  describe('query organisations by operatingMode', () => {
    it('should pass operatingMode filter to repository findMany', async () => {
      repository.findMany.mockResolvedValue({
        data: [{ id: 'org-1', operatingMode: 'INDIVIDUAL_WEBSITE' }],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      });

      const res = await service.findAll({
        operatingMode: 'INDIVIDUAL_WEBSITE' as any,
        page: 1,
        limit: 10,
      });

      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          operatingMode: 'INDIVIDUAL_WEBSITE',
        }),
      );
      expect(res.data.length).toBe(1);
    });
  });
});

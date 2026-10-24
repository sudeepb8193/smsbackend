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
import { BranchController } from './branch.controller';
import { BranchService } from '../services/branch.service';
import { PrismaService } from '../../../database/prisma.service';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';

describe('BranchController', () => {
  let controller: BranchController;
  let service: any;

  const mockUser: AuthenticatedUser = {
    id: 'user-uuid-1',
    email: 'owner@salon.com',
    displayName: 'Owner User',
    organizationId: 'org-uuid-1',
    status: 'active',
    roles: ['owner'],
  };

  const mockReq: any = {
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
  };

  beforeEach(async () => {
    service = {
      findAll: jest.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
      findOne: jest.fn().mockResolvedValue({ id: 'branch-1', name: 'Main Branch' }),
      create: jest.fn().mockResolvedValue({ id: 'branch-1', name: 'New Branch' }),
      update: jest.fn().mockResolvedValue({ id: 'branch-1', name: 'Updated Branch' }),
      delete: jest.fn().mockResolvedValue({ success: true }),
      getBlockers: jest.fn().mockResolvedValue({ canDelete: true, blockers: {} }),
      checkCodeAvailability: jest.fn().mockResolvedValue({ available: true, code: 'BLR-01' }),
      copySettings: jest.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BranchController],
      providers: [
        {
          provide: BranchService,
          useValue: service,
        },
        {
          provide: PrismaService,
          useValue: {},
        },
        Reflector,
      ],
    }).compile();

    controller = module.get<BranchController>(BranchController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should call branchService.findAll with query and user', async () => {
      const query = { page: 1, limit: 10 };
      await controller.findAll(query, mockUser);
      expect(service.findAll).toHaveBeenCalledWith(query, mockUser);
    });
  });

  describe('create', () => {
    it('should call branchService.create with dto, user and clientIp', async () => {
      const dto = { name: 'Main Branch', code: 'BLR-01' };
      await controller.create(dto, mockUser, mockReq);
      expect(service.create).toHaveBeenCalledWith(dto, mockUser, '127.0.0.1');
    });
  });

  describe('findOne', () => {
    it('should call branchService.findOne with id and user', async () => {
      await controller.findOne('branch-1', mockUser);
      expect(service.findOne).toHaveBeenCalledWith('branch-1', mockUser);
    });
  });

  describe('update', () => {
    it('should call branchService.update with id, dto, user and clientIp', async () => {
      const dto = { name: 'New Name' };
      await controller.update('branch-1', dto, mockUser, mockReq);
      expect(service.update).toHaveBeenCalledWith('branch-1', dto, mockUser, '127.0.0.1');
    });
  });

  describe('delete', () => {
    it('should call branchService.delete with id, user and clientIp', async () => {
      await controller.delete('branch-1', mockUser, mockReq);
      expect(service.delete).toHaveBeenCalledWith('branch-1', mockUser, '127.0.0.1');
    });
  });

  describe('checkCode', () => {
    it('should call branchService.checkCodeAvailability', async () => {
      await controller.checkCode('BLR-01', mockUser);
      expect(service.checkCodeAvailability).toHaveBeenCalledWith('org-uuid-1', 'BLR-01');
    });
  });

  describe('getBlockers', () => {
    it('should call branchService.getBlockers with id and user', async () => {
      await controller.getBlockers('branch-1', mockUser);
      expect(service.getBlockers).toHaveBeenCalledWith('branch-1', mockUser);
    });
  });

  describe('copySettings', () => {
    it('should call branchService.copySettings with id, dto and user', async () => {
      const dto = { sourceBranchId: 'source-1' };
      await controller.copySettings('target-1', dto, mockUser);
      expect(service.copySettings).toHaveBeenCalledWith('target-1', dto, mockUser);
    });
  });
});

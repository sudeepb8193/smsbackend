import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn().mockImplementation(() => ({
    sign: jest.fn().mockReturnValue('mocked_jwt_token'),
    verify: jest.fn(),
  })),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: any;
  let jwtService: any;

  const mockUser = {
    id: 'user-uuid-1',
    organizationId: 'org-uuid-10',
    displayName: 'Sarah Owner',
    email: 'owner@salon.com',
    passwordHash: '$2b$12$eImiTXuWVxfM37uY4JANjO5E/u28d541J/7a149g086g.037',
    status: 'active',
    lastLoginAt: new Date(),
  };

  const mockOrg = {
    id: 'org-uuid-10',
    name: 'Elegance Salon',
    slug: 'elegance-salon',
    status: 'onboarding',
  };

  const mockRole = {
    id: 'role-uuid-100',
    name: 'Owner',
    slug: 'owner',
  };

  beforeEach(async () => {
    prismaService = {
      sms_organizations: {
        findUnique: jest.fn(),
      },
      sms_users: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockImplementation(async () => {
          const first = await prismaService.sms_users.findFirst();
          return first ? [first] : [];
        }),
        findUnique: jest.fn().mockResolvedValue({
          ...mockUser,
          userRolesAssignedToMe: [{ isPrimary: true, role: mockRole }],
          organization: mockOrg,
        }),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mocked_jwt_token'),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should create customer user and assign Customer role, returning tokens', async () => {
      const mockCustomerRole = {
        id: 'role-customer-1',
        name: 'Customer',
        slug: 'customer',
      };
      const mockCustomerUser = {
        id: 'user-uuid-1',
        displayName: 'Jane Customer',
        email: 'customer@gmail.com',
        organizationId: 'org-uuid-10',
      };

      prismaService.sms_organizations.findFirst = jest.fn().mockResolvedValue(mockOrg);

      prismaService.$transaction.mockImplementation((callback: any) => {
        const tx = {
          sms_organizations: {
            findFirst: jest.fn().mockResolvedValue(mockOrg),
            create: jest.fn().mockResolvedValue(mockOrg),
          },
          sms_users: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockCustomerUser),
          },
          sms_roles: {
            findFirst: jest.fn().mockResolvedValue(mockCustomerRole),
            create: jest.fn().mockResolvedValue(mockCustomerRole),
          },
          sms_userRoles: { create: jest.fn().mockResolvedValue({}) },
          sms_customers: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      const dto = {
        fullName: 'Jane Customer',
        email: 'customer@gmail.com',
        password: 'Password123',
        phoneNumber: '555-123-4567',
      };

      const result = await service.register(dto);

      expect(result).toBeDefined();
      expect(result.accessToken).toBe('mocked_jwt_token');
      expect(result.refreshToken).toBe('mocked_jwt_token');
    });

    it('should ignore any client-supplied role or admin privileges and always enforce Customer role', async () => {
      const mockCustomerRole = {
        id: 'role-customer-1',
        name: 'Customer',
        slug: 'customer',
      };
      const userRolesCreated: any[] = [];

      prismaService.sms_organizations.findFirst = jest.fn().mockResolvedValue(mockOrg);

      prismaService.$transaction.mockImplementation((callback: any) => {
        const tx = {
          sms_organizations: {
            findFirst: jest.fn().mockResolvedValue(mockOrg),
            create: jest.fn().mockResolvedValue(mockOrg),
          },
          sms_users: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockImplementation((args: any) => ({
              ...args.data,
              id: 'user-uuid-customer',
            })),
          },
          sms_roles: {
            findFirst: jest.fn().mockResolvedValue(mockCustomerRole),
          },
          sms_userRoles: {
            create: jest.fn().mockImplementation((args: any) => {
              userRolesCreated.push(args.data);
              return args.data;
            }),
          },
          sms_customers: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      // Malicious attempt to register as Owner or Admin
      const maliciousDto: any = {
        fullName: 'Attacker Attempting Owner',
        email: 'attacker@test.com',
        password: 'Password123',
        role: 'OWNER',
        roles: ['SUPER_ADMIN', 'OWNER'],
        isAdmin: true,
        isOwner: true,
      };

      await service.register(maliciousDto);

      // Verify that user role created was ONLY the Customer role
      expect(userRolesCreated).toHaveLength(1);
      expect(userRolesCreated[0].roleId).toBe('role-customer-1');
    });

    it('should throw ConflictException if user with email already exists in new transaction', async () => {
      prismaService.$transaction.mockImplementation((callback: any) => {
        const tx = {
          sms_organizations: {
            findFirst: jest.fn().mockResolvedValue(mockOrg),
            create: jest.fn().mockResolvedValue(mockOrg),
          },
          sms_users: {
            findFirst: jest.fn().mockResolvedValue(mockUser),
          },
        };
        return callback(tx);
      });

      const dto = {
        fullName: 'Jane Customer',
        email: 'customer@gmail.com',
        password: 'Password123',
      };

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should authenticate user and return tokens when credentials are valid', async () => {
      const passwordHash = await bcrypt.hash('Password123', 10);
      const userWithHash = { ...mockUser, passwordHash };

      prismaService.sms_users.findFirst.mockResolvedValue(userWithHash);
      prismaService.sms_users.update.mockResolvedValue(userWithHash);

      const dto = { email: 'owner@salon.com', password: 'Password123' };
      const result = await service.login(dto);

      expect(result.user).toMatchObject({
        id: 'user-uuid-1',
        displayName: 'Sarah Owner',
        email: 'owner@salon.com',
        organizationId: 'org-uuid-10',
      });
      expect(result.accessToken).toBe('mocked_jwt_token');
    });

    it('should throw UnauthorizedException with INVALID_CREDENTIALS for wrong password', async () => {
      const passwordHash = await bcrypt.hash('Password123', 10);
      prismaService.sms_users.findFirst.mockResolvedValue({
        ...mockUser,
        passwordHash,
      });

      const dto = { email: 'owner@salon.com', password: 'WrongPassword' };

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException with ACCOUNT_INACTIVE if user is not active', async () => {
      const passwordHash = await bcrypt.hash('Password123', 10);
      prismaService.sms_users.findFirst.mockResolvedValue({
        ...mockUser,
        passwordHash,
        status: 'suspended',
      });

      const dto = { email: 'owner@salon.com', password: 'Password123' };

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('should return new tokens for valid refresh token', async () => {
      jwtService.verify.mockReturnValue({
        sub: 'user-uuid-1',
        organizationId: 'org-uuid-10',
      });
      prismaService.sms_users.findUnique.mockResolvedValue(mockUser);

      const result = await service.refresh({
        refreshToken: 'valid_refresh_token',
      });

      expect(result.accessToken).toBe('mocked_jwt_token');
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('JWT expired');
      });

      await expect(
        service.refresh({ refreshToken: 'invalid_refresh_token' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getProfile', () => {
    it('should return fresh user profile', async () => {
      prismaService.sms_users.findUnique.mockResolvedValue(mockUser);

      const profile = await service.getProfile('user-uuid-1');

      expect(profile).toBeDefined();
      expect(profile.id).toBe('user-uuid-1');
      expect(profile.email).toBe('owner@salon.com');
    });
  });
});

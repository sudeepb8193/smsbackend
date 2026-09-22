import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

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

jest.mock('./guards/jwt-auth.guard', () => ({
  JwtAuthGuard: class MockJwtAuthGuard {
    canActivate() {
      return true;
    }
  },
}));

jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn().mockImplementation(() => ({
    sign: jest.fn().mockReturnValue('mocked_jwt_token'),
    verify: jest.fn(),
  })),
}));

describe('AuthController', () => {
  let controller: AuthController;
  let authService: any;

  const mockUserPayload = {
    user: {
      id: 1,
      displayName: 'Sarah Owner',
      email: 'owner@salon.com',
      organizationId: 10,
    },
    accessToken: 'mock_access',
    refreshToken: 'mock_refresh',
  };

  beforeEach(async () => {
    authService = {
      register: jest.fn().mockResolvedValue(mockUserPayload),
      login: jest.fn().mockResolvedValue(mockUserPayload),
      refresh: jest.fn().mockResolvedValue(mockUserPayload),
      getProfile: jest.fn().mockResolvedValue(mockUserPayload.user),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should call authService.register and return result', async () => {
      const dto = {
        organizationName: 'Elegance Salon',
        fullName: 'Sarah Owner',
        email: 'owner@salon.com',
        password: 'Password123',
      };
      const result = await controller.register(dto);
      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockUserPayload);
    });
  });

  describe('login', () => {
    it('should call authService.login and return result', async () => {
      const dto = { email: 'owner@salon.com', password: 'Password123' };
      const req = { ip: '127.0.0.1', socket: {} } as any;
      const result = await controller.login(dto, req);
      expect(authService.login).toHaveBeenCalledWith(dto, '127.0.0.1');
      expect(result).toEqual(mockUserPayload);
    });
  });

  describe('refresh', () => {
    it('should call authService.refresh and return result', async () => {
      const dto = { refreshToken: 'mock_refresh' };
      const result = await controller.refresh(dto);
      expect(authService.refresh).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockUserPayload);
    });
  });

  describe('getProfile', () => {
    it('should call authService.getProfile with user id from req', async () => {
      const req = { user: { id: 'user-uuid-1' } };
      const result = await controller.getProfile(req);
      expect(authService.getProfile).toHaveBeenCalledWith('user-uuid-1');
      expect(result).toEqual(mockUserPayload.user);
    });
  });
});

import { Controller, Post, Body, Get, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(
    @Req() req: any,
    @Body() body: { email?: string; phoneNumber?: string; identifier?: string; password?: string },
  ) {
    const identifier = body.identifier || body.email || body.phoneNumber;
    if (!identifier || !body.password) {
      throw new UnauthorizedException('Email or phone number and password are required.');
    }
    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    const user = await this.authService.validateUser(identifier, body.password, String(clientIp));
    if (!user) {
      throw new UnauthorizedException('Invalid login credentials.');
    }
    return this.authService.login(user);
  }

  @Post('seed-demo')
  async seedDemo() {
    return this.authService.seedDemoUser();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@CurrentUser() user: any) {
    return user;
  }
}

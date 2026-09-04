import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * PUBLIC ENDPOINT: Accept invitation and set password
   */
  @Post('accept-invite')
  @HttpCode(HttpStatus.OK)
  async acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.usersService.acceptInvitation(dto);
  }

  /**
   * Create a new pending user account
   */
  @UseGuards(JwtAuthGuard, RolesGuard, BranchScopeGuard)
  @Roles(Role.SUPER_ADMIN, Role.BRANCH_MANAGER)
  @Post()
  async createUser(
    @Body() dto: CreateUserDto,
    @CurrentUser() user: any,
  ) {
    return this.usersService.createUser(dto, {
      id: Number(user.id),
      organizationId: Number(user.organizationId),
      role: user.role,
    });
  }

  /**
   * List users in organization with search and pagination
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.BRANCH_MANAGER, Role.ACCOUNTANT)
  @Get()
  async listUsers(
    @CurrentUser('organizationId') organizationId: number,
    @Query() query: UserQueryDto,
  ) {
    return this.usersService.listUsers(Number(organizationId), query);
  }

  /**
   * Get logged-in user's own profile
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getOwnProfile(@CurrentUser() user: any) {
    return this.usersService.getUserById(Number(user.id), Number(user.organizationId));
  }

  /**
   * Self-service change own password
   */
  @UseGuards(JwtAuthGuard)
  @Patch('me/password')
  async changeOwnPassword(
    @CurrentUser() user: any,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(
      Number(user.id),
      Number(user.organizationId),
      dto,
    );
  }

  /**
   * Self-service 2FA status
   */
  @UseGuards(JwtAuthGuard)
  @Get('me/2fa')
  async get2FASettings(@CurrentUser() user: any) {
    return this.usersService.get2FASettings(Number(user.id), Number(user.organizationId));
  }

  /**
   * Self-service toggle 2FA
   */
  @UseGuards(JwtAuthGuard)
  @Post('me/2fa/toggle')
  async toggle2FA(
    @CurrentUser() user: any,
    @Body('enable') enable: boolean,
  ) {
    return this.usersService.toggle2FA(
      Number(user.id),
      Number(user.organizationId),
      Boolean(enable),
    );
  }

  /**
   * Get specific user details
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.BRANCH_MANAGER)
  @Get(':id')
  async getUser(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('organizationId') organizationId: number,
  ) {
    return this.usersService.getUserById(id, Number(organizationId));
  }

  /**
   * Update user details
   */
  @UseGuards(JwtAuthGuard, RolesGuard, BranchScopeGuard)
  @Roles(Role.SUPER_ADMIN, Role.BRANCH_MANAGER)
  @Patch(':id')
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: any,
  ) {
    return this.usersService.updateUser(id, dto, {
      id: Number(user.id),
      organizationId: Number(user.organizationId),
      role: user.role,
    });
  }

  /**
   * Resend user invitation
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.BRANCH_MANAGER)
  @Post(':id/resend-invite')
  async resendInvite(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.usersService.resendInvitation(id, {
      id: Number(user.id),
      organizationId: Number(user.organizationId),
    });
  }

  /**
   * Deactivate user (soft delete)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Post(':id/deactivate')
  async deactivateUser(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.usersService.deactivateUser(id, {
      id: Number(user.id),
      organizationId: Number(user.organizationId),
    });
  }

  /**
   * Reactivate user
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Post(':id/reactivate')
  async reactivateUser(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.usersService.reactivateUser(id, {
      id: Number(user.id),
      organizationId: Number(user.organizationId),
    });
  }
}

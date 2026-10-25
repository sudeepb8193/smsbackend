import { Module } from '@nestjs/common';
import { UserController } from './controllers/user.controller';
import { UserRoleController } from './controllers/user-role.controller';
import { UserService } from './services/user.service';
import { UserRoleService } from './services/user-role.service';
import { PrismaModule } from '../../database/prisma.module';
import { RolesGuard } from '../../common/guards/roles.guard';

@Module({
  imports: [PrismaModule],
  controllers: [UserController, UserRoleController],
  providers: [UserService, UserRoleService, RolesGuard],
  exports: [UserService, UserRoleService],
})
export class UserModule {}


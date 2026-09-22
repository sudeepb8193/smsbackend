import { Module } from '@nestjs/common';
import { UserRoleController } from './controllers/user-role.controller';
import { UserRoleService } from './services/user-role.service';
import { PrismaModule } from '../../database/prisma.module';
import { RolesGuard } from '../../common/guards/roles.guard';

@Module({
  imports: [PrismaModule],
  controllers: [UserRoleController],
  providers: [UserRoleService, RolesGuard],
  exports: [UserRoleService],
})
export class UserModule {}

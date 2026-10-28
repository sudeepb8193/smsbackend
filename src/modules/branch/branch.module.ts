import { Module } from '@nestjs/common';
import { BranchController } from './controllers/branch.controller';
import { BranchService } from './services/branch.service';
import { PrismaModule } from '../../database/prisma.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';

@Module({
  imports: [PrismaModule, RolePermissionModule],
  controllers: [BranchController],
  providers: [BranchService],
  exports: [BranchService],
})
export class BranchModule {}

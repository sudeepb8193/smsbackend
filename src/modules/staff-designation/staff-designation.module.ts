import { Module } from '@nestjs/common';
import { StaffDesignationController } from './controllers/staff-designation.controller';
import { StaffDesignationService } from './services/staff-designation.service';
import { PrismaModule } from '../../database/prisma.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';

@Module({
  imports: [PrismaModule, RolePermissionModule],
  controllers: [StaffDesignationController],
  providers: [StaffDesignationService],
  exports: [StaffDesignationService],
})
export class StaffDesignationModule {}


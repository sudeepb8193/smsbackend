import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { RoleService } from './services/role.service';
import { PermissionService } from './services/permission.service';
import { RolePermissionService } from './services/role-permission.service';
import { StaffOverrideService } from './services/staff-override.service';
import { EffectivePermissionResolverService } from './services/effective-permission-resolver.service';
import { RoleController } from './controllers/role.controller';
import { PermissionController } from './controllers/permission.controller';
import { StaffOverrideController } from './controllers/staff-override.controller';
import { SuperAdminRoleController } from './controllers/super-admin-role.controller';
import { PermissionsGuard } from './guards/permissions.guard';

@Module({
  imports: [PrismaModule],
  controllers: [
    RoleController,
    PermissionController,
    StaffOverrideController,
    SuperAdminRoleController,
  ],
  providers: [
    RoleService,
    PermissionService,
    RolePermissionService,
    StaffOverrideService,
    EffectivePermissionResolverService,
    PermissionsGuard,
  ],
  exports: [
    RoleService,
    PermissionService,
    RolePermissionService,
    StaffOverrideService,
    EffectivePermissionResolverService,
    PermissionsGuard,
  ],
})
export class RolePermissionModule {}

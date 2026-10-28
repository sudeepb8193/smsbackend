import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './database/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './modules/user/user.module';
import { OrganisationModule } from './modules/organisation/core/organisation.module';
import { SharedModule } from './shared/shared.module';
import { RolePermissionModule } from './modules/role-permission/role-permission.module';
import { BranchModule } from './modules/branch/branch.module';
import { PlatformSettingsModule } from './modules/platform-settings/platform-settings.module';
import { BookingChannelModule } from './modules/booking-channel/booking-channel.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    OrganisationModule,
    BranchModule,
    RolePermissionModule,
    PlatformSettingsModule,
    BookingChannelModule,
    SharedModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

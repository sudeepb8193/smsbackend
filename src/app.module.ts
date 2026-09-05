import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './database/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationModule } from './modules/organization/organization.module';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, OrganizationModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

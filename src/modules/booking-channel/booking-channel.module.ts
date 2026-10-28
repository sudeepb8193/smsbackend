import { Module } from '@nestjs/common';
import { BookingChannelService } from './booking-channel.service';
import { BookingChannelController } from './booking-channel.controller';
import { PrismaModule } from '../../database/prisma.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';

@Module({
  imports: [PrismaModule, PlatformSettingsModule],
  controllers: [BookingChannelController],
  providers: [BookingChannelService],
  exports: [BookingChannelService],
})
export class BookingChannelModule {}

import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  BookingChannelService,
  BookingChannel,
} from './booking-channel.service';
import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsOptional,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ValidateBookingChannelDto {
  @IsString()
  @IsNotEmpty({ message: 'organizationId is required' })
  organizationId: string;

  @IsString()
  @IsIn(['direct_website', 'marketplace'], {
    message: 'channel must be either direct_website or marketplace',
  })
  channel: 'direct_website' | 'marketplace';

  @IsString()
  @IsOptional()
  branchId?: string;

  @IsString()
  @IsOptional()
  serviceId?: string;

  @IsString()
  @IsOptional()
  staffId?: string;
}

export class QueryMarketplaceSalonsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}

@Controller()
export class BookingChannelController {
  constructor(
    private readonly bookingChannelService: BookingChannelService,
  ) {}

  /**
   * Validate booking channel availability and permissions
   * POST /api/bookings/validate-channel
   */
  @Post('api/bookings/validate-channel')
  @HttpCode(HttpStatus.OK)
  async validateBookingChannel(@Body() dto: ValidateBookingChannelDto) {
    return this.bookingChannelService.validateBookingChannel(dto);
  }

  /**
   * Central Marketplace salon discovery endpoint
   * GET /api/marketplace/salons
   */
  @Get('api/marketplace/salons')
  @HttpCode(HttpStatus.OK)
  async getMarketplaceSalons(@Query() query: QueryMarketplaceSalonsDto) {
    return this.bookingChannelService.getMarketplaceSalons(query);
  }
}

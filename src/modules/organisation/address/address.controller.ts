import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AddressAutocompleteService } from './address-autocomplete.service';

@Controller('super-admin/organisations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'super-admin')
export class AddressController {
  constructor(
    private readonly addressAutocompleteService: AddressAutocompleteService,
  ) {}

  @Get('address-suggestions')
  @HttpCode(HttpStatus.OK)
  async getAddressSuggestions(
    @Query('input') input: string,
    @Query('country') country: string,
    @Query('sessionToken') sessionToken: string,
  ) {
    return this.addressAutocompleteService.getSuggestions(
      input,
      country,
      sessionToken,
    );
  }

  @Get('address-details')
  @HttpCode(HttpStatus.OK)
  async getAddressDetails(
    @Query('placeId') placeId: string,
    @Query('sessionToken') sessionToken: string,
  ) {
    return this.addressAutocompleteService.getPlaceDetails(
      placeId,
      sessionToken,
    );
  }
}

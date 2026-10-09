import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const COUNTRY_CODES: Record<string, string> = {
  India: 'IN',
  'United States': 'US',
  'United Kingdom': 'GB',
  'United Arab Emirates': 'AE',
  Canada: 'CA',
  Australia: 'AU',
  Singapore: 'SG',
};

interface GooglePlaceComponent {
  longText?: string;
  types?: string[];
}

interface GooglePlacesResponse {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }>;
  addressComponents?: GooglePlaceComponent[];
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
}

@Injectable()
export class AddressAutocompleteService {
  private readonly logger = new Logger(AddressAutocompleteService.name);

  constructor(private readonly configService: ConfigService) {}

  private getApiKey(): string {
    const apiKey = this.configService
      .get<string>('GOOGLE_MAPS_API_KEY')
      ?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException({
        code: 'GOOGLE_PLACES_NOT_CONFIGURED',
        message:
          'Address search is unavailable until GOOGLE_MAPS_API_KEY is configured.',
      });
    }
    return apiKey;
  }

  private async googleRequest(
    url: string,
    apiKey: string,
    fieldMask: string,
    body?: object,
  ): Promise<GooglePlacesResponse> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: body ? 'POST' : 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': fieldMask,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(8000),
      });
    } catch (error) {
      this.logger.warn(
        `Google Places request failed: ${error instanceof Error ? error.name : 'network error'}`,
      );
      throw new BadGatewayException({
        code: 'GOOGLE_PLACES_UNAVAILABLE',
        message:
          'Address search could not reach Google Places. Please try again.',
      });
    }

    if (!response.ok) {
      this.logger.warn(`Google Places returned HTTP ${response.status}.`);
      throw new BadGatewayException({
        code: 'GOOGLE_PLACES_REQUEST_FAILED',
        message:
          'Google Places could not complete the address search. Please check the API configuration and try again.',
      });
    }

    try {
      return (await response.json()) as GooglePlacesResponse;
    } catch {
      throw new BadGatewayException({
        code: 'GOOGLE_PLACES_INVALID_RESPONSE',
        message: 'Google Places returned an unreadable response.',
      });
    }
  }

  async getSuggestions(input: string, country: string, sessionToken: string) {
    const normalizedInput = input?.trim();
    const regionCode = COUNTRY_CODES[country];
    if (
      !normalizedInput ||
      normalizedInput.length < 3 ||
      normalizedInput.length > 200
    ) {
      return { suggestions: [] };
    }
    if (!regionCode) {
      return { suggestions: [] };
    }
    const apiKey = this.getApiKey();
    const response = await this.googleRequest(
      'https://places.googleapis.com/v1/places:autocomplete',
      apiKey,
      'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text',
      {
        input: normalizedInput,
        includedRegionCodes: [regionCode],
        ...(sessionToken ? { sessionToken } : {}),
      },
    );
    const suggestions = response.suggestions
      ? response.suggestions.flatMap(({ placePrediction: prediction }) => {
          if (!prediction?.placeId || !prediction.text?.text) return [];
          return [
            {
              placeId: prediction.placeId,
              primaryText:
                prediction.structuredFormat?.mainText?.text ||
                prediction.text.text,
              secondaryText:
                prediction.structuredFormat?.secondaryText?.text || '',
              description: prediction.text.text,
            },
          ];
        })
      : [];
    return { suggestions };
  }

  async getPlaceDetails(placeId: string, sessionToken: string) {
    if (!/^[A-Za-z0-9_-]{5,256}$/.test(placeId || '')) {
      return null;
    }
    const apiKey = this.getApiKey();
    const url = new URL(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    );
    if (sessionToken) url.searchParams.set('sessionToken', sessionToken);
    const response = await this.googleRequest(
      url.toString(),
      apiKey,
      'addressComponents,formattedAddress,location',
    );
    const components = response.addressComponents || [];
    const component = (...types: string[]) =>
      components.find((item) =>
        types.some((type) => item.types?.includes(type)),
      )?.longText || '';
    const streetNumber = component('street_number');
    const route = component('route');

    return {
      addressLine1:
        [streetNumber, route].filter(Boolean).join(' ') ||
        response.formattedAddress ||
        '',
      addressLine2: component('subpremise', 'premise'),
      city: component(
        'locality',
        'postal_town',
        'sublocality_level_1',
        'administrative_area_level_2',
      ),
      state: component('administrative_area_level_1'),
      postalCode: component('postal_code'),
      country: component('country'),
      latitude:
        typeof response.location?.latitude === 'number'
          ? response.location.latitude
          : null,
      longitude:
        typeof response.location?.longitude === 'number'
          ? response.location.longitude
          : null,
    };
  }
}

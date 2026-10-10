import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { AddressAutocompleteService } from './address-autocomplete.service';

describe('AddressAutocompleteService', () => {
  let service: AddressAutocompleteService;
  let apiKey: string | undefined;

  beforeEach(async () => {
    apiKey = 'test-google-key';
    const module = await Test.createTestingModule({
      providers: [
        AddressAutocompleteService,
        {
          provide: ConfigService,
          useValue: { get: () => apiKey },
        },
      ],
    }).compile();
    service = module.get(AddressAutocompleteService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('limits suggestions to the selected country and normalizes Google predictions', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          suggestions: [
            {
              placePrediction: {
                placeId: 'ChIJ12345',
                text: { text: 'Main Street, Delhi, India' },
                structuredFormat: {
                  mainText: { text: 'Main Street' },
                  secondaryText: { text: 'Delhi, India' },
                },
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    await expect(
      service.getSuggestions('Main Street', 'India', 'session-token'),
    ).resolves.toEqual({
      suggestions: [
        {
          placeId: 'ChIJ12345',
          primaryText: 'Main Street',
          secondaryText: 'Delhi, India',
          description: 'Main Street, Delhi, India',
        },
      ],
    });

    const request = fetchMock.mock.calls[0][1];
    const requestBody = await new Response(request?.body).json();
    expect(requestBody).toMatchObject({
      input: 'Main Street',
      includedRegionCodes: ['IN'],
      sessionToken: 'session-token',
    });
    expect(new Headers(request?.headers).get('X-Goog-Api-Key')).toBe(
      'test-google-key',
    );
  });

  it('maps place details into setup address fields', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          addressComponents: [
            { longText: '221B', types: ['street_number'] },
            { longText: 'Baker Street', types: ['route'] },
            { longText: 'London', types: ['locality'] },
            { longText: 'England', types: ['administrative_area_level_1'] },
            { longText: 'NW1 6XE', types: ['postal_code'] },
            { longText: 'United Kingdom', types: ['country'] },
          ],
          location: { latitude: 51.5237, longitude: -0.1585 },
        }),
        { status: 200 },
      ),
    );

    await expect(
      service.getPlaceDetails('ChIJ12345', 'session-token'),
    ).resolves.toEqual({
      addressLine1: '221B Baker Street',
      addressLine2: '',
      city: 'London',
      state: 'England',
      postalCode: 'NW1 6XE',
      country: 'United Kingdom',
      latitude: 51.5237,
      longitude: -0.1585,
    });
  });

  it('reports missing Google credentials instead of silently disabling search', async () => {
    apiKey = undefined;
    await expect(
      service.getSuggestions('Main Street', 'India', 'session-token'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

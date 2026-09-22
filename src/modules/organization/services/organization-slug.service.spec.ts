import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationSlugService } from './organization-slug.service';
import { PrismaService } from '../../../database/prisma.service';
import { ConflictException } from '@nestjs/common';

describe('OrganizationSlugService', () => {
  let service: OrganizationSlugService;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      sms_organizations: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationSlugService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<OrganizationSlugService>(OrganizationSlugService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('normalizeSlug', () => {
    it('should convert business name to lowercase, trim, and replace spaces with hyphens', () => {
      expect(service.normalizeSlug('Glow Beauty Salon')).toBe(
        'glow-beauty-salon',
      );
      expect(service.normalizeSlug('  My  Awesome  Salon  ')).toBe(
        'my-awesome-salon',
      );
    });

    it('should remove special characters and html tags', () => {
      expect(service.normalizeSlug('Glow & Beauty @ Salon! #1')).toBe(
        'glow-beauty-salon-1',
      );
      expect(service.normalizeSlug('<b>Glow Salon</b>')).toBe('bglow-salonb');
    });

    it('should truncate slug if exceeding 160 characters', () => {
      const longName = 'a'.repeat(200);
      const normalized = service.normalizeSlug(longName);
      expect(normalized.length).toBeLessThanOrEqual(160);
    });
  });

  describe('checkSlugAvailability', () => {
    it('should return available: true when slug does not exist in DB', async () => {
      prismaService.sms_organizations.findFirst.mockResolvedValue(null);

      const result = await service.checkSlugAvailability('glow-salon');

      expect(result.available).toBe(true);
      expect(result.slug).toBe('glow-salon');
      expect(result.suggestions).toEqual([]);
    });

    it('should return available: false with 2-3 suggestions when slug is already taken', async () => {
      prismaService.sms_organizations.findFirst
        .mockResolvedValueOnce({ id: 'org-1', slug: 'glow-salon' }) // check target slug
        .mockResolvedValueOnce(null) // suggestion 1
        .mockResolvedValueOnce(null) // suggestion 2
        .mockResolvedValueOnce(null); // suggestion 3

      const result = await service.checkSlugAvailability('glow-salon');

      expect(result.available).toBe(false);
      expect(result.slug).toBe('glow-salon');
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions[0]).toContain('glow-salon');
    });
  });

  describe('ensureUniqueSlug', () => {
    it('should return normalized slug when available', async () => {
      prismaService.sms_organizations.findFirst.mockResolvedValue(null);

      const slug = await service.ensureUniqueSlug('Glow Beauty Salon');

      expect(slug).toBe('glow-beauty-salon');
    });

    it('should throw ConflictException when slug is taken', async () => {
      prismaService.sms_organizations.findFirst.mockResolvedValue({
        id: 'org-2',
        slug: 'glow-salon',
      });

      await expect(service.ensureUniqueSlug('glow-salon')).rejects.toThrow(
        ConflictException,
      );
    });
  });
});

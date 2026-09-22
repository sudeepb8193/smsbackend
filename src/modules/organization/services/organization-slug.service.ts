import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

export interface SlugAvailabilityResult {
  slug: string;
  available: boolean;
  suggestions: string[];
}

@Injectable()
export class OrganizationSlugService {
  constructor(private prisma: PrismaService) {}

  /**
   * Normalize a string into a clean, URL-safe slug
   */
  normalizeSlug(name: string): string {
    if (!name) return 'salon';

    let slug = name
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove diacritics
      .replace(/[^a-z0-9\s-]/g, '') // remove special characters
      .replace(/[\s_]+/g, '-') // replace spaces and underscores with hyphens
      .replace(/-+/g, '-') // collapse consecutive hyphens
      .replace(/^-+|-+$/g, ''); // trim leading/trailing hyphens

    if (slug.length > 160) {
      slug = slug.substring(0, 160).replace(/-+$/, '');
    }

    return slug || 'salon';
  }

  /**
   * Generate 2–3 available alternative suggestions for a requested slug
   */
  async generateSuggestions(
    baseSlug: string,
    currentOrganizationId?: string,
  ): Promise<string[]> {
    const currentYear = new Date().getFullYear();
    const candidateSuffixes = [
      'official',
      `${currentYear}`,
      'bangalore',
      'hub',
      'studio',
      '1',
      '2',
    ];

    const suggestions: string[] = [];

    for (const suffix of candidateSuffixes) {
      if (suggestions.length >= 3) break;

      const candidate = `${baseSlug}-${suffix}`.substring(0, 160);
      const isAvailable = await this.isSlugAvailable(
        candidate,
        currentOrganizationId,
      );

      if (isAvailable && !suggestions.includes(candidate)) {
        suggestions.push(candidate);
      }
    }

    return suggestions;
  }

  /**
   * Check if a slug is available in the database
   */
  async isSlugAvailable(
    slug: string,
    currentOrganizationId?: string,
  ): Promise<boolean> {
    const existing = await this.prisma.sms_organizations.findFirst({
      where: {
        slug,
        deletedAt: null,
        ...(currentOrganizationId
          ? {
              NOT: {
                id: currentOrganizationId,
              },
            }
          : {}),
      },
    });

    return !existing;
  }

  /**
   * Full debounced availability check returning status and suggestions
   */
  async checkSlugAvailability(
    inputSlug: string,
    currentOrganizationId?: string,
  ): Promise<SlugAvailabilityResult> {
    const slug = this.normalizeSlug(inputSlug);
    const available = await this.isSlugAvailable(slug, currentOrganizationId);

    let suggestions: string[] = [];
    if (!available) {
      suggestions = await this.generateSuggestions(slug, currentOrganizationId);
    }

    return {
      slug,
      available,
      suggestions,
    };
  }

  /**
   * Ensure a unique slug during organization creation or update
   */
  async ensureUniqueSlug(
    requestedSlug: string,
    currentOrganizationId?: string,
  ): Promise<string> {
    const normalized = this.normalizeSlug(requestedSlug);
    const available = await this.isSlugAvailable(
      normalized,
      currentOrganizationId,
    );

    if (!available) {
      const suggestions = await this.generateSuggestions(
        normalized,
        currentOrganizationId,
      );
      throw new ConflictException({
        code: 'SLUG_ALREADY_TAKEN',
        message: `The slug '${normalized}' is already in use by another organization`,
        data: {
          slug: normalized,
          available: false,
          suggestions,
        },
      });
    }

    return normalized;
  }
}

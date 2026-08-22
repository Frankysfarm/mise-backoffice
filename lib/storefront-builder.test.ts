import { describe, expect, it } from 'vitest';
import {
  collectStorefrontReferences,
  createDefaultStorefrontDocument,
  normalizeStorefrontBuilderEnvelope,
  sanitizeStorefrontDocument,
} from './storefront-builder';

describe('storefront builder contract', () => {
  it('sanitizes unsafe links, colors and oversized section data', () => {
    const fallback = createDefaultStorefrontDocument();
    const raw = {
      ...fallback,
      appearance: { ...fallback.appearance, primary: 'red', radius: 999 },
      sections: Array.from({ length: 25 }, (_, index) => ({
        ...fallback.sections[0],
        id: `hero_${index}`,
        imageUrl: index === 0 ? 'javascript:alert(1)' : 'https://cdn.example.test/banner.jpg',
        ctaTarget: index === 0 ? 'data:text/html,bad' : '#speisekarte',
        navigationItems: [{ id: 'safe', label: 'Shop', target: 'javascript:alert(1)' }],
      })),
    };

    const result = sanitizeStorefrontDocument(raw, fallback);
    expect(result.sections).toHaveLength(20);
    expect(result.sections[0].imageUrl).toBe('');
    expect(result.sections[0].ctaTarget).toBe('');
    expect(result.sections[0].navigationItems).toEqual([]);
    expect(result.sections[1].imageUrl).toBe('https://cdn.example.test/banner.jpg');
    expect(result.appearance.primary).toBe(fallback.appearance.primary);
    expect(result.appearance.radius).toBe(36);
  });

  it('keeps draft and published versions separate and collects tenant references', () => {
    const fallback = createDefaultStorefrontDocument();
    fallback.sections[0].productIds = ['product_a'];
    fallback.sections[1].navigationItems = [{ id: 'menu', label: 'Pizza', target: 'category:category_a' }];
    const envelope = normalizeStorefrontBuilderEnvelope({ draft: fallback, published: null }, fallback);

    expect(envelope.published).toBeNull();
    expect(collectStorefrontReferences(envelope.draft)).toEqual({
      productIds: ['product_a'],
      categoryIds: ['category_a'],
    });
  });
});

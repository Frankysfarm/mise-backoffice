export const STOREFRONT_BUILDER_SCHEMA_VERSION = 1 as const;

export const STOREFRONT_SECTION_TYPES = [
  'announcement',
  'navigation',
  'hero',
  'bestsellers',
  'product_rail',
  'category_tiles',
  'image_banner',
  'text',
] as const;

export type StorefrontSectionType = (typeof STOREFRONT_SECTION_TYPES)[number];
export type StorefrontThemeId = 'classic' | 'aurora' | 'noir' | 'mercato' | 'chicken' | 'biss-whitelabel';

export type StorefrontNavigationItem = {
  id: string;
  label: string;
  target: string;
};

export type StorefrontStudioSection = {
  id: string;
  type: StorefrontSectionType;
  enabled: boolean;
  showMobile: boolean;
  showDesktop: boolean;
  kicker: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  ctaLabel: string;
  ctaTarget: string;
  layout: 'compact' | 'cover' | 'split' | 'cards' | 'scroll' | 'grid';
  productIds: string[];
  categoryIds: string[];
  navigationItems: StorefrontNavigationItem[];
  background: string;
  foreground: string;
  accent: string;
};

export type StorefrontStudioDocument = {
  schemaVersion: typeof STOREFRONT_BUILDER_SCHEMA_VERSION;
  revision: number;
  themeId: StorefrontThemeId;
  appearance: {
    primary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    radius: number;
    density: 'compact' | 'comfortable' | 'spacious';
    headingStyle: 'brand' | 'editorial' | 'bold' | 'clean';
  };
  header: {
    sticky: boolean;
    showLogo: boolean;
    showSearch: boolean;
    showAccount: boolean;
    showCart: boolean;
  };
  sections: StorefrontStudioSection[];
  updatedAt: string;
};

export type StorefrontStudioHistoryEntry = {
  id: string;
  publishedAt: string;
  document: StorefrontStudioDocument;
};

export type StorefrontBuilderEnvelope = {
  draft: StorefrontStudioDocument;
  published: StorefrontStudioDocument | null;
  publishedAt: string | null;
  history: StorefrontStudioHistoryEntry[];
};

const SECTION_DEFAULTS: Record<StorefrontSectionType, Pick<StorefrontStudioSection, 'kicker' | 'title' | 'subtitle' | 'layout'>> = {
  announcement: { kicker: '', title: 'Heute frisch für dich', subtitle: '', layout: 'compact' },
  navigation: { kicker: '', title: 'Menü', subtitle: '', layout: 'scroll' },
  hero: { kicker: 'DIREKT BESTELLEN', title: 'Frisch gemacht. Schnell bei dir.', subtitle: 'Entdecke unsere beliebtesten Gerichte.', layout: 'cover' },
  bestsellers: { kicker: 'BELIEBT', title: 'Unsere Bestseller', subtitle: 'Was unsere Gäste gerade lieben.', layout: 'scroll' },
  product_rail: { kicker: 'EMPFOHLEN', title: 'Das passt heute', subtitle: '', layout: 'scroll' },
  category_tiles: { kicker: 'ENTDECKEN', title: 'Worauf hast du Lust?', subtitle: '', layout: 'grid' },
  image_banner: { kicker: 'AKTION', title: 'Nur für kurze Zeit', subtitle: 'Jetzt entdecken und direkt bestellen.', layout: 'split' },
  text: { kicker: 'ÜBER UNS', title: 'Mit Liebe gemacht', subtitle: 'Erzähle deinen Gästen, was deinen Shop besonders macht.', layout: 'compact' },
};

const THEME_IDS = new Set<StorefrontThemeId>(['classic', 'aurora', 'noir', 'mercato', 'chicken', 'biss-whitelabel']);
const SECTION_TYPES = new Set<string>(STOREFRONT_SECTION_TYPES);
const LAYOUTS = new Set(['compact', 'cover', 'split', 'cards', 'scroll', 'grid']);
const DENSITIES = new Set(['compact', 'comfortable', 'spacious']);
const HEADING_STYLES = new Set(['brand', 'editorial', 'bold', 'clean']);

const string = (value: unknown, max = 160) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const bool = (value: unknown, fallback: boolean) => typeof value === 'boolean' ? value : fallback;
const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};
const color = (value: unknown, fallback: string) => {
  const candidate = string(value, 24);
  return /^#[0-9a-f]{6}$/i.test(candidate) ? candidate.toUpperCase() : fallback;
};
const safeId = (value: unknown, fallback: string) => {
  const candidate = string(value, 80);
  return /^[a-zA-Z0-9_-]+$/.test(candidate) ? candidate : fallback;
};
const safeUrl = (value: unknown, max = 600) => {
  const candidate = string(value, max);
  if (!candidate) return '';
  if (candidate.startsWith('/') || candidate.startsWith('#') || candidate.startsWith('https://') || candidate.startsWith('http://') || candidate.startsWith('mailto:') || candidate.startsWith('tel:') || candidate.startsWith('category:')) return candidate;
  return '';
};

export function createStorefrontSection(type: StorefrontSectionType, id = `section_${Date.now().toString(36)}`): StorefrontStudioSection {
  const defaults = SECTION_DEFAULTS[type];
  return {
    id,
    type,
    enabled: true,
    showMobile: true,
    showDesktop: true,
    kicker: defaults.kicker,
    title: defaults.title,
    subtitle: defaults.subtitle,
    imageUrl: '',
    ctaLabel: type === 'hero' || type === 'image_banner' ? 'Jetzt bestellen' : '',
    ctaTarget: '#speisekarte',
    layout: defaults.layout,
    productIds: [],
    categoryIds: [],
    navigationItems: [],
    background: '',
    foreground: '',
    accent: '',
  };
}

export function createDefaultStorefrontDocument(input?: {
  themeId?: unknown;
  primary?: unknown;
  accent?: unknown;
  background?: unknown;
  heroImageUrl?: unknown;
  heroBadge?: unknown;
  heroTitle?: unknown;
  heroSubtitle?: unknown;
}): StorefrontStudioDocument {
  const hero = createStorefrontSection('hero', 'hero_main');
  hero.imageUrl = safeUrl(input?.heroImageUrl);
  hero.kicker = string(input?.heroBadge, 80) || hero.kicker;
  hero.title = string(input?.heroTitle, 120) || hero.title;
  hero.subtitle = string(input?.heroSubtitle, 220) || hero.subtitle;
  return {
    schemaVersion: STOREFRONT_BUILDER_SCHEMA_VERSION,
    revision: 0,
    themeId: THEME_IDS.has(input?.themeId as StorefrontThemeId) ? input?.themeId as StorefrontThemeId : 'classic',
    appearance: {
      primary: color(input?.primary, '#355C45'),
      accent: color(input?.accent, '#D8A52F'),
      background: color(input?.background, '#F7F2E7'),
      surface: '#FFFFFF',
      text: '#17231B',
      radius: 18,
      density: 'comfortable',
      headingStyle: 'brand',
    },
    header: { sticky: true, showLogo: true, showSearch: true, showAccount: true, showCart: true },
    sections: [
      hero,
      createStorefrontSection('navigation', 'navigation_main'),
      createStorefrontSection('bestsellers', 'bestsellers_main'),
    ],
    updatedAt: new Date().toISOString(),
  };
}

export function sanitizeStorefrontSection(value: unknown, index: number): StorefrontStudioSection | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  if (!SECTION_TYPES.has(String(source.type))) return null;
  const type = source.type as StorefrontSectionType;
  const defaults = createStorefrontSection(type, `section_${index + 1}`);
  const navigationItems = Array.isArray(source.navigationItems)
    ? source.navigationItems.slice(0, 12).map((raw, navIndex) => {
        const item = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
        return {
          id: safeId(item.id, `nav_${index}_${navIndex}`),
          label: string(item.label, 40),
          target: safeUrl(item.target, 300),
        };
      }).filter((item) => item.label && item.target)
    : [];
  const uniqueIds = (raw: unknown) => Array.isArray(raw)
    ? [...new Set(raw.map((entry) => string(entry, 80)).filter((entry) => /^[a-zA-Z0-9_-]+$/.test(entry)))].slice(0, 12)
    : [];
  return {
    id: safeId(source.id, `section_${index + 1}`),
    type,
    enabled: bool(source.enabled, true),
    showMobile: bool(source.showMobile, true),
    showDesktop: bool(source.showDesktop, true),
    kicker: string(source.kicker, 80),
    title: string(source.title, 120) || defaults.title,
    subtitle: string(source.subtitle, 320),
    imageUrl: safeUrl(source.imageUrl),
    ctaLabel: string(source.ctaLabel, 48),
    ctaTarget: safeUrl(source.ctaTarget, 300),
    layout: LAYOUTS.has(String(source.layout)) ? source.layout as StorefrontStudioSection['layout'] : defaults.layout,
    productIds: uniqueIds(source.productIds),
    categoryIds: uniqueIds(source.categoryIds),
    navigationItems,
    background: source.background ? color(source.background, '') : '',
    foreground: source.foreground ? color(source.foreground, '') : '',
    accent: source.accent ? color(source.accent, '') : '',
  };
}

export function sanitizeStorefrontDocument(value: unknown, fallback: StorefrontStudioDocument): StorefrontStudioDocument {
  const source = value && typeof value === 'object' ? value as Record<string, any> : {};
  const appearance = source.appearance && typeof source.appearance === 'object' ? source.appearance : {};
  const header = source.header && typeof source.header === 'object' ? source.header : {};
  const sections = Array.isArray(source.sections)
    ? source.sections.slice(0, 20).map(sanitizeStorefrontSection).filter(Boolean) as StorefrontStudioSection[]
    : fallback.sections;
  return {
    schemaVersion: STOREFRONT_BUILDER_SCHEMA_VERSION,
    revision: clamp(source.revision, 0, 1_000_000, fallback.revision),
    themeId: THEME_IDS.has(source.themeId) ? source.themeId : fallback.themeId,
    appearance: {
      primary: color(appearance.primary, fallback.appearance.primary),
      accent: color(appearance.accent, fallback.appearance.accent),
      background: color(appearance.background, fallback.appearance.background),
      surface: color(appearance.surface, fallback.appearance.surface),
      text: color(appearance.text, fallback.appearance.text),
      radius: clamp(appearance.radius, 0, 36, fallback.appearance.radius),
      density: DENSITIES.has(appearance.density) ? appearance.density : fallback.appearance.density,
      headingStyle: HEADING_STYLES.has(appearance.headingStyle) ? appearance.headingStyle : fallback.appearance.headingStyle,
    },
    header: {
      sticky: bool(header.sticky, fallback.header.sticky),
      showLogo: bool(header.showLogo, fallback.header.showLogo),
      showSearch: bool(header.showSearch, fallback.header.showSearch),
      showAccount: bool(header.showAccount, fallback.header.showAccount),
      showCart: bool(header.showCart, fallback.header.showCart),
    },
    sections,
    updatedAt: string(source.updatedAt, 60) || fallback.updatedAt,
  };
}

export function normalizeStorefrontBuilderEnvelope(value: unknown, fallback: StorefrontStudioDocument): StorefrontBuilderEnvelope {
  const source = value && typeof value === 'object' ? value as Record<string, any> : {};
  const draft = sanitizeStorefrontDocument(source.draft, fallback);
  const published = source.published ? sanitizeStorefrontDocument(source.published, fallback) : null;
  const history = Array.isArray(source.history)
    ? source.history.slice(0, 8).map((raw: unknown, index: number) => {
        const entry = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
        return {
          id: safeId(entry.id, `history_${index}`),
          publishedAt: string(entry.publishedAt, 60),
          document: sanitizeStorefrontDocument(entry.document, fallback),
        };
      })
    : [];
  return {
    draft,
    published,
    publishedAt: string(source.publishedAt, 60) || null,
    history,
  };
}

export function collectStorefrontReferences(document: StorefrontStudioDocument) {
  const productIds = new Set<string>();
  const categoryIds = new Set<string>();
  for (const section of document.sections) {
    section.productIds.forEach((id) => productIds.add(id));
    section.categoryIds.forEach((id) => categoryIds.add(id));
    for (const item of section.navigationItems) {
      if (item.target.startsWith('category:')) categoryIds.add(item.target.slice('category:'.length));
    }
  }
  return { productIds: [...productIds], categoryIds: [...categoryIds] };
}

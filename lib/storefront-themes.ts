/**
 * Storefront-Themes — 6 vordefinierte Design-Varianten.
 * Jedes Theme bestimmt: Farben, Hero-Layout, Card-Style, Typo-Gewichtung.
 */

export type ThemeId =
  | 'classic'
  | 'bold'
  | 'minimal'
  | 'farmhouse'
  | 'urban'
  | 'aurora';

export type StorefrontTheme = {
  id: ThemeId;
  name: string;
  description: string;
  preview: {
    background: string;
    accent: string;
    primary: string;
  };
  style: {
    heroLayout: 'editorial' | 'photo' | 'typographic';
    heroBg: string;
    heroText: string;
    heroAccent: string;
    heroShape: 'blobs' | 'geometric' | 'none';

    bgA: string;
    bgB: string;
    text: string;
    textMuted: string;

    cardBg: string;
    cardBorder: string;
    cardRadius: string;
    cardShadow: string;
    cardHover: string;
    itemImageRadius: string;

    plusBtn: string;
    plusBtnText: string;
    qtyBg: string;

    stickyBg: string;
    stickyChipActive: string;
    stickyChipInactive: string;

    ctaBg: string;
    ctaText: string;

    checkoutAccent: string;
    successBg: string;
  };
};

export const THEMES: Record<ThemeId, StorefrontTheme> = {
  classic: {
    id: 'classic',
    name: 'Classic',
    description: 'Warmes Matcha-Noir · editorial · unser Standard. Ideal für Cafés und Handwerk.',
    preview: {
      background: 'linear-gradient(135deg, #14532d 0%, #2d6b45 100%)',
      accent: '#4ae68a',
      primary: '#14532d',
    },
    style: {
      heroLayout: 'editorial',
      heroBg: 'bg-gradient-to-br from-matcha-800 to-matcha-600',
      heroText: 'text-matcha-50',
      heroAccent: 'text-accent',
      heroShape: 'blobs',

      bgA: 'bg-surface',
      bgB: 'bg-white',
      text: 'text-matcha-900',
      textMuted: 'text-matcha-700/70',

      cardBg: 'bg-white',
      cardBorder: 'border-black/10',
      cardRadius: 'rounded-2xl',
      cardShadow: 'shadow-subtle',
      cardHover: 'hover:-translate-y-0.5 hover:shadow-soft',
      itemImageRadius: 'rounded-xl',

      plusBtn: 'bg-matcha-900',
      plusBtnText: 'text-matcha-50',
      qtyBg: 'bg-accent text-matcha-900',

      stickyBg: 'bg-surface/95 backdrop-blur',
      stickyChipActive: 'bg-matcha-900 text-matcha-50',
      stickyChipInactive: 'hover:bg-black/5',

      ctaBg: 'bg-accent',
      ctaText: 'text-matcha-900',

      checkoutAccent: 'ring-matcha-500',
      successBg: 'bg-matcha-900',
    },
  },

  bold: {
    id: 'bold',
    name: 'Bold',
    description: 'Dunkler Look · große Typo · maximaler Food-Fokus. Ideal für Burger-, Pizza-, Grill-Konzepte.',
    preview: {
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
      accent: '#ff5a1f',
      primary: '#000000',
    },
    style: {
      heroLayout: 'photo',
      heroBg: 'bg-black',
      heroText: 'text-white',
      heroAccent: 'text-[#ff5a1f]',
      heroShape: 'geometric',

      bgA: 'bg-white',
      bgB: 'bg-neutral-100',
      text: 'text-black',
      textMuted: 'text-neutral-600',

      cardBg: 'bg-white',
      cardBorder: 'border-black/20',
      cardRadius: 'rounded-none',
      cardShadow: 'shadow-none',
      cardHover: 'hover:bg-neutral-50',
      itemImageRadius: 'rounded-none',

      plusBtn: 'bg-black',
      plusBtnText: 'text-white',
      qtyBg: 'bg-[#ff5a1f] text-white',

      stickyBg: 'bg-black text-white',
      stickyChipActive: 'bg-[#ff5a1f] text-white',
      stickyChipInactive: 'text-white/70 hover:text-white',

      ctaBg: 'bg-[#ff5a1f]',
      ctaText: 'text-white',

      checkoutAccent: 'ring-[#ff5a1f]',
      successBg: 'bg-black',
    },
  },

  minimal: {
    id: 'minimal',
    name: 'Minimal',
    description: 'Reduziert · viel Weiß · subtile Details. Ideal für Fine-Dining, Bistro, Concept-Stores.',
    preview: {
      background: 'linear-gradient(135deg, #f5f5f4 0%, #e7e5e4 100%)',
      accent: '#292524',
      primary: '#fafaf9',
    },
    style: {
      heroLayout: 'typographic',
      heroBg: 'bg-neutral-50',
      heroText: 'text-neutral-900',
      heroAccent: 'text-neutral-900 underline decoration-4 underline-offset-8',
      heroShape: 'none',

      bgA: 'bg-white',
      bgB: 'bg-neutral-50',
      text: 'text-neutral-900',
      textMuted: 'text-neutral-500',

      cardBg: 'bg-white',
      cardBorder: 'border-neutral-200',
      cardRadius: 'rounded-lg',
      cardShadow: 'shadow-none',
      cardHover: 'hover:border-neutral-400',
      itemImageRadius: 'rounded-md',

      plusBtn: 'bg-neutral-900',
      plusBtnText: 'text-white',
      qtyBg: 'bg-neutral-900 text-white',

      stickyBg: 'bg-white/95 backdrop-blur border-b border-neutral-200',
      stickyChipActive: 'bg-neutral-900 text-white',
      stickyChipInactive: 'text-neutral-600 hover:text-neutral-900',

      ctaBg: 'bg-neutral-900',
      ctaText: 'text-white',

      checkoutAccent: 'ring-neutral-900',
      successBg: 'bg-neutral-900',
    },
  },

  /* ─── Neue Themes (von der vorherigen Plattform portiert) ─── */

  farmhouse: {
    id: 'farmhouse',
    name: "Farmhouse",
    description: 'Warm, rustikal, handgemacht. Cream + Tomatenrot + Wiesengrün, Caprasimo Display, hand-drawn Vibe. Für Cafés, Bauernhof-Konzepte, Handwerks-Bäcker.',
    preview: {
      background: 'linear-gradient(135deg, #F8F1E4 0%, #E2D3B7 100%)',
      accent: '#D2463A',
      primary: '#6B8E4E',
    },
    style: {
      heroLayout: 'editorial',
      heroBg: 'bg-gradient-to-br from-[#F8F1E4] via-[#F4E8D4] to-[#E2D3B7]',
      heroText: 'text-[#2B1F17]',
      heroAccent: 'text-[#D2463A]',
      heroShape: 'blobs',

      bgA: 'bg-[#F8F1E4]',
      bgB: 'bg-white',
      text: 'text-[#2B1F17]',
      textMuted: 'text-[#7A6A5C]',

      cardBg: 'bg-white',
      cardBorder: 'border-[#E2D3B7]',
      cardRadius: 'rounded-2xl',
      cardShadow: 'shadow-md shadow-[#D2463A]/5',
      cardHover: 'hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#D2463A]/10',
      itemImageRadius: 'rounded-xl',

      plusBtn: 'bg-[#D2463A]',
      plusBtnText: 'text-white',
      qtyBg: 'bg-[#6B8E4E] text-white',

      stickyBg: 'bg-[#F8F1E4]/95 backdrop-blur border-b border-[#E2D3B7]',
      stickyChipActive: 'bg-[#D2463A] text-white',
      stickyChipInactive: 'text-[#4A3A2C] hover:bg-[#F0E5D0]',

      ctaBg: 'bg-[#D2463A]',
      ctaText: 'text-white',

      checkoutAccent: 'ring-[#D2463A]',
      successBg: 'bg-[#6B8E4E]',
    },
  },

  urban: {
    id: 'urban',
    name: 'Urban Dark',
    description: 'Großstadt-Premium. Schwarze Flächen, neon-grüner Akzent, scharfe Borders, viel Whitespace. Inspiration: Linear, Vercel, Uber Eats.',
    preview: {
      background: 'linear-gradient(135deg, #0A0A0A 0%, #1A1A1A 100%)',
      accent: '#00D964',
      primary: '#00D964',
    },
    style: {
      heroLayout: 'typographic',
      heroBg: 'bg-[#0A0A0A]',
      heroText: 'text-[#FAFAFA]',
      heroAccent: 'text-[#00D964]',
      heroShape: 'geometric',

      bgA: 'bg-[#0A0A0A]',
      bgB: 'bg-[#111111]',
      text: 'text-[#FAFAFA]',
      textMuted: 'text-[#A3A3A3]',

      cardBg: 'bg-[#1A1A1A]',
      cardBorder: 'border-[#262626]',
      cardRadius: 'rounded-xl',
      cardShadow: 'shadow-none',
      cardHover: 'hover:border-[#00D964] hover:bg-[#222222]',
      itemImageRadius: 'rounded-lg',

      plusBtn: 'bg-[#00D964]',
      plusBtnText: 'text-[#0A0A0A]',
      qtyBg: 'bg-[#00D964] text-[#0A0A0A]',

      stickyBg: 'bg-[#0A0A0A]/95 backdrop-blur border-b border-[#262626]',
      stickyChipActive: 'bg-[#00D964] text-[#0A0A0A]',
      stickyChipInactive: 'text-[#A3A3A3] hover:text-[#FAFAFA]',

      ctaBg: 'bg-[#00D964]',
      ctaText: 'text-[#0A0A0A]',

      checkoutAccent: 'ring-[#00D964]',
      successBg: 'bg-[#00D964]',
    },
  },

  aurora: {
    id: 'aurora',
    name: 'Aurora',
    description: 'Apple-inspired clean. Pures Weiß, Indigo-Akzent, sanfte Schatten, refined Typography. Premium-Feeling für Bistro, Sushi, Concept-Stores.',
    preview: {
      background: 'linear-gradient(135deg, #FFFFFF 0%, #EEF2FF 100%)',
      accent: '#4F46E5',
      primary: '#4F46E5',
    },
    style: {
      heroLayout: 'editorial',
      heroBg: 'bg-gradient-to-br from-white via-[#FAFAFA] to-[#EEF2FF]',
      heroText: 'text-[#0A0A0A]',
      heroAccent: 'text-[#4F46E5]',
      heroShape: 'blobs',

      bgA: 'bg-white',
      bgB: 'bg-[#FAFAFA]',
      text: 'text-[#0A0A0A]',
      textMuted: 'text-[#52525B]',

      cardBg: 'bg-white',
      cardBorder: 'border-[#F0F0F0]',
      cardRadius: 'rounded-2xl',
      cardShadow: 'shadow-[0_2px_12px_rgba(79,70,229,0.06)]',
      cardHover: 'hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(79,70,229,0.10)]',
      itemImageRadius: 'rounded-2xl',

      plusBtn: 'bg-[#4F46E5]',
      plusBtnText: 'text-white',
      qtyBg: 'bg-[#4F46E5] text-white',

      stickyBg: 'bg-white/90 backdrop-blur-lg border-b border-[#F0F0F0]',
      stickyChipActive: 'bg-[#4F46E5] text-white shadow-md shadow-[#4F46E5]/30',
      stickyChipInactive: 'text-[#52525B] hover:bg-[#EEF2FF]',

      ctaBg: 'bg-[#4F46E5]',
      ctaText: 'text-white',

      checkoutAccent: 'ring-[#4F46E5]',
      successBg: 'bg-[#10B981]',
    },
  },
};

const VALID_IDS: ThemeId[] = ['classic', 'bold', 'minimal', 'farmhouse', 'urban', 'aurora'];

export function getTheme(id: string | null | undefined): StorefrontTheme {
  if (id && (VALID_IDS as string[]).includes(id)) return THEMES[id as ThemeId];
  return THEMES.classic;
}

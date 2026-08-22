// Deterministische Farb-/Gradient-Zuordnung für Kategorien ohne Produktbilder.
// Statt echter Food-Fotos zeigen wir elegante Verläufe + leichte Noise-Textur.

export type CategoryVisual = {
  gradient: string;
  accent: string;
  ring: string;
  icon: string;
};

const DEFAULT_VISUAL: CategoryVisual = {
  gradient: 'from-matcha-600 via-matcha-500 to-matcha-400',
  accent: 'bg-matcha-700',
  ring: 'ring-matcha-400/40',
  icon: '🍵',
};

// Matches werden per lowercased Kategorie-Namen gemacht.
const MAP: Array<{ test: (name: string) => boolean; visual: CategoryVisual }> = [
  {
    test: (n) => /heiß|heiss|hot|kaffee|coffee|tea|tee|latte|cappucc/.test(n),
    visual: {
      gradient: 'from-amber-700 via-amber-600 to-orange-500',
      accent: 'bg-amber-700',
      ring: 'ring-amber-500/40',
      icon: '☕',
    },
  },
  {
    test: (n) => /kalt|iced|cold|lemon|limo|eistee/.test(n),
    visual: {
      gradient: 'from-teal-600 via-cyan-500 to-sky-400',
      accent: 'bg-teal-700',
      ring: 'ring-teal-400/40',
      icon: '🧊',
    },
  },
  {
    test: (n) => /food|bowl|toast|dessert|cake|brot|snack/.test(n),
    visual: {
      gradient: 'from-matcha-700 via-matcha-500 to-lime-400',
      accent: 'bg-matcha-700',
      ring: 'ring-matcha-400/40',
      icon: '🍽',
    },
  },
  {
    test: (n) => /special|signature|limited|saison/.test(n),
    visual: {
      gradient: 'from-amber-500 via-yellow-500 to-amber-300',
      accent: 'bg-gold',
      ring: 'ring-amber-300/40',
      icon: '✨',
    },
  },
];

export function visualFor(categoryName: string | null | undefined): CategoryVisual {
  if (!categoryName) return DEFAULT_VISUAL;
  const key = categoryName.toLowerCase();
  for (const entry of MAP) {
    if (entry.test(key)) return entry.visual;
  }
  return DEFAULT_VISUAL;
}

// Stabil-deterministisches "Blob"-Seed pro Item (für SVG-Backgrounds).
export function seedFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return h;
}

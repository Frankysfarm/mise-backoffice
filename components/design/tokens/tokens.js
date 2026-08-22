/**
 * Mise Design Tokens — Off-Black + Saffron + Cream
 *
 * Single Source of Truth für alle Mise-Komponenten.
 * NIEMALS direkt Farbcodes in Komponenten verwenden — immer via T.xxx referenzieren.
 *
 * Goldene Regeln:
 * 1. Saffron ist DIE einzige Action-Farbe
 * 2. Cream ist die POP-Farbe (sparsam einsetzen)
 * 3. Pures Schwarz (#000) und pures Weiß (#fff) sind verboten
 * 4. Alle Zahlen in FONT.mono mit fontVariantNumeric: 'tabular-nums'
 */

export const T = {
  // === SURFACES ===
  // Off-Black mit warmem Drift (mehr Rot als Blau im Schwarz)
  bg: '#0F0E0D',           // App-Hintergrund
  surface: '#171614',      // Cards, Panels
  surfaceHi: '#1F1D1A',    // Erhöht, Hover-State
  surfaceTop: '#0A0908',   // Top-Chrome, tiefstes Schwarz
  border: '#2A2724',       // Subtile Dividers
  borderHi: '#3A3631',     // Stärkere Dividers

  // === TEXT ===
  text: '#F2EDE3',         // Primary — warme Cream, NIE pures Weiß
  textMute: '#8E8579',     // Secondary
  textDim: '#5C554C',      // Tertiary

  // === ACTION (Saffron — DIE einzige Action-Farbe) ===
  action: '#E68A2C',       // Base
  actionHi: '#F09838',     // Hover
  actionLo: '#C4731F',     // Pressed

  // === STATES ===
  ok: '#7A8C4A',           // Olive (statt knall-grün)
  okBright: '#9CB05F',
  warn: '#D69638',         // Mustard
  err: '#B84A3A',          // Muted Brick (statt knall-rot)
  errBright: '#D45B47',
  info: '#5B7A8C',         // Cool blue-grey

  // === CATEGORY-AKZENTE (earth tones, muted, alle lesbar auf dark) ===
  cat: {
    starter: '#7A8C4A',    // olive — Vorspeisen
    main: '#C97448',       // terracotta — Hauptgänge
    pizza: '#D2691E',      // pizza orange
    dessert: '#9B6B92',    // plum
    softdrink: '#7A8E99',  // steel
    beer: '#B89048',       // gold
    wine: '#8B3F4E',       // burgundy
    spirit: '#5C3A1F',     // mocha
    coffee: '#4A3429',     // espresso
  },

  // === CREAM (POP-Farbe — sparsam einsetzen) ===
  cream: '#F2EDE3',
  creamMute: '#E8E0D0',

  // === TINTS (für Backgrounds von Action-/State-Buttons in muted Variante) ===
  actionTint: 'rgba(230, 138, 44, 0.12)',
  actionTintHi: 'rgba(230, 138, 44, 0.22)',
  okTint: 'rgba(122, 140, 74, 0.15)',
  errTint: 'rgba(184, 74, 58, 0.15)',
};

// === RADII (Border-Radius-Skala) ===
export const R = {
  sm: 4,
  md: 8,
  lg: 10,
  xl: 12,
  '2xl': 16,
  round: 9999,
};

// === SHADOWS ===
export const SHADOW = {
  cardHover: '0 8px 24px rgba(0, 0, 0, 0.3)',
  modal: '0 24px 64px rgba(0, 0, 0, 0.5)',
  saffronGlow: '0 8px 24px rgba(230, 138, 44, 0.3)',
  saffronButton: `0 0 0 1px ${T.action}, 0 8px 24px rgba(230, 138, 44, 0.25)`,
  toast: '0 16px 40px rgba(0, 0, 0, 0.5)',
};

// === SPACING-SKALA (in px, einheitlich) ===
export const SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
};

// === LAYOUT-KONSTANTEN ===
export const LAYOUT = {
  topBarHeight: 64,
  cartWidth: 384,
  categoryRailWidth: 136,
  modalMaxWidth: 440,
  modalWideMaxWidth: 560,
  touchTargetMin: 44, // Apple HIG minimum
};

// === ANIMATION-DURATIONS ===
export const DURATION = {
  fast: '120ms',
  base: '150ms',
  slow: '300ms',
  pulse: '1800ms',
};

// === Z-INDEX-SKALA ===
export const Z = {
  toast: 100,
  modal: 50,
  modalBackdrop: 49,
  dropdown: 40,
  topBar: 30,
  base: 1,
};

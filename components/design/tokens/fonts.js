/**
 * Mise Font System
 *
 * System-Font-Stack — keine Webfonts.
 * Vorteil: native Look-and-Feel, kein FOUT, kein Layout-Shift, schneller Start.
 *
 * Geräte-Adaption:
 * - iPad/iPhone → SF Pro (Apple)
 * - Android → Roboto (Google)
 * - Windows → Segoe UI
 * - Mac-Desktop → SF Pro
 */

export const FONT = {
  // Headlines, Buttons, Tabs, Card-Titles, Modal-Headers
  ui: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", system-ui, sans-serif',

  // Beschreibungen, Item-Namen, Body-Text, Notes
  body: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", system-ui, sans-serif',

  // ALLE Zahlen — Preise, Mengen, Uhrzeiten, IDs, Status-Labels
  // Wichtig: immer kombinieren mit `fontVariantNumeric: 'tabular-nums'`
  mono: 'ui-monospace, "SF Mono", "JetBrains Mono", "Roboto Mono", Menlo, Consolas, monospace',
};

/**
 * Schrift-Größen-Skala — strikt einhalten
 */
export const FONT_SIZE = {
  // Display (Modal-Titel, Settings-Header)
  display: 40,        // weight 800, letter-spacing -0.03em
  displaySm: 26,      // weight 700, letter-spacing -0.02em

  // Heading (Card-Titles, Section-Titles)
  heading: 18,        // weight 700
  headingSm: 16,      // weight 600

  // Body
  body: 14,           // weight 500
  bodySm: 13,         // weight 500

  // Caption / Eyebrow (Mono, Caps, letter-spacing)
  caption: 11,        // weight 500, letter-spacing 0.12em, uppercase
  captionSm: 10,      // weight 500, letter-spacing 0.14em, uppercase
  captionXs: 9,       // weight 500, letter-spacing 0.14em, uppercase
};

/**
 * Style-Mixins für häufige Text-Kombinationen
 *
 * Verwendung in Komponenten:
 *   <div style={textStyles.display}>Title</div>
 *   <div style={textStyles.eyebrow}>Section Label</div>
 */
export const textStyles = {
  display: {
    fontFamily: FONT.ui,
    fontSize: 40,
    fontWeight: 800,
    letterSpacing: '-0.03em',
    lineHeight: 1,
  },
  displaySm: {
    fontFamily: FONT.ui,
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
  },
  heading: {
    fontFamily: FONT.ui,
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: '-0.01em',
  },
  headingSm: {
    fontFamily: FONT.ui,
    fontSize: 16,
    fontWeight: 600,
    letterSpacing: '-0.01em',
  },
  body: {
    fontFamily: FONT.body,
    fontSize: 14,
    fontWeight: 500,
    lineHeight: 1.4,
  },
  bodySm: {
    fontFamily: FONT.body,
    fontSize: 13,
    fontWeight: 500,
    lineHeight: 1.4,
  },
  eyebrow: {
    fontFamily: FONT.mono,
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
  },
  caption: {
    fontFamily: FONT.mono,
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '0.04em',
  },
  // Spezial: Geld, Mengen, IDs — immer Mono + tabular-nums
  number: {
    fontFamily: FONT.mono,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '-0.01em',
  },
  numberLarge: {
    fontFamily: FONT.mono,
    fontSize: 32,
    fontWeight: 500,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '-0.02em',
  },
};

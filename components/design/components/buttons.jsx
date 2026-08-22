'use client';

/**
 * Mise Buttons
 *
 * Drei Variants:
 * - PrimaryButton: Saffron (für Hauptaktionen — Kassieren, Bestätigen, Senden)
 * - SecondaryButton: Cream-Border, Transparent (für Sekundäraktionen — Bonieren, Zurück)
 * - DestructiveButton: Brick-Red (für Storno, Löschen)
 *
 * Goldene Regel:
 * Pro Screen-Region maximal EIN PrimaryButton (Saffron).
 * Niemals zwei Saffron-Buttons gleicher Stärke nebeneinander.
 */

import React from 'react';
import { T } from '../tokens/tokens.js';
import { FONT } from '../tokens/fonts.js';
import { SHADOW } from '../tokens/tokens.js';

/**
 * PrimaryButton — Saffron, für die wichtigste Action im Screen
 * Verwendung: <PrimaryButton onClick={pay} fullWidth>Kassieren · 23,40 €</PrimaryButton>
 */
export function PrimaryButton({ children, onClick, disabled, fullWidth, size = 'md', icon: Icon }) {
  const padding = size === 'lg' ? '18px 24px' : size === 'sm' ? '10px 14px' : '16px 20px';
  const fontSize = size === 'lg' ? 16 : size === 'sm' ? 13 : 15;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: fullWidth ? '100%' : 'auto',
        padding,
        backgroundColor: T.action,
        color: T.surfaceTop,
        borderRadius: 10,
        border: 'none',
        fontFamily: FONT.ui,
        fontSize,
        fontWeight: 700,
        letterSpacing: '-0.01em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        boxShadow: disabled ? 'none' : SHADOW.saffronButton,
        transition: 'opacity 0.12s',
      }}>
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

/**
 * SecondaryButton — Cream-Border, Transparent
 * Verwendung: <SecondaryButton onClick={sendOrder} icon={ChefHat}>Bonieren</SecondaryButton>
 */
export function SecondaryButton({ children, onClick, disabled, fullWidth, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: fullWidth ? '100%' : 'auto',
        padding: '14px 20px',
        backgroundColor: 'transparent',
        color: T.text,
        border: `1.5px solid ${T.cream}`,
        borderRadius: 10,
        fontFamily: FONT.ui,
        fontSize: 14,
        fontWeight: 600,
        letterSpacing: '-0.01em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'opacity 0.12s',
      }}>
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

/**
 * GhostButton — kein Border, nur Text (für Abbrechen, "weniger wichtig")
 * Verwendung: <GhostButton onClick={cancel}>Abbrechen</GhostButton>
 */
export function GhostButton({ children, onClick, disabled, fullWidth, color }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: fullWidth ? '100%' : 'auto',
        padding: '11px 14px',
        backgroundColor: 'transparent',
        color: color || T.textMute,
        border: 'none',
        fontFamily: FONT.mono,
        fontSize: 11,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}>
      {children}
    </button>
  );
}

/**
 * DestructiveButton — Brick-Rot (für Storno, Löschen)
 * Verwendung: <DestructiveButton onClick={storno}>Stornieren</DestructiveButton>
 */
export function DestructiveButton({ children, onClick, disabled, fullWidth }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: fullWidth ? '100%' : 'auto',
        padding: '14px 20px',
        backgroundColor: T.err,
        color: T.cream,
        border: 'none',
        borderRadius: 10,
        fontFamily: FONT.ui,
        fontSize: 14,
        fontWeight: 700,
        letterSpacing: '-0.01em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}>
      {children}
    </button>
  );
}

/**
 * IconButton — quadratisch, nur Icon (z.B. Settings, Close)
 * Verwendung: <IconButton icon={Settings} onClick={openSettings} />
 */
export function IconButton({ icon: Icon, onClick, size = 'md', variant = 'default' }) {
  const dimension = size === 'lg' ? 40 : size === 'sm' ? 28 : 32;
  const iconSize = size === 'lg' ? 18 : size === 'sm' ? 14 : 16;

  const variants = {
    default: { bg: T.surface, color: T.text, border: T.border },
    soft: { bg: T.surfaceHi, color: T.textMute, border: T.border },
    action: { bg: T.action, color: T.surfaceTop, border: T.action },
  };
  const v = variants[variant];

  return (
    <button
      onClick={onClick}
      style={{
        width: dimension,
        height: dimension,
        borderRadius: variant === 'soft' ? '50%' : 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: v.bg,
        color: v.color,
        border: `1px solid ${v.border}`,
        cursor: 'pointer',
      }}>
      <Icon size={iconSize} />
    </button>
  );
}

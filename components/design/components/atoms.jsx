'use client';

/**
 * Mise Atoms — kleine wiederverwendbare Building-Blocks
 */

import React from 'react';
import { T } from '../tokens/tokens.js';
import { FONT } from '../tokens/fonts.js';

/**
 * Eyebrow — Section-Label (kleine Mono-Caps über Sections)
 * Verwendung: <Eyebrow>Bezahlen</Eyebrow>
 */
export function Eyebrow({ children }) {
  return (
    <span style={{
      color: T.textMute,
      fontFamily: FONT.mono,
      fontSize: 10,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      fontWeight: 500,
    }}>
      {children}
    </span>
  );
}

/**
 * Stat — kleines Label-Value-Paar (z.B. für Dashboard-Stats)
 * Verwendung: <Stat label="Heute" value="142,80 €" />
 */
export function Stat({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{
        color: T.textMute,
        fontFamily: FONT.mono,
        fontSize: 9,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        fontWeight: 500,
      }}>{label}</span>
      <span style={{
        color: T.text,
        fontFamily: FONT.mono,
        fontSize: 14,
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.01em',
      }}>{value}</span>
    </div>
  );
}

/**
 * StatusPill — Status-Indikator mit Icon + Label
 * Verwendung: <StatusPill icon={Shield} label="TSE OK" tone="ok" dot />
 *
 * tone: 'ok' | 'warn' | 'err'
 */
export function StatusPill({ icon: Icon, label, dot, tone = 'ok' }) {
  const color = tone === 'ok' ? T.ok : tone === 'warn' ? T.warn : T.err;
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 10px',
      borderRadius: 20,
      backgroundColor: T.surface,
      border: `1px solid ${T.border}`,
    }}>
      <Icon size={11} style={{ color }} />
      <span style={{
        color: T.text,
        fontFamily: FONT.mono,
        fontSize: 11,
        letterSpacing: '0.04em',
        fontWeight: 500,
      }}>{label}</span>
      {dot && (
        <span style={{
          display: 'inline-block',
          width: 6, height: 6,
          borderRadius: '50%',
          backgroundColor: color,
        }} />
      )}
    </div>
  );
}

/**
 * Divider — vertikale 1px-Trennung
 */
export function Divider({ vertical = true, height = 24 }) {
  return (
    <div style={{
      width: vertical ? 1 : '100%',
      height: vertical ? height : 1,
      backgroundColor: T.border,
    }} />
  );
}

/**
 * Logomark — Mise-Wortmarke mit Saffron-Dot
 * Verwendung: <Logomark /> oder <Logomark size={40} />
 */
export function Logomark({ size = 30 }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      fontFamily: FONT.ui,
      fontSize: size,
      fontWeight: 800,
      letterSpacing: '-0.06em',
      lineHeight: 0.85,
      color: T.cream,
    }}>
      m
      <span style={{
        display: 'inline-block',
        width: size / 3, height: size / 3,
        borderRadius: '50%',
        backgroundColor: T.action,
        marginLeft: size / 10,
        transform: 'translateY(-7%)',
      }} />
    </div>
  );
}

/**
 * Toggle — On/Off Switch (klickbar optional)
 * Verwendung: <Toggle on={isActive} onClick={() => setActive(!isActive)} />
 */
export function Toggle({ on, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      style={{
        width: 40, height: 24,
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        padding: 2,
        backgroundColor: on ? T.action : T.borderHi,
        justifyContent: on ? 'flex-end' : 'flex-start',
        transition: 'background-color 0.15s',
        border: 'none',
        cursor: onClick ? 'pointer' : 'default',
      }}>
      <div style={{
        width: 20, height: 20,
        borderRadius: '50%',
        backgroundColor: T.cream,
      }} />
    </Tag>
  );
}

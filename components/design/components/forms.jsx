'use client';

/**
 * Mise Form Components
 */

import React from 'react';
import { T } from '../tokens/tokens.js';
import { FONT } from '../tokens/fonts.js';

/**
 * FormGroup — Eyebrow-Label + Input-Wrapper
 *
 * Verwendung:
 *   <FormGroup label="Name">
 *     <Input value={name} onChange={setName} placeholder="Tahar" />
 *   </FormGroup>
 */
export function FormGroup({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        color: T.textMute,
        fontFamily: FONT.mono,
        fontSize: 10,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        fontWeight: 500,
        marginBottom: 6,
      }}>{label}</div>
      {children}
      {hint && (
        <div style={{
          color: T.textDim,
          fontFamily: FONT.body,
          fontSize: 11,
          marginTop: 4,
        }}>{hint}</div>
      )}
    </div>
  );
}

/**
 * Input — Standard Text-Input
 */
export function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  autoFocus,
  mono,
  uppercase,
  ...rest
}) {
  return (
    <input
      type={type}
      value={value || ''}
      onChange={(e) => onChange?.(uppercase ? e.target.value.toUpperCase() : e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      style={{
        width: '100%',
        padding: '12px 14px',
        borderRadius: 10,
        backgroundColor: T.surfaceHi,
        border: `1px solid ${T.border}`,
        color: T.text,
        fontFamily: mono ? FONT.mono : FONT.body,
        fontSize: 14,
        letterSpacing: mono ? '0.06em' : 'normal',
        outline: 'none',
      }}
      {...rest}
    />
  );
}

/**
 * Select — Standard Dropdown
 */
export function Select({ value, onChange, options, placeholder }) {
  return (
    <select
      value={value || ''}
      onChange={(e) => onChange?.(e.target.value)}
      style={{
        width: '100%',
        padding: '12px 14px',
        borderRadius: 10,
        backgroundColor: T.surfaceHi,
        border: `1px solid ${T.border}`,
        color: T.text,
        fontFamily: FONT.body,
        fontSize: 14,
        outline: 'none',
        appearance: 'none',
      }}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

/**
 * SegmentedControl — Tab-artige Auswahl (z.B. "Hier essen | To Go")
 *
 * Verwendung:
 *   <SegmentedControl
 *     options={[{ id: 'here', label: 'Hier' }, { id: 'togo', label: 'To Go' }]}
 *     value="here"
 *     onChange={setMode}
 *   />
 */
export function SegmentedControl({ options, value, onChange, size = 'md' }) {
  return (
    <div style={{
      display: 'flex',
      gap: 2,
      padding: 3,
      borderRadius: 10,
      backgroundColor: T.surface,
      border: `1px solid ${T.border}`,
    }}>
      {options.map((opt) => {
        const isActive = value === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: size === 'sm' ? '6px 12px' : '8px 16px',
              borderRadius: 8,
              backgroundColor: isActive ? T.cream : 'transparent',
              color: isActive ? T.surfaceTop : T.textMute,
              border: 'none',
              fontFamily: FONT.ui,
              fontSize: size === 'sm' ? 12 : 13,
              fontWeight: 600,
              letterSpacing: '-0.01em',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}>
            {opt.icon && <opt.icon size={13} />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

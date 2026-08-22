'use client';

/**
 * Mise Modals + Toasts
 *
 * Modal: Full-screen Backdrop mit Blur, zentrierter Content
 * Toast: Bottom-Center Notification, 2.2s Auto-Dismiss
 */

import React, { useEffect } from 'react';
import { T } from '../tokens/tokens.js';
import { FONT } from '../tokens/fonts.js';
import { SHADOW, LAYOUT } from '../tokens/tokens.js';
import { IconButton } from './buttons.jsx';
import { Eyebrow } from './atoms.jsx';

/**
 * Modal — Standard-Modal mit Backdrop-Blur
 *
 * Verwendung:
 *   <Modal onClose={() => setOpen(false)} wide>
 *     <Eyebrow>Tisch öffnen</Eyebrow>
 *     <h2>Wie viele Gäste?</h2>
 *     ...
 *   </Modal>
 */
export function Modal({ children, onClose, wide, maxHeight = '90vh' }) {
  // ESC-Key zum Schließen
  useEffect(() => {
    if (!onClose) return;
    const handler = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 50,
        animation: 'miseFadeIn 0.2s',
      }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: wide ? LAYOUT.modalWideMaxWidth : LAYOUT.modalMaxWidth,
          padding: 32,
          borderRadius: 16,
          backgroundColor: T.surface,
          border: `1px solid ${T.border}`,
          boxShadow: SHADOW.modal,
          maxHeight,
          overflowY: 'auto',
          animation: 'miseSlideUp 0.25s',
        }}>
        {children}
      </div>
    </div>
  );
}

/**
 * ModalHeader — Eyebrow + Close-Button Layout
 *
 * Verwendung:
 *   <ModalHeader eyebrow="Bezahlen · Tisch 4" onClose={close} />
 */
export function ModalHeader({ eyebrow, title, onClose }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: title ? 16 : 24,
    }}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      {onClose && (
        <button
          onClick={onClose}
          style={{
            width: 32, height: 32, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: T.surfaceHi,
            color: T.textMute,
            border: `1px solid ${T.border}`,
            cursor: 'pointer',
            fontSize: 16,
          }}>
          ✕
        </button>
      )}
    </div>
  );
}

/**
 * Toast — Notification unten zentriert
 *
 * Verwendung: über einen Provider/Hook (siehe Beispiel unten)
 */
export function Toast({ msg, type = 'ok' }) {
  const bg = type === 'warn' ? T.warn : T.cream;
  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '12px 20px',
      borderRadius: 10,
      backgroundColor: bg,
      color: T.surfaceTop,
      fontFamily: FONT.mono,
      fontSize: 13,
      fontWeight: 500,
      letterSpacing: '0.02em',
      zIndex: 100,
      boxShadow: SHADOW.toast,
      animation: 'miseSlideUp 0.25s',
    }}>
      {msg}
    </div>
  );
}

/**
 * useToast — React-Hook für Toast-Management
 *
 * Verwendung:
 *   function MyComponent() {
 *     const { toast, showToast } = useToast();
 *     return (
 *       <>
 *         <button onClick={() => showToast('Gespeichert', 'ok')}>Save</button>
 *         {toast && <Toast {...toast} />}
 *       </>
 *     );
 *   }
 */
export function useToast() {
  const [toast, setToast] = React.useState(null);
  const showToast = React.useCallback((msg, type = 'ok') => {
    setToast({ msg, type });
    const timeout = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timeout);
  }, []);
  return { toast, showToast };
}

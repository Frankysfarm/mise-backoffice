'use client';

import { useEffect } from 'react';
import { miseAnimations } from '@design/tokens/animations';

/**
 * Global Client-Side Provider für Mise-Design-System.
 *
 * - Injektiert miseAnimations-Keyframes einmalig ins document.head
 *   (browser-only, SSR-safe via useEffect)
 * - Hier später ToastProvider / ThemeContext / etc. ergänzen
 */
export function MiseDesignProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById('mise-animations')) return;
    const style = document.createElement('style');
    style.id = 'mise-animations';
    style.textContent = miseAnimations;
    document.head.appendChild(style);
  }, []);

  return <>{children}</>;
}

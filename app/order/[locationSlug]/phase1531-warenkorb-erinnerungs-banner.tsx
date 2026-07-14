'use client';

import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'mise_warenkorb_erinnerung_dismissed';
const DISMISSED_DURATION_MS = 24 * 60 * 60 * 1000; // 24h
const IDLE_TRIGGER_MS = 30 * 60 * 1000; // 30 min

interface Props {
  cartItemCount?: number;
  locationSlug?: string;
}

export function StorefrontPhase1531WarenkorbErinnerungsBanner({ cartItemCount = 0, locationSlug = '' }: Props) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    if (cartItemCount === 0) return;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const { ts, slug } = JSON.parse(raw);
        if (slug === locationSlug && Date.now() - ts < DISMISSED_DURATION_MS) return;
      }
    } catch {}

    const timer = setTimeout(() => setVisible(true), IDLE_TRIGGER_MS);
    return () => clearTimeout(timer);
  }, [cartItemCount, locationSlug]);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ts: Date.now(), slug: locationSlug }));
    } catch {}
  };

  if (!mounted || !visible || cartItemCount === 0) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-20 left-4 right-4 z-50 max-w-sm mx-auto rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/80 shadow-lg px-4 py-3 flex items-center gap-3"
    >
      <span className="text-2xl flex-shrink-0">🛒</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          Du hast noch {cartItemCount} {cartItemCount === 1 ? 'Artikel' : 'Artikel'} im Warenkorb!
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
          Jetzt bestellen, bevor deine Auswahl abläuft.
        </p>
      </div>
      <button
        onClick={dismiss}
        aria-label="Banner schließen"
        className="flex-shrink-0 text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 p-1 rounded"
      >
        ✕
      </button>
    </div>
  );
}

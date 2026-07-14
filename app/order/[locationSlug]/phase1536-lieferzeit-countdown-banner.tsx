'use client';

import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'mise_lieferzeit_countdown_shown';
const GUARD_MS = 5 * 60 * 1000; // 5 min

interface Props {
  etaMinutes?: number | null;
  locationSlug?: string;
  visible?: boolean;
}

export function StorefrontPhase1536LieferzeitCountdownBanner({ etaMinutes, locationSlug = '', visible = true }: Props) {
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!visible || etaMinutes == null) return;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const { ts, slug } = JSON.parse(raw);
        if (slug === locationSlug && Date.now() - ts < GUARD_MS) return;
      }
    } catch {}

    setShow(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ts: Date.now(), slug: locationSlug }));
    } catch {}
  }, [visible, etaMinutes, locationSlug]);

  const dismiss = () => setShow(false);

  if (!mounted || !show || etaMinutes == null) return null;

  const urgency = etaMinutes <= 20;

  return (
    <div
      role="banner"
      className={`fixed bottom-4 left-4 right-4 z-40 max-w-sm mx-auto rounded-xl border shadow-lg px-4 py-3 flex items-center gap-3
        ${urgency
          ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/80'
          : 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/80'}`}
    >
      <span className="text-2xl flex-shrink-0">{urgency ? '⚡' : '🚀'}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${urgency ? 'text-red-800 dark:text-red-200' : 'text-indigo-800 dark:text-indigo-200'}`}>
          Jetzt bestellen — Lieferung in ~{etaMinutes} Min
        </p>
        <p className={`text-xs mt-0.5 ${urgency ? 'text-red-600 dark:text-red-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
          {urgency ? 'Schnell sein — kurze Lieferzeit gerade verfügbar!' : 'Bestellung aufgeben und bald genießen.'}
        </p>
      </div>
      <button
        onClick={dismiss}
        aria-label="Schließen"
        className={`flex-shrink-0 p-1 rounded
          ${urgency
            ? 'text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-200'
            : 'text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-200'}`}
      >
        ✕
      </button>
    </div>
  );
}

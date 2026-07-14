'use client';

import React, { useEffect, useState } from 'react';

interface Props {
  locationId: string;
  etaMinuten: number | null;
  schwelle?: number;
}

const STORAGE_KEY_PREFIX = 'mise_liefergarantie_dismiss_';
const GUTSCHEIN_CODE = 'PUENKTLICH5';

export function StorefrontPhase1581LieferzeitGarantieVersprechen({
  locationId,
  etaMinuten,
  schwelle = 45,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
    const storageKey = `${STORAGE_KEY_PREFIX}${locationId}`;
    const val = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
    if (val) {
      const dismissedAt = parseInt(val, 10);
      if (Date.now() - dismissedAt < 24 * 60 * 60 * 1000) {
        setDismissed(true);
      }
    }
  }, [locationId]);

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${locationId}`, String(Date.now()));
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(GUTSCHEIN_CODE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!mounted || dismissed) return null;
  if (etaMinuten === null || etaMinuten < schwelle) return null;

  return (
    <div className="mx-4 mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5 text-xl">⏱️</div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-0.5">
            Lieferzeit-Garantie
          </div>
          <div className="text-sm font-bold text-amber-900">
            Lieferzeit über {schwelle} Min — wir versprechen Qualität!
          </div>
          <div className="text-xs text-amber-700 mt-0.5">
            Als Dankeschön: 5 % Rabatt auf Ihre nächste Bestellung mit Code
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded-lg border border-amber-300 bg-white px-3 py-1 text-sm font-black tracking-widest text-amber-800 select-all">
              {GUTSCHEIN_CODE}
            </span>
            <button
              onClick={handleCopy}
              className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-white hover:bg-amber-600 transition-colors"
            >
              {copied ? '✓ Kopiert' : 'Kopieren'}
            </button>
          </div>
          <div className="mt-1.5 text-[10px] text-amber-600 opacity-70">
            Geschätzte Lieferzeit: {etaMinuten} Min · Danke für Ihre Geduld
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-lg leading-none text-amber-400 hover:text-amber-600 shrink-0"
          aria-label="Schließen"
        >
          ×
        </button>
      </div>
    </div>
  );
}

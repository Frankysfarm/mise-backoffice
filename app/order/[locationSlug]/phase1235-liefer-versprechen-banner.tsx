'use client';

// Phase 1235 — Liefer-Versprechen-Banner (Storefront)
// Transparenz-Banner: "Wir liefern in X Min oder Y€ Gutschrift"
// Props: etaMin, locationId; auto-dismiss nach 8s

import { useEffect, useState } from 'react';
import { X, ShieldCheck, Clock, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  etaMin: number;
  locationId: string;
  gutschriftEur?: number;
}

export function Phase1235LieferVersprechenBanner({ etaMin, locationId, gutschriftEur = 5 }: Props) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Show after short delay so it doesn't immediately cover the UI
    const showTimer = setTimeout(() => setVisible(true), 2500);
    const hideTimer = setTimeout(() => setVisible(false), 12500);
    return () => { clearTimeout(showTimer); clearTimeout(hideTimer); };
  }, []);

  useEffect(() => {
    try {
      const key = `liefervsp_${locationId}`;
      const last = localStorage.getItem(key);
      if (last && Date.now() - Number(last) < 3600000) {
        setDismissed(true);
      }
    } catch { /* noop */ }
  }, [locationId]);

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(`liefervsp_${locationId}`, String(Date.now()));
    } catch { /* noop */ }
  }

  if (dismissed || !visible) return null;

  const isShort = etaMin <= 25;
  const color = isShort
    ? 'bg-emerald-600 text-white border-emerald-700'
    : 'bg-matcha-600 text-white border-matcha-700';

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg transition-all duration-500',
        color,
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none',
      )}
      role="status"
    >
      <ShieldCheck className="h-5 w-5 mt-0.5 shrink-0 text-white/90" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm">Liefer-Versprechen</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold">
            <Clock className="h-2.5 w-2.5" />
            {etaMin} Min
          </span>
        </div>
        <p className="text-xs text-white/90 mt-0.5 leading-snug">
          Wir liefern in <strong>{etaMin} Minuten</strong> — oder du erhältst{' '}
          <span className="inline-flex items-center gap-0.5 font-bold">
            <Gift className="h-3 w-3" />{gutschriftEur} € Gutschrift
          </span>{' '}
          auf die nächste Bestellung.
        </p>
      </div>
      <button
        onClick={dismiss}
        className="shrink-0 rounded-md p-1 hover:bg-white/20 transition"
        aria-label="Schließen"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

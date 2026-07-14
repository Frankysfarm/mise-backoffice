'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ShieldCheck, Copy, Check, X } from 'lucide-react';

// Phase 1480 — Lieferzeit-Garantie-Versprechen (Storefront)
// Wenn ETA > 45 Min: automatisches Rabatt-Widget (PÜNKTLICH5) + Versprechen-Banner.
// Hydration-safe. localStorage-Guard 24h. Nach Phase 1475.

interface Props {
  locationId: string;
  etaMinuten: number | null;
}

const ETA_SCHWELLE = 45;
const COUPON = 'PÜNKTLICH5';
const LS_KEY = (lid: string) => `liefergarantie_dismissed:${lid}`;
const DISMISS_TTL = 24 * 60 * 60 * 1000;

export function StorefrontPhase1480LieferzeitGarantieVersprechen({ locationId, etaMinuten }: Props) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (etaMinuten == null || etaMinuten <= ETA_SCHWELLE) return;
    try {
      const raw = localStorage.getItem(LS_KEY(locationId));
      if (raw) {
        const ts = parseInt(raw, 10);
        if (Date.now() - ts < DISMISS_TTL) return;
      }
    } catch {}
    const t = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(t);
  }, [locationId, etaMinuten]);

  if (!mounted || !visible || etaMinuten == null || etaMinuten <= ETA_SCHWELLE) return null;

  function dismiss() {
    try { localStorage.setItem(LS_KEY(locationId), String(Date.now())); } catch {}
    setVisible(false);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(COUPON);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <ShieldCheck className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="text-sm font-bold text-amber-800 dark:text-amber-200">Lieferzeit-Garantie</span>
        <button onClick={dismiss} className="ml-auto p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors">
          <X className="h-4 w-4 text-amber-500" />
        </button>
      </div>

      {/* ETA warning */}
      <div className="px-4 pb-2">
        <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
          Deine Lieferung dauert ca. <span className="font-bold">{etaMinuten} Minuten</span>.
          Als Entschuldigung für die längere Wartezeit erhältst du <span className="font-bold">5% Rabatt</span> auf deine nächste Bestellung.
        </p>
      </div>

      {/* Coupon */}
      <div className="mx-4 mb-3 flex items-center gap-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-amber-950/40 px-3 py-2.5">
        <div className="flex-1">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide font-medium">Dein Rabatt-Code</div>
          <div className="text-base font-black tracking-widest text-amber-700 dark:text-amber-300 font-mono">
            {COUPON}
          </div>
        </div>
        <button
          onClick={copy}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
            copied
              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
              : 'bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400 text-white',
          )}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Kopiert!' : 'Kopieren'}
        </button>
      </div>

      {/* Dismiss */}
      <button
        onClick={dismiss}
        className="w-full text-[11px] text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 transition-colors py-2 border-t border-amber-200 dark:border-amber-800"
      >
        Verstanden — schließen
      </button>
    </div>
  );
}

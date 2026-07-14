'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Zap, X, Gift, Clock } from 'lucide-react';

// Phase 1464 — Liefer-Versprechen-Banner (Storefront)
// Wenn ETA > 40 Min: Automatisches Rabatt-Angebot-Banner "Wir beeilen uns — 5% Rabatt"
// schließbar; Hydration-Safe; nach Phase1459.

const STORAGE_KEY = 'liefer_versprechen_dismissed';
const RABATT_CODE = 'SCHNELL5';
const ETA_SCHWELLE = 40; // Minuten

interface Props {
  locationId: string;
  etaMinuten?: number | null;
  className?: string;
}

function isDismissed(locationId: string): boolean {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${locationId}`);
    if (!raw) return false;
    const { dismissed_at } = JSON.parse(raw) as { dismissed_at: string };
    const minSince = (Date.now() - new Date(dismissed_at).getTime()) / 60_000;
    return minSince < 60; // Nach 60 Min wieder anzeigen (neue Bestellsession)
  } catch { return false; }
}

function setDismissed(locationId: string): void {
  try {
    localStorage.setItem(
      `${STORAGE_KEY}_${locationId}`,
      JSON.stringify({ dismissed_at: new Date().toISOString() }),
    );
  } catch {}
}

export function StorefrontPhase1464LieferVersprechenBanner({ locationId, etaMinuten, className }: Props) {
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const checked = useRef(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted || checked.current) return;
    checked.current = true;
    if (etaMinuten == null || etaMinuten <= ETA_SCHWELLE) return;
    if (isDismissed(locationId)) return;
    setShow(true);
  }, [mounted, etaMinuten, locationId]);

  function dismiss() {
    setDismissed(locationId);
    setShow(false);
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(RABATT_CODE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  // Hydration-safe: render nothing on first server pass
  if (!mounted || !show) return null;

  return (
    <div
      className={cn(
        'fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm',
        'bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-2xl shadow-xl px-4 py-3',
        'flex items-start gap-3 animate-in slide-in-from-bottom-4 duration-300',
        className,
      )}
      role="alert"
    >
      <div className="shrink-0 mt-0.5">
        <Zap className="w-5 h-5 text-yellow-300" />
      </div>

      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="font-semibold text-sm leading-tight">Wir beeilen uns für dich!</div>
        <div className="text-xs text-white/85 leading-snug">
          Deine Lieferung dauert etwas länger. Als Dankeschön erhältst du{' '}
          <strong>5% Rabatt</strong> auf deine nächste Bestellung.
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white/20 rounded-lg px-2.5 py-1">
            <Gift className="w-3 h-3 text-yellow-300 shrink-0" />
            <span className="text-sm font-bold tracking-widest">{RABATT_CODE}</span>
          </div>
          <button
            onClick={copyCode}
            className="text-xs bg-white text-orange-600 font-semibold rounded-lg px-2.5 py-1 hover:bg-orange-50 transition-colors active:scale-95"
          >
            {copied ? '✓ Kopiert!' : 'Kopieren'}
          </button>
        </div>

        {etaMinuten != null && (
          <div className="flex items-center gap-1 text-[10px] text-white/70">
            <Clock className="w-3 h-3" />
            <span>Aktuelle ETA: ca. {etaMinuten} Min</span>
          </div>
        )}
      </div>

      <button
        onClick={dismiss}
        aria-label="Banner schließen"
        className="shrink-0 text-white/70 hover:text-white transition-colors mt-0.5"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

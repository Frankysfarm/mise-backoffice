'use client';

/**
 * FahrerWartezeitTipp — Phase 419
 *
 * Zeigt dem Fahrer seine persönliche Abholwartezeit (Durchschnitt letzte 7 Tage)
 * und einen Tipp, wie er sie verbessern kann.
 * Compact, dismissable, dark-friendly.
 */

import { useCallback, useEffect, useState } from 'react';
import { Clock, X, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WartezeitInfo {
  avgPrepMin:    number | null;
  zielPrepMin:   number;
  deltaMin:      number | null;
  ampel:         'gruen' | 'gelb' | 'rot';
  aktuelleQueue: number;
  ueberfaellig:  number;
}

const AMPEL_STYLE = {
  gruen: { bg: 'bg-matcha-900/60', border: 'border-matcha-700', text: 'text-matcha-300', dot: 'bg-matcha-400' },
  gelb:  { bg: 'bg-amber-900/40',  border: 'border-amber-700',  text: 'text-amber-300',  dot: 'bg-amber-400'  },
  rot:   { bg: 'bg-red-900/40',    border: 'border-red-800',    text: 'text-red-300',    dot: 'bg-red-400'    },
};

const TIPPS: Record<string, string> = {
  gruen: 'Top! Die Küche ist im Zeitplan.',
  gelb:  'Starte ≤2 Min vor Fertigmeldung — so warte weder du noch die Küche.',
  rot:   'Bitte früher aufbrechen — Küche ist überlastet, Bestellungen warten auf dich.',
};

export function FahrerWartezeitTipp({
  driverId,
  locationId,
}: {
  driverId:   string;
  locationId: string;
}) {
  const [data, setData]       = useState<WartezeitInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const laden = useCallback(() => {
    if (!locationId) return;
    fetch(`/api/delivery/admin/wartezeit-analyse?action=kueche&location_id=${encodeURIComponent(locationId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.kueche) setData(d.kueche); })
      .catch(() => {});
  }, [locationId]);

  useEffect(() => {
    laden();
    const t = setInterval(laden, 300_000);
    return () => clearInterval(t);
  }, [laden]);

  if (dismissed || !data) return null;

  // Nur anzeigen wenn Küche langsam (gelb/rot) oder Queue voll
  if (data.ampel === 'gruen' && data.aktuelleQueue < 3) return null;

  const c = AMPEL_STYLE[data.ampel];

  const fmt = (v: number | null) => v !== null ? `${v.toFixed(1)} Min` : '—';

  const trendEl = data.deltaMin === null ? null
    : data.deltaMin > 1  ? <TrendingUp  className="h-3 w-3" />
    : data.deltaMin < -1 ? <TrendingDown className="h-3 w-3" />
    : <Minus className="h-3 w-3" />;

  return (
    <div className={cn(
      'relative rounded-2xl border p-4',
      c.bg, c.border,
    )}>
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-3 text-stone-400 hover:text-stone-300 transition"
        aria-label="Schließen"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="flex items-start gap-3 pr-4">
        <div className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border',
          c.border,
          data.ampel === 'gruen' ? 'bg-matcha-800/60' : data.ampel === 'gelb' ? 'bg-amber-800/40' : 'bg-red-800/40',
        )}>
          <Clock className={cn('h-4 w-4', c.text)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <div className={cn('h-1.5 w-1.5 rounded-full', c.dot)} />
            <span className={cn('text-xs font-bold', c.text)}>Küchen-Wartezeit</span>
          </div>

          <div className="flex items-end gap-2 mb-1.5">
            <span className="text-2xl font-black text-white tabular-nums">
              {fmt(data.avgPrepMin)}
            </span>
            {trendEl && (
              <span className={cn('flex items-center gap-0.5 pb-0.5 text-xs font-bold', c.text)}>
                {trendEl}
                {data.deltaMin !== null && `${data.deltaMin > 0 ? '+' : ''}${data.deltaMin.toFixed(1)}`}
              </span>
            )}
          </div>

          <p className="text-[11px] text-stone-300 leading-snug">
            {TIPPS[data.ampel]}
          </p>

          {(data.aktuelleQueue > 0 || data.ueberfaellig > 0) && (
            <div className="flex gap-3 mt-2 text-[10px] text-stone-400">
              {data.aktuelleQueue > 0 && (
                <span>{data.aktuelleQueue} Bestellungen in Queue</span>
              )}
              {data.ueberfaellig > 0 && (
                <span className="text-red-400 font-bold">{data.ueberfaellig} überfällig</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

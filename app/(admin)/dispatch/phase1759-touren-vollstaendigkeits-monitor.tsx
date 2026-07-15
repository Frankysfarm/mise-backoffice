'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, CheckCircle, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Phase 1759 — Touren-Vollständigkeits-Monitor (Dispatch)
 *
 * Tabelle Fahrer + Abschlussquote + Trend-Pfeil + Alert bei <80%.
 * GET /api/delivery/admin/fahrer-touren-vollstaendigkeit?location_id=<id>
 * 30-Min-Polling.
 */

interface FahrerTourenVollstaendigkeit {
  fahrer_id: string;
  fahrer_name: string;
  touren_gesamt: number;
  abgeschlossen: number;
  abgebrochen: number;
  quote_pct: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  trend_delta: number;
}

interface Props {
  locationId: string | null;
  className?: string;
}

const MOCK: FahrerTourenVollstaendigkeit[] = [
  { fahrer_id: 'm1', fahrer_name: 'Mehmet A.', touren_gesamt: 8, abgeschlossen: 8, abgebrochen: 0, quote_pct: 100,  trend: 'besser',     trend_delta: 5 },
  { fahrer_id: 'm2', fahrer_name: 'Julia S.',  touren_gesamt: 7, abgeschlossen: 6, abgebrochen: 1, quote_pct:  85.7, trend: 'gleich',     trend_delta: 0 },
  { fahrer_id: 'm3', fahrer_name: 'Kevin R.',  touren_gesamt: 6, abgeschlossen: 4, abgebrochen: 2, quote_pct:  66.7, trend: 'schlechter', trend_delta: -8 },
  { fahrer_id: 'm4', fahrer_name: 'Lena T.',   touren_gesamt: 5, abgeschlossen: 5, abgebrochen: 0, quote_pct: 100,  trend: 'besser',     trend_delta: 3 },
];

const ALERT_SCHWELLE = 80;

const trendIcon = {
  besser: TrendingUp,
  gleich: Minus,
  schlechter: TrendingDown,
};
const trendColor = {
  besser: 'text-green-500',
  gleich: 'text-muted-foreground',
  schlechter: 'text-red-500',
};

export function DispatchPhase1759TourenVollstaendigkeitsMonitor({ locationId, className }: Props) {
  const [open, setOpen] = useState(true);
  const [fahrer, setFahrer] = useState<FahrerTourenVollstaendigkeit[]>(MOCK);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/admin/fahrer-touren-vollstaendigkeit?location_id=${locationId}`);
        if (r.ok && !cancelled) {
          const j = await r.json();
          if (j.fahrer?.length) setFahrer(j.fahrer);
        }
      } catch { /* silent */ }
    };

    load();
    const iv = setInterval(load, 30 * 60 * 1000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  const kritisch = fahrer.filter(f => f.quote_pct < ALERT_SCHWELLE).length;

  return (
    <div className={cn('rounded-xl border border-border bg-card mb-3', className)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-matcha-500" />
          <span className="text-sm font-bold">Touren-Vollständigkeit</span>
          {kritisch > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-black bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 px-2 py-0.5 rounded-full">
              <AlertTriangle className="h-3 w-3" /> {kritisch}× &lt;80%
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4">
          {kritisch > 0 && (
            <div className="mb-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-300 font-medium">
              {kritisch} Fahrer unter {ALERT_SCHWELLE}% Abschlussquote heute — Ursache prüfen!
            </div>
          )}
          <div className="space-y-1.5">
            {fahrer.map((f, i) => {
              const TrendIcon = trendIcon[f.trend];
              const alertRow = f.quote_pct < ALERT_SCHWELLE;
              return (
                <div
                  key={f.fahrer_id}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2',
                    alertRow ? 'bg-red-50 dark:bg-red-950/20' : 'bg-muted/40',
                  )}
                >
                  <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                  <span className="flex-1 text-xs font-medium truncate">{f.fahrer_name}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">{f.abgeschlossen}/{f.touren_gesamt}</span>
                  <span className={cn(
                    'text-xs font-black tabular-nums',
                    f.quote_pct >= 90 ? 'text-green-600 dark:text-green-400'
                      : f.quote_pct >= ALERT_SCHWELLE ? 'text-amber-600 dark:text-amber-400'
                      : 'text-red-600 dark:text-red-400',
                  )}>
                    {f.quote_pct.toFixed(1)}%
                  </span>
                  <TrendIcon className={cn('h-3 w-3 shrink-0', trendColor[f.trend])} />
                  {alertRow && <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />}
                </div>
              );
            })}
          </div>
          <p className="text-[9px] text-muted-foreground mt-2">Heute • 30-Min-Update</p>
        </div>
      )}
    </div>
  );
}

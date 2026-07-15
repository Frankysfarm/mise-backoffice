'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Coffee, AlertTriangle, ChevronDown, ChevronUp, Clock } from 'lucide-react';

/**
 * Phase 1738 — Schicht-Pausen-Tracker (Kitchen)
 *
 * Küchenpausen heute (Zeitraum + Dauer); Warnung wenn >1h ohne Pause;
 * Props orders + useMemo; Collapsible.
 */

interface Order {
  id: string;
  created_at?: string;
  bestellt_am?: string;
  status?: string;
  [key: string]: unknown;
}

interface Props {
  orders: Order[];
  schicht_start?: string | null;
  pause_schwelle_min?: number;
}

interface PausenEintrag {
  von: string;
  bis: string;
  dauer_min: number;
}

const PAUSE_LUECKE_MIN = 15;
const WARNUNG_SCHWELLE_MIN = 60;

function formatZeit(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function KitchenPhase1738SchichtPausenTracker({
  orders,
  schicht_start,
  pause_schwelle_min = PAUSE_LUECKE_MIN,
}: Props) {
  const [open, setOpen] = useState(false);

  const { pausen, minutenOhnePause, warnung } = useMemo(() => {
    const now = Date.now();
    const heute = new Date();
    heute.setHours(0, 0, 0, 0);
    const heutMs = heute.getTime();

    const zeitpunkte = orders
      .map(o => new Date((o.bestellt_am ?? o.created_at) as string).getTime())
      .filter(t => !isNaN(t) && t >= heutMs)
      .sort((a, b) => a - b);

    const start = schicht_start
      ? new Date(schicht_start).getTime()
      : (zeitpunkte[0] ?? heutMs);

    const pausen: PausenEintrag[] = [];
    let letzterStop = start;

    for (const t of zeitpunkte) {
      const luecke = (t - letzterStop) / 60_000;
      if (luecke >= pause_schwelle_min) {
        pausen.push({
          von: new Date(letzterStop).toISOString(),
          bis: new Date(t).toISOString(),
          dauer_min: Math.round(luecke),
        });
      }
      letzterStop = t;
    }

    const letzteBestellung = zeitpunkte[zeitpunkte.length - 1] ?? start;
    const minutenOhnePause = Math.round((now - letzteBestellung) / 60_000);
    const warnung = minutenOhnePause > WARNUNG_SCHWELLE_MIN;

    return { pausen, minutenOhnePause, warnung };
  }, [orders, schicht_start, pause_schwelle_min]);

  const hatDaten = pausen.length > 0 || minutenOhnePause > 0;
  if (!hatDaten) return null;

  return (
    <div className={cn(
      'rounded-xl border p-3 mb-3',
      warnung
        ? 'border-amber-300 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-950/15'
        : 'border-border/60 bg-background/70',
    )}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2">
          <Coffee className={cn('h-4 w-4', warnung ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')} />
          <span className={cn('text-sm font-bold', warnung ? 'text-amber-800 dark:text-amber-200' : 'text-foreground')}>
            Schicht-Pausen-Tracker
          </span>
          {warnung && (
            <span className="flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/50 border border-amber-300 dark:border-amber-700 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3 w-3" />
              {minutenOhnePause} Min ohne Pause
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {warnung && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-100/50 dark:bg-amber-950/30 p-2.5">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                Keine Pause seit {minutenOhnePause} Minuten!
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                Empfehlung: Kurze Küchenpause von 10–15 Minuten einplanen.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Pausen heute ({pausen.length})
            </span>
            <span className="text-[11px] text-muted-foreground">
              Ø {pausen.length > 0
                ? Math.round(pausen.reduce((s, p) => s + p.dauer_min, 0) / pausen.length)
                : 0} Min
            </span>
          </div>

          {pausen.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">Keine Pausen erkannt</p>
          ) : (
            <div className="space-y-1.5">
              {pausen.map((p, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-foreground tabular-nums">
                      {formatZeit(p.von)} – {formatZeit(p.bis)}
                    </span>
                  </div>
                  <span className={cn(
                    'text-[11px] font-bold tabular-nums rounded-full px-2 py-0.5',
                    p.dauer_min >= WARNUNG_SCHWELLE_MIN
                      ? 'bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-300'
                      : 'bg-sky-100 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300',
                  )}>
                    {p.dauer_min} Min
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

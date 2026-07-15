'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, AlertTriangle, ChevronDown, ChevronUp, Timer } from 'lucide-react';

/**
 * Phase 1739 — Lieferzeit-Abweichungs-Widget (Dispatch)
 *
 * Phase1737-API: Ø Δ ETA je Fahrer + Ausreißer-Flagge; 15-Min-Polling;
 * in dispatch/client.tsx.
 */

interface FahrerAbweichungsProfil {
  driver_id: string;
  fahrer_name: string;
  touren_heute: number;
  avg_delta_min: number;
  ausreisser_anzahl: number;
  alert: boolean;
}

interface AbweichungResponse {
  fahrer: FahrerAbweichungsProfil[];
  gesamt_avg_delta_min: number;
  ausreisser_gesamt: number;
  datum: string;
}

interface Props {
  locationId: string | null;
}

const POLL_MS = 15 * 60_000;

const MOCK: AbweichungResponse = {
  fahrer: [
    { driver_id: 'drv-1', fahrer_name: 'Mehmet A.', touren_heute: 5, avg_delta_min: -1.5, ausreisser_anzahl: 0, alert: false },
    { driver_id: 'drv-2', fahrer_name: 'Julia S.',  touren_heute: 4, avg_delta_min:  7.5, ausreisser_anzahl: 1, alert: false },
    { driver_id: 'drv-3', fahrer_name: 'Kevin R.',  touren_heute: 3, avg_delta_min: 14.0, ausreisser_anzahl: 2, alert: true  },
    { driver_id: 'drv-4', fahrer_name: 'Lena T.',   touren_heute: 3, avg_delta_min:  1.0, ausreisser_anzahl: 0, alert: false },
  ],
  gesamt_avg_delta_min: 5.25,
  ausreisser_gesamt: 3,
  datum: new Date().toISOString().split('T')[0],
};

function deltaColor(delta: number): string {
  if (delta <= 0)  return 'text-green-600 dark:text-green-400';
  if (delta <= 5)  return 'text-sky-600 dark:text-sky-400';
  if (delta <= 10) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function deltaSign(delta: number): string {
  return delta > 0 ? `+${delta}` : `${delta}`;
}

export function DispatchPhase1739LieferzeitAbweichungsWidget({ locationId }: Props) {
  const [data, setData] = useState<AbweichungResponse | null>(null);
  const [open, setOpen] = useState(false);

  const laden = async () => {
    if (!locationId) { setData(MOCK); return; }
    try {
      const res = await fetch(`/api/delivery/admin/lieferzeit-abweichung?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
      else setData(MOCK);
    } catch {
      setData(MOCK);
    }
  };

  useEffect(() => {
    laden();
    const id = setInterval(laden, POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data) return null;

  const hatAlert = data.fahrer.some(f => f.alert);

  return (
    <div className={cn(
      'rounded-xl border p-3 mb-3',
      hatAlert
        ? 'border-red-300 dark:border-red-700 bg-red-50/40 dark:bg-red-950/15'
        : 'border-border/60 bg-background/70',
    )}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Timer className={cn('h-4 w-4 shrink-0', hatAlert ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')} />
          <span className={cn('text-sm font-bold', hatAlert ? 'text-red-800 dark:text-red-200' : 'text-foreground')}>
            Lieferzeit-Abweichung
          </span>
          <span className={cn(
            'text-[11px] font-bold tabular-nums rounded-full px-2 py-0.5 border',
            deltaColor(data.gesamt_avg_delta_min),
            'bg-muted/40 border-border/60',
          )}>
            Ø {deltaSign(data.gesamt_avg_delta_min)} Min
          </span>
          {data.ausreisser_gesamt > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-800 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
              <AlertTriangle className="h-3 w-3" />
              {data.ausreisser_gesamt} Ausreißer
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {hatAlert && (
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-100/50 dark:bg-red-950/30 p-2.5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                <p className="text-xs font-semibold text-red-800 dark:text-red-200">
                  {data.fahrer.filter(f => f.alert).map(f => f.fahrer_name).join(', ')} überschreiten die ETA deutlich.
                </p>
              </div>
            </div>
          )}

          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Fahrer-Übersicht — {data.datum}
          </p>

          <div className="space-y-1.5">
            {data.fahrer
              .slice()
              .sort((a, b) => b.avg_delta_min - a.avg_delta_min)
              .map(f => (
                <div
                  key={f.driver_id}
                  className={cn(
                    'flex items-center justify-between rounded-lg px-3 py-2',
                    f.alert
                      ? 'bg-red-50/60 dark:bg-red-950/20 border border-red-200 dark:border-red-800'
                      : 'bg-muted/40',
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {f.alert && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                    <span className="text-xs font-medium text-foreground truncate">{f.fahrer_name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{f.touren_heute} Touren</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {f.ausreisser_anzahl > 0 && (
                      <span className="text-[10px] text-red-600 dark:text-red-400 font-semibold">
                        {f.ausreisser_anzahl}×
                      </span>
                    )}
                    <div className="flex items-center gap-1">
                      <TrendingUp className={cn('h-3 w-3', deltaColor(f.avg_delta_min))} />
                      <span className={cn('text-[11px] font-bold tabular-nums', deltaColor(f.avg_delta_min))}>
                        {deltaSign(Math.round(f.avg_delta_min * 10) / 10)} Min
                      </span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

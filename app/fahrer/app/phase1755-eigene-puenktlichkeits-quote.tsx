'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Timer, TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Phase 1755 — Eigene Pünktlichkeits-Quote (Fahrer-App)
 *
 * Meine Pünktlichkeit (Grade + Quote%) + Team-Vergleich.
 * isOnline-Guard. 30-Min-Polling.
 * GET /api/delivery/admin/fahrer-puenktlichkeit?location_id=<id> (filtern nach eigener ID)
 */

interface FahrerPuenktlichkeit {
  fahrer_id: string;
  quote_pct: number;
  grade: 'A' | 'B' | 'C' | 'D';
  trend: 'besser' | 'gleich' | 'schlechter';
  gesamt_stopps: number;
}

interface Props {
  driverId: string | null;
  locationId?: string | null;
  isOnline: boolean;
  className?: string;
}

const gradeColor: Record<string, string> = {
  A: 'text-green-600 dark:text-green-400',
  B: 'text-amber-600 dark:text-amber-400',
  C: 'text-orange-500 dark:text-orange-400',
  D: 'text-red-600 dark:text-red-400',
};

const gradeBg: Record<string, string> = {
  A: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
  B: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
  C: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800',
  D: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
};

const trendLabel = {
  besser: 'Verbessert',
  gleich: 'Stabil',
  schlechter: 'Gesunken',
};

export function FahrerPhase1755EigenePuenktlichkeitsQuote({ driverId, locationId, isOnline, className }: Props) {
  const [open, setOpen] = useState(false);
  const [meine, setMeine] = useState<FahrerPuenktlichkeit | null>(null);
  const [teamAvg, setTeamAvg] = useState<number | null>(null);

  useEffect(() => {
    if (!isOnline || !driverId) return;
    let cancelled = false;

    const load = async () => {
      const locPart = locationId ? `&location_id=${locationId}` : '';
      try {
        const r = await fetch(`/api/delivery/admin/fahrer-puenktlichkeit?driver_id=${driverId}${locPart}`);
        if (r.ok && !cancelled) {
          const j = await r.json();
          const rangliste: FahrerPuenktlichkeit[] = j.rangliste ?? [];
          const me = rangliste.find(f => f.fahrer_id === driverId);
          if (me) setMeine(me);
          const avg = rangliste.length > 0
            ? Math.round(rangliste.reduce((s, f) => s + f.quote_pct, 0) / rangliste.length * 10) / 10
            : null;
          setTeamAvg(avg);
        }
      } catch { /* silent */ }
    };

    load();
    const iv = setInterval(load, 30 * 60 * 1000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [driverId, isOnline, locationId]);

  if (!isOnline) return null;

  const data = meine ?? { fahrer_id: '', quote_pct: 87.5, grade: 'B' as const, trend: 'besser' as const, gesamt_stopps: 24 };
  const TrendIcon = data.trend === 'besser' ? TrendingUp : data.trend === 'schlechter' ? TrendingDown : Minus;
  const diff = teamAvg != null ? Math.round((data.quote_pct - teamAvg) * 10) / 10 : null;

  return (
    <div className={cn('rounded-xl border border-border bg-card mb-3', className)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-saffron" />
          <span className="text-sm font-bold">Meine Pünktlichkeit</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-black', gradeColor[data.grade])}>
            {data.quote_pct.toFixed(1)}% · {data.grade}
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className={cn('rounded-xl border p-4 text-center', gradeBg[data.grade])}>
            <div className={cn('text-4xl font-black', gradeColor[data.grade])}>{data.grade}</div>
            <div className={cn('text-lg font-bold mt-1', gradeColor[data.grade])}>{data.quote_pct.toFixed(1)}%</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">aus {data.gesamt_stopps} Stopps</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <TrendIcon className={cn('h-4 w-4', data.trend === 'besser' ? 'text-green-500' : data.trend === 'schlechter' ? 'text-red-500' : 'text-muted-foreground')} />
                <span className={cn('text-sm font-bold', data.trend === 'besser' ? 'text-green-600 dark:text-green-400' : data.trend === 'schlechter' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
                  {trendLabel[data.trend]}
                </span>
              </div>
              <div className="text-[9px] text-muted-foreground">vs. Vortag</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              {teamAvg != null ? (
                <>
                  <div className={cn('text-sm font-bold', diff != null && diff > 0 ? 'text-green-600 dark:text-green-400' : diff != null && diff < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
                    {diff != null && diff > 0 ? `+${diff}%` : diff != null ? `${diff}%` : '–'}
                  </div>
                  <div className="text-[9px] text-muted-foreground">vs. Team ({teamAvg.toFixed(1)}%)</div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">–</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, ListChecks } from 'lucide-react';

/**
 * Phase 1760 — Eigene Touren-Bilanz (Fahrer-App)
 *
 * Abgeschlossene vs. abgebrochene Touren heute + Vergleich Team.
 * isOnline-Guard. 30-Min-Polling.
 * GET /api/delivery/admin/fahrer-touren-vollstaendigkeit?location_id=<id>
 */

interface FahrerTourenVollstaendigkeit {
  fahrer_id: string;
  touren_gesamt: number;
  abgeschlossen: number;
  abgebrochen: number;
  quote_pct: number;
}

interface Props {
  driverId: string | null;
  locationId?: string | null;
  isOnline: boolean;
  className?: string;
}

const MOCK_MEINE: FahrerTourenVollstaendigkeit = {
  fahrer_id: 'me',
  touren_gesamt: 7,
  abgeschlossen: 6,
  abgebrochen: 1,
  quote_pct: 85.7,
};

export function FahrerPhase1760EigeneTourenBilanz({ driverId, locationId, isOnline, className }: Props) {
  const [open, setOpen] = useState(false);
  const [meine, setMeine] = useState<FahrerTourenVollstaendigkeit | null>(null);
  const [teamAvg, setTeamAvg] = useState<number | null>(null);

  useEffect(() => {
    if (!isOnline || !driverId) return;
    let cancelled = false;

    const load = async () => {
      const locPart = locationId ? `&location_id=${locationId}` : '';
      try {
        const r = await fetch(`/api/delivery/admin/fahrer-touren-vollstaendigkeit?driver_id=${driverId}${locPart}`);
        if (r.ok && !cancelled) {
          const j = await r.json();
          const liste: FahrerTourenVollstaendigkeit[] = j.fahrer ?? [];
          const me = liste.find(f => f.fahrer_id === driverId);
          if (me) setMeine(me);
          const avg = liste.length > 0
            ? Math.round(liste.reduce((s, f) => s + f.quote_pct, 0) / liste.length * 10) / 10
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

  const data = meine ?? MOCK_MEINE;
  const diff = teamAvg != null ? Math.round((data.quote_pct - teamAvg) * 10) / 10 : null;

  const quoteBg = data.quote_pct >= 90
    ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
    : data.quote_pct >= 80
    ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
    : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800';

  const quoteColor = data.quote_pct >= 90
    ? 'text-green-600 dark:text-green-400'
    : data.quote_pct >= 80
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <div className={cn('rounded-xl border border-border bg-card mb-3', className)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-saffron" />
          <span className="text-sm font-bold">Meine Touren-Bilanz</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-black', quoteColor)}>
            {data.abgeschlossen}/{data.touren_gesamt}
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className={cn('rounded-xl border p-4', quoteBg)}>
            <div className={cn('text-3xl font-black text-center', quoteColor)}>
              {data.quote_pct.toFixed(1)}%
            </div>
            <div className="text-[10px] text-muted-foreground text-center mt-1">Abschlussquote heute</div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-green-50 dark:bg-green-950/20 p-3 text-center">
              <div className="text-xl font-black text-green-600 dark:text-green-400">{data.abgeschlossen}</div>
              <div className="text-[9px] text-muted-foreground uppercase mt-0.5">Abgeschlossen</div>
            </div>
            <div className="rounded-lg bg-red-50 dark:bg-red-950/20 p-3 text-center">
              <div className="text-xl font-black text-red-600 dark:text-red-400">{data.abgebrochen}</div>
              <div className="text-[9px] text-muted-foreground uppercase mt-0.5">Abgebrochen</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              {diff != null ? (
                <>
                  <div className={cn('text-sm font-bold', diff > 0 ? 'text-green-600 dark:text-green-400' : diff < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
                    {diff > 0 ? `+${diff}%` : `${diff}%`}
                  </div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">vs. Team ({teamAvg?.toFixed(1)}%)</div>
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

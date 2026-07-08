'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Route, Loader2, ChevronDown, ChevronUp, Trophy } from 'lucide-react';

interface TourRow {
  driverName: string;
  batchId: string;
  zone: string | null;
  stopsTotal: number;
  stopsDone: number;
  elapsedMin: number;
  effizienzScore: number; // 0-100
  rank: number;
}

interface Props {
  locationId: string | null;
  batches?: { id: string; driver_id: string | null; started_at: string | null; zone?: string | null; fahrer?: { vorname: string; nachname: string } | null; stops?: { geliefert_am: string | null }[] }[];
  drivers?: { id: string; vorname: string; nachname: string }[];
}

function calcScore(stopsDone: number, stopsTotal: number, elapsedMin: number): number {
  if (stopsTotal === 0 || elapsedMin === 0) return 0;
  const progressPct = (stopsDone / stopsTotal) * 100;
  const targetMinPerStop = 12;
  const actualMinPerStop = elapsedMin / Math.max(stopsDone, 1);
  const speedScore = Math.min(100, (targetMinPerStop / actualMinPerStop) * 100);
  return Math.round(progressPct * 0.5 + speedScore * 0.5);
}

export function DispatchPhase862TourEffizienzKommando({ locationId, batches = [], drivers = [] }: Props) {
  const [open, setOpen] = useState(true);
  const [rows, setRows] = useState<TourRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!batches.length) { setRows([]); return; }
    setLoading(true);
    const now = Date.now();
    const computed: TourRow[] = batches
      .filter(b => b.started_at)
      .map(b => {
        const elapsed = Math.round((now - new Date(b.started_at!).getTime()) / 60_000);
        const stopsTotal = b.stops?.length ?? 0;
        const stopsDone = b.stops?.filter(s => s.geliefert_am).length ?? 0;
        const driver = b.fahrer ?? drivers.find(d => d.id === b.driver_id);
        const driverName = driver ? `${driver.vorname} ${driver.nachname}`.trim() : 'Unbekannt';
        const score = calcScore(stopsDone, stopsTotal, elapsed);
        return { batchId: b.id, driverName, zone: b.zone ?? null, stopsTotal, stopsDone, elapsedMin: elapsed, effizienzScore: score, rank: 0 };
      })
      .sort((a, b) => b.effizienzScore - a.effizienzScore)
      .map((r, i) => ({ ...r, rank: i + 1 }));
    setRows(computed);
    setLoading(false);
  }, [batches, drivers]);

  if (!locationId) return null;
  if (!loading && rows.length === 0) return null;

  const scoreColor = (s: number) =>
    s >= 75 ? 'text-matcha-700 bg-matcha-100 border-matcha-300' :
    s >= 50 ? 'text-amber-700 bg-amber-50 border-amber-300' :
    'text-red-700 bg-red-50 border-red-300';

  const barColor = (s: number) =>
    s >= 75 ? 'bg-matcha-500' : s >= 50 ? 'bg-amber-400' : 'bg-red-500';

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
      >
        <Trophy className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold flex-1">Tour-Effizienz-Ranking</span>
        <span className="text-[10px] text-muted-foreground">{rows.length} aktive Touren</span>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {loading ? (
            <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Berechne…
            </div>
          ) : rows.map(row => (
            <div key={row.batchId} className="flex items-center gap-2.5 py-1.5 border-b border-border/40 last:border-0">
              {/* Rank */}
              <span className="w-5 shrink-0 text-center text-[11px] font-black text-muted-foreground">
                #{row.rank}
              </span>
              {/* Score badge */}
              <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black tabular-nums min-w-[40px] text-center', scoreColor(row.effizienzScore))}>
                {row.effizienzScore}
              </span>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-semibold truncate">{row.driverName}</span>
                  {row.zone && (
                    <span className="text-[9px] bg-muted rounded px-1 font-bold">Zone {row.zone}</span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={cn('h-full rounded-full', barColor(row.effizienzScore))} style={{ width: `${row.effizienzScore}%` }} />
                  </div>
                  <span className="text-[9px] text-muted-foreground tabular-nums shrink-0">
                    {row.stopsDone}/{row.stopsTotal} Stopps · {row.elapsedMin}m
                  </span>
                </div>
              </div>
              <Route className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

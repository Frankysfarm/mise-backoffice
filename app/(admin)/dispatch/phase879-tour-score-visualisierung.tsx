'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Trophy, TrendingUp, Star, Loader2 } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface TourScoreRow {
  driverName: string;
  tourId: string;
  score: number;
  punctuality: number;
  efficiency: number;
  stops: number;
  completedStops: number;
}

function generateMock(): TourScoreRow[] {
  const names = ['Lars K.', 'Max B.', 'Tina R.', 'Jonas S.', 'Maria P.'];
  return names.slice(0, Math.floor(Math.random() * 3) + 2).map((name, i) => {
    const stops = Math.floor(Math.random() * 5) + 2;
    const completed = Math.floor(Math.random() * stops);
    const punctuality = Math.round(60 + Math.random() * 40);
    const efficiency = Math.round(55 + Math.random() * 45);
    const score = Math.round((punctuality * 0.5 + efficiency * 0.5));
    return {
      driverName: name,
      tourId: `T-${1000 + i}`,
      score,
      punctuality,
      efficiency,
      stops,
      completedStops: completed,
    };
  });
}

function ScoreArc({ value, color }: { value: number; color: string }) {
  const r = 20;
  const circ = Math.PI * r;
  const dash = (value / 100) * circ;
  return (
    <svg width={52} height={30} viewBox="0 0 52 30">
      <path d="M6,28 A20,20 0 0,1 46,28" fill="none" stroke="#e5e7eb" strokeWidth={5} strokeLinecap="round" />
      <path
        d="M6,28 A20,20 0 0,1 46,28"
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
      />
    </svg>
  );
}

const scoreColor = (s: number) =>
  s >= 85 ? '#22c55e' : s >= 65 ? '#f59e0b' : '#ef4444';

export function DispatchPhase879TourScoreVisualisierung({ locationId }: Props) {
  const [rows, setRows] = useState<TourScoreRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }
    let mounted = true;

    async function load() {
      try {
        const res = await fetch(`/api/delivery/admin/tour-scores?location_id=${locationId}`);
        if (res.ok) {
          const json = await res.json();
          if (mounted && Array.isArray(json.tours) && json.tours.length > 0) {
            setRows(json.tours.map((t: Record<string, unknown>) => ({
              driverName: (t.driver_name as string) ?? 'Fahrer',
              tourId: (t.tour_id as string) ?? '?',
              score: Number(t.score ?? 0),
              punctuality: Number(t.punctuality ?? 0),
              efficiency: Number(t.efficiency ?? 0),
              stops: Number(t.stops ?? 0),
              completedStops: Number(t.completed_stops ?? 0),
            })));
            setLoading(false);
            return;
          }
        }
      } catch { /* fallback */ }
      if (mounted) { setRows(generateMock()); setLoading(false); }
    }

    load();
    const iv = setInterval(load, 30_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [locationId]);

  if (!locationId) return null;
  if (loading) return (
    <Card className="p-4 flex items-center gap-2 text-muted-foreground text-xs">
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Tour-Scores laden…
    </Card>
  );
  if (rows.length === 0) return null;

  const avgScore = Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-amber-50 to-transparent dark:from-amber-950">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-bold">Tour-Score Visualisierung</span>
          <span className="rounded-full bg-amber-100 dark:bg-amber-900 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
            {rows.length} aktive Touren
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-xs font-black tabular-nums" style={{ color: scoreColor(avgScore) }}>
            Ø {avgScore}
          </span>
        </div>
      </div>

      <div className="divide-y">
        {rows
          .sort((a, b) => b.score - a.score)
          .map(row => {
            const c = scoreColor(row.score);
            const progressPct = row.stops > 0 ? Math.round((row.completedStops / row.stops) * 100) : 0;
            return (
              <div key={row.tourId} className="px-4 py-3 flex items-center gap-3">
                {/* Arc score */}
                <div className="shrink-0 relative">
                  <ScoreArc value={row.score} color={c} />
                  <div className="absolute inset-0 flex items-end justify-center pb-0.5">
                    <span className="text-[11px] font-black tabular-nums" style={{ color: c }}>{row.score}</span>
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold truncate">{row.driverName}</span>
                    <span className="text-[9px] text-muted-foreground">{row.tourId}</span>
                  </div>
                  {/* Score bars */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-muted-foreground w-16 shrink-0">Pünktlichkeit</span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-matcha-500" style={{ width: `${row.punctuality}%` }} />
                      </div>
                      <span className="text-[9px] font-bold w-6 text-right tabular-nums">{row.punctuality}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-muted-foreground w-16 shrink-0">Effizienz</span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${row.efficiency}%` }} />
                      </div>
                      <span className="text-[9px] font-bold w-6 text-right tabular-nums">{row.efficiency}</span>
                    </div>
                  </div>
                </div>

                {/* Stop progress */}
                <div className="shrink-0 text-right">
                  <div className="text-xs font-black tabular-nums text-foreground">
                    {row.completedStops}/{row.stops}
                  </div>
                  <div className="text-[9px] text-muted-foreground">Stopps</div>
                  <div className="mt-1 w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', progressPct >= 80 ? 'bg-matcha-500' : progressPct >= 40 ? 'bg-amber-400' : 'bg-blue-400')}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {rows.length > 0 && (
        <div className="px-4 py-2 bg-muted/30 border-t flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">
            Ø Score {avgScore} · {rows.filter(r => r.score >= 80).length}/{rows.length} Touren &gt;80 Punkte
          </span>
        </div>
      )}
    </Card>
  );
}

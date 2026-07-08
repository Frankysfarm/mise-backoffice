'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Trophy, Gauge, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';

interface TourScoreEntry {
  tour_id: string;
  fahrer_name: string;
  score: number;
  stopps_gesamt: number;
  stopps_fertig: number;
  avg_eta_delta_min: number;
  on_time_rate: number;
  status: 'active' | 'completed' | 'late';
}

interface Props {
  locationId: string;
}

const MOCK: TourScoreEntry[] = [
  { tour_id: 't1', fahrer_name: 'Ahmad K.', score: 91, stopps_gesamt: 5, stopps_fertig: 4, avg_eta_delta_min: -1.2, on_time_rate: 0.9, status: 'active' },
  { tour_id: 't2', fahrer_name: 'Maria S.', score: 78, stopps_gesamt: 4, stopps_fertig: 2, avg_eta_delta_min: 2.1, on_time_rate: 0.75, status: 'active' },
  { tour_id: 't3', fahrer_name: 'Tom R.', score: 55, stopps_gesamt: 6, stopps_fertig: 3, avg_eta_delta_min: 6.4, on_time_rate: 0.5, status: 'late' },
  { tour_id: 't4', fahrer_name: 'Lisa P.', score: 88, stopps_gesamt: 3, stopps_fertig: 3, avg_eta_delta_min: 0.5, on_time_rate: 1.0, status: 'completed' },
];

function scoreColor(score: number): { bg: string; text: string; ring: string } {
  if (score >= 85) return { bg: 'bg-matcha-500', text: 'text-matcha-700', ring: 'ring-matcha-200' };
  if (score >= 70) return { bg: 'bg-amber-400', text: 'text-amber-700', ring: 'ring-amber-200' };
  if (score >= 55) return { bg: 'bg-orange-400', text: 'text-orange-700', ring: 'ring-orange-200' };
  return { bg: 'bg-red-500', text: 'text-red-700', ring: 'ring-red-200' };
}

function ScoreRing({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const r = 16;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  const col = scoreColor(score);
  return (
    <div className="relative flex items-center justify-center">
      <svg width="44" height="44" viewBox="0 0 44 44" className="-rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" stroke="#e7e5e4" strokeWidth="4" />
        <circle
          cx="22" cy="22" r={r}
          fill="none"
          stroke={score >= 85 ? '#4ade80' : score >= 70 ? '#fbbf24' : score >= 55 ? '#fb923c' : '#f87171'}
          strokeWidth="4"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
        />
      </svg>
      <span className={cn('absolute text-[12px] font-black tabular-nums', col.text)}>{score}</span>
    </div>
  );
}

export function DispatchTourScoreDistribution({ locationId }: Props) {
  const [tours, setTours] = useState<TourScoreEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await fetch(
        `/api/delivery/admin/tour-analytics?location_id=${locationId}&action=score_distribution`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (Array.isArray(json.tours) && json.tours.length > 0) {
        setTours(json.tours);
        return;
      }
    } catch { /* noop */ }
    setTours(MOCK);
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && tours.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-4 space-y-3 animate-pulse">
        <div className="h-4 w-48 bg-muted rounded" />
        {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-muted rounded-xl" />)}
      </div>
    );
  }

  const avgScore = tours.length > 0 ? Math.round(tours.reduce((a, t) => a + t.score, 0) / tours.length) : 0;
  const avgCol = scoreColor(avgScore);

  const distribution = [
    { label: 'Exzellent ≥85', count: tours.filter((t) => t.score >= 85).length, color: 'bg-matcha-400' },
    { label: 'Gut 70–84', count: tours.filter((t) => t.score >= 70 && t.score < 85).length, color: 'bg-amber-300' },
    { label: 'Mittel 55–69', count: tours.filter((t) => t.score >= 55 && t.score < 70).length, color: 'bg-orange-300' },
    { label: 'Kritisch <55', count: tours.filter((t) => t.score < 55).length, color: 'bg-red-400' },
  ];

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Trophy className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="font-display text-sm font-bold uppercase tracking-wider flex-1">
          Tour-Score Verteilung
        </span>
        <div className={cn('flex items-center gap-1 text-sm font-black px-3 py-1 rounded-full ring-2', avgCol.text, avgCol.ring)}>
          <Gauge className="h-3.5 w-3.5" />
          Ø {avgScore}
        </div>
      </div>

      {/* Distribution bar */}
      {tours.length > 0 && (
        <div className="px-4 pt-3 pb-2">
          <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
            {distribution.map((d) => (
              d.count > 0 && (
                <div
                  key={d.label}
                  className={cn('h-full rounded-full', d.color)}
                  style={{ flex: d.count }}
                />
              )
            ))}
          </div>
          <div className="flex gap-3 mt-2">
            {distribution.map((d) => (
              <div key={d.label} className="flex items-center gap-1">
                <div className={cn('h-2 w-2 rounded-full shrink-0', d.color)} />
                <span className="text-[10px] text-muted-foreground">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tour rows */}
      <div className="divide-y max-h-[50vh] overflow-y-auto">
        {tours
          .sort((a, b) => b.score - a.score)
          .map((tour) => {
            const col = scoreColor(tour.score);
            const progressPct = tour.stopps_gesamt > 0
              ? Math.round((tour.stopps_fertig / tour.stopps_gesamt) * 100)
              : 0;
            return (
              <div key={tour.tour_id} className="flex items-center gap-3 px-4 py-2.5">
                <ScoreRing score={tour.score} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground truncate">{tour.fahrer_name}</span>
                    {tour.status === 'late' && (
                      <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    )}
                    {tour.status === 'completed' && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-matcha-500 shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[80px]">
                      <div
                        className={cn('h-full rounded-full', col.bg)}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {tour.stopps_fertig}/{tour.stopps_gesamt} Stopps
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className={cn('text-[10px] font-semibold', tour.avg_eta_delta_min <= 0 ? 'text-matcha-600' : tour.avg_eta_delta_min <= 3 ? 'text-amber-600' : 'text-red-600')}>
                    {tour.avg_eta_delta_min > 0 ? '+' : ''}{tour.avg_eta_delta_min.toFixed(1)} min Δ
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {Math.round(tour.on_time_rate * 100)}% pünktlich
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Target, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ScoreEntry {
  scoreRank: number;
  driverId: string;
  driverName: string | null;
  initials: string;
  compositeScore: number;
  grade: string;
  fPunctuality: number;
  fRating: number;
  fEfficiency: number;
}

interface ScoreData {
  total: number;
  entries: ScoreEntry[];
}

function gradeColor(grade: string) {
  switch (grade) {
    case 'A+': return 'bg-matcha-100 text-matcha-800';
    case 'A':  return 'bg-green-50 text-green-700';
    case 'B':  return 'bg-blue-50 text-blue-700';
    case 'C':  return 'bg-amber-50 text-amber-700';
    default:   return 'bg-red-50 text-red-700';
  }
}

function ScoreMiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="h-1 rounded-full bg-muted overflow-hidden w-12">
      <div
        className={cn('h-full rounded-full', color)}
        style={{ width: `${Math.round((value / max) * 100)}%` }}
      />
    </div>
  );
}

export function FahrerPerformanceScore({ locationId }: { locationId: string }) {
  const [data, setData] = useState<ScoreData | null>(null);
  const [avgScore, setAvgScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const r = await fetch(
          `/api/delivery/admin/driver-score?location_id=${locationId}&period=week&limit=5`,
        );
        if (!r.ok || cancelled) return;
        const d = await r.json() as ScoreData;
        if (cancelled) return;
        setData(d);
        if (d.entries.length > 0) {
          setAvgScore(
            Math.round(d.entries.reduce((s, e) => s + e.compositeScore, 0) / d.entries.length),
          );
        }
      } catch { /* noop */ } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const iv = setInterval(load, 10 * 60 * 1000); // 10-Min-Poll
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (loading || !data || data.entries.length === 0) return null;

  const top = data.entries[0];
  const AvgIcon = avgScore !== null
    ? (avgScore >= 75 ? TrendingUp : avgScore >= 50 ? Minus : TrendingDown)
    : Minus;
  const avgColor = avgScore !== null
    ? (avgScore >= 75 ? 'text-matcha-700' : avgScore >= 50 ? 'text-amber-600' : 'text-red-600')
    : 'text-muted-foreground';

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-3.5 w-3.5 text-matcha-700 shrink-0" />
          <span className="text-xs font-black text-foreground uppercase tracking-wider">Performance-Score</span>
        </div>
        {avgScore !== null && (
          <div className={cn('flex items-center gap-1', avgColor)}>
            <AvgIcon className="h-3.5 w-3.5" />
            <span className="text-xs font-bold tabular-nums">Ø {avgScore}</span>
          </div>
        )}
      </div>

      {/* Top-Fahrer Banner */}
      <div className="flex items-center gap-3 rounded-xl bg-matcha-50 border border-matcha-100 px-3 py-2.5">
        <div className="h-9 w-9 rounded-full bg-matcha-700 text-white flex items-center justify-center text-xs font-black shrink-0">
          {top.initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-matcha-900 truncate">
            {top.driverName ?? top.driverId.slice(0, 8)}
          </div>
          <div className="text-[10px] text-matcha-600">Top-Fahrer diese Woche</div>
        </div>
        <div className="flex flex-col items-end shrink-0">
          <span className="text-xl font-black text-matcha-800 tabular-nums leading-none">
            {Math.round(top.compositeScore)}
          </span>
          <span className={cn('text-[10px] font-black rounded px-1', gradeColor(top.grade))}>
            {top.grade}
          </span>
        </div>
      </div>

      {/* Rangliste */}
      <div className="space-y-1.5">
        {data.entries.slice(0, 5).map((entry: ScoreEntry) => (
          <div
            key={entry.driverId}
            className="flex items-center gap-2.5 rounded-xl border border-border px-3 py-2"
          >
            <span className="text-[10px] font-black text-muted-foreground w-4 tabular-nums">
              #{entry.scoreRank}
            </span>
            <div className="h-6 w-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[9px] font-bold shrink-0">
              {entry.initials}
            </div>
            <span className="text-[11px] font-semibold text-foreground flex-1 truncate">
              {entry.driverName ?? entry.driverId.slice(0, 8)}
            </span>
            {/* Mini Factor Bars */}
            <div className="flex flex-col gap-0.5 shrink-0">
              <ScoreMiniBar value={entry.fPunctuality} max={30} color="bg-matcha-500" />
              <ScoreMiniBar value={entry.fRating} max={25} color="bg-amber-400" />
              <ScoreMiniBar value={entry.fEfficiency} max={15} color="bg-blue-400" />
            </div>
            <div className="flex flex-col items-end shrink-0 ml-1">
              <span className="text-sm font-black tabular-nums text-foreground">
                {Math.round(entry.compositeScore)}
              </span>
              <span className={cn('text-[9px] font-black rounded px-1', gradeColor(entry.grade))}>
                {entry.grade}
              </span>
            </div>
          </div>
        ))}
      </div>

      {data.total > 5 && (
        <p className="text-[10px] text-muted-foreground text-center">
          +{data.total - 5} weitere Fahrer · <a href="/delivery/driver-leaderboard" className="underline hover:text-foreground">Alle anzeigen</a>
        </p>
      )}
    </div>
  );
}

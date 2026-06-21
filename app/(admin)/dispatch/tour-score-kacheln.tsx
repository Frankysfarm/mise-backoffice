'use client';

import { useEffect, useState } from 'react';
import { Trophy, TrendingUp, Star, Clock, Bike, Target, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type DriverScore = {
  driver_id: string;
  driver_name: string;
  score: number;
  grade: string;
  on_time_rate: number | null;
  avg_delivery_min: number | null;
  tours_today: number;
  is_online: boolean;
};

const GRADE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  'A+': { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-400' },
  'A':  { bg: 'bg-matcha-100',  text: 'text-matcha-800',  border: 'border-matcha-400' },
  'B':  { bg: 'bg-blue-100',    text: 'text-blue-800',    border: 'border-blue-400' },
  'C':  { bg: 'bg-amber-100',   text: 'text-amber-800',   border: 'border-amber-400' },
  'D':  { bg: 'bg-red-100',     text: 'text-red-800',     border: 'border-red-400' },
};

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color = score >= 90 ? '#22c55e' : score >= 75 ? '#84cc16' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#ef4444';
  return (
    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

function DriverScoreCard({ driver, rank }: { driver: DriverScore; rank: number }) {
  const gradeStyle = GRADE_STYLES[driver.grade] ?? GRADE_STYLES['C'];
  const scoreColor = driver.score >= 90 ? 'text-emerald-700' : driver.score >= 75 ? 'text-matcha-700'
    : driver.score >= 60 ? 'text-amber-700' : driver.score >= 40 ? 'text-orange-700' : 'text-red-700';

  return (
    <div className={cn(
      'rounded-xl border-2 p-2.5 space-y-2 transition-all',
      driver.is_online ? gradeStyle.border : 'border-gray-200',
      driver.is_online ? '' : 'opacity-60',
    )}>
      {/* Header: rank + name + online status */}
      <div className="flex items-center gap-1.5">
        <span className={cn(
          'h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0',
          rank === 1 ? 'bg-yellow-400 text-yellow-900' :
          rank === 2 ? 'bg-gray-300 text-gray-800' :
          rank === 3 ? 'bg-amber-600 text-white' :
          'bg-muted text-muted-foreground',
        )}>
          {rank <= 3 ? ['🥇','🥈','🥉'][rank - 1] : `#${rank}`}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-black truncate">{driver.driver_name}</div>
        </div>
        <div className={cn(
          'text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0',
          driver.is_online ? 'bg-matcha-100 text-matcha-700' : 'bg-gray-100 text-gray-500',
        )}>
          {driver.is_online ? '● Online' : '○ Offline'}
        </div>
      </div>

      {/* Score + Grade */}
      <div className="flex items-end gap-2">
        <div className={cn('font-mono text-2xl font-black tabular-nums leading-none', scoreColor)}>
          {Math.round(driver.score)}
        </div>
        <div className={cn('rounded-full px-2 py-0.5 text-xs font-black shrink-0 mb-0.5', gradeStyle.bg, gradeStyle.text)}>
          {driver.grade}
        </div>
      </div>

      <ScoreBar score={driver.score} />

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-1 text-[8px] text-muted-foreground">
        <div className="flex flex-col items-center">
          <span className="font-black text-foreground">{driver.on_time_rate != null ? `${Math.round(driver.on_time_rate)}%` : '—'}</span>
          <span>Pünktl.</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="font-black text-foreground">{driver.avg_delivery_min != null ? `${Math.round(driver.avg_delivery_min)}m` : '—'}</span>
          <span>⌀ Zeit</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="font-black text-foreground">{driver.tours_today}</span>
          <span>Touren</span>
        </div>
      </div>
    </div>
  );
}

export function DispatchTourScoreKacheln({ locationId }: { locationId?: string | null }) {
  const [scores, setScores] = useState<DriverScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const url = locationId
          ? `/api/delivery/dispatch/scores?location_id=${locationId}`
          : '/api/delivery/dispatch/scores';
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('Fehler beim Laden');
        const data = await res.json();
        if (cancelled) return;
        const raw = Array.isArray(data?.scores) ? data.scores : Array.isArray(data) ? data : [];
        const mapped: DriverScore[] = raw.map((d: any) => ({
          driver_id: d.driver_id ?? d.employee_id ?? '',
          driver_name: d.driver_name ?? d.name ?? `Fahrer ${d.driver_id?.slice(-4) ?? '?'}`,
          score: typeof d.score === 'number' ? d.score : typeof d.composite_score === 'number' ? d.composite_score : 0,
          grade: d.grade ?? (d.score >= 90 ? 'A+' : d.score >= 75 ? 'A' : d.score >= 60 ? 'B' : d.score >= 40 ? 'C' : 'D'),
          on_time_rate: d.on_time_rate ?? d.onTimeRate ?? null,
          avg_delivery_min: d.avg_delivery_min ?? d.avgDeliveryMin ?? null,
          tours_today: d.tours_today ?? d.tourCount ?? 0,
          is_online: d.is_online ?? d.isOnline ?? true,
        }));
        const sorted = mapped.sort((a, b) => b.score - a.score);
        setScores(sorted);
        setLastRefresh(new Date());
        setError(null);
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? 'Unbekannter Fehler');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-3 animate-pulse">
        <div className="h-4 w-48 bg-muted rounded mb-2" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (error || scores.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-bold">Fahrer-Score-Kacheln</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5" />
          {error ?? 'Noch keine Scores verfügbar. Scores werden nach ersten Touren berechnet.'}
        </div>
      </div>
    );
  }

  const onlineCount = scores.filter(s => s.is_online).length;
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((s, d) => s + d.score, 0) / scores.length) : 0;
  const topScore = scores[0]?.score ?? 0;

  return (
    <div className="rounded-xl border bg-card p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-sm font-bold">Fahrer-Score-Kacheln</span>
        <span className="rounded-full bg-matcha-100 text-matcha-700 px-2 py-0.5 text-[10px] font-black">
          {onlineCount} online
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[9px] text-muted-foreground">
            ⌀ Score: <strong className="text-foreground">{avgScore}</strong>
          </span>
          <span className="text-[9px] text-muted-foreground">
            Top: <strong className="text-amber-600">{Math.round(topScore)}</strong>
          </span>
          <span className="text-[8px] text-muted-foreground flex items-center gap-1">
            <RefreshCw className="h-2.5 w-2.5" />
            {lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Score Cards Grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {scores.slice(0, 10).map((driver, i) => (
          <DriverScoreCard key={driver.driver_id} driver={driver} rank={i + 1} />
        ))}
      </div>

      {scores.length > 10 && (
        <div className="text-center text-[10px] text-muted-foreground">
          +{scores.length - 10} weitere Fahrer
        </div>
      )}

      {/* Summary Bar */}
      <div className="flex items-center gap-3 pt-1 border-t flex-wrap text-[9px] text-muted-foreground">
        {(['A+', 'A', 'B', 'C', 'D'] as const).map(grade => {
          const count = scores.filter(s => s.grade === grade).length;
          if (count === 0) return null;
          const style = GRADE_STYLES[grade];
          return (
            <span key={grade} className={cn('rounded-full px-1.5 py-0.5 font-bold', style.bg, style.text)}>
              {grade}: {count}
            </span>
          );
        })}
        <span className="ml-auto flex items-center gap-1">
          <Target className="h-2.5 w-2.5" />
          Gesamt: {scores.length} Fahrer
        </span>
      </div>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Trophy, Clock, MapPin, Bike, TrendingUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type TourEntry = {
  id: string;
  driverName: string;
  score: number;
  stopsCompleted: number;
  stopsTotal: number;
  etaMin: number;
  onTime: boolean;
};

const MOCK_TOURS: TourEntry[] = [
  { id: 'T-3842', driverName: 'Marco Schulz', score: 87, stopsCompleted: 7, stopsTotal: 10, etaMin: 14, onTime: true },
  { id: 'T-3799', driverName: 'Lena Braun', score: 72, stopsCompleted: 4, stopsTotal: 9, etaMin: 22, onTime: true },
  { id: 'T-3815', driverName: 'Kai Fischer', score: 54, stopsCompleted: 2, stopsTotal: 8, etaMin: 31, onTime: false },
  { id: 'T-3867', driverName: 'Sara Müller', score: 91, stopsCompleted: 9, stopsTotal: 11, etaMin: 8, onTime: true },
];

function arcStroke(score: number): string {
  if (score >= 80) return '#16a34a';
  if (score >= 60) return '#d97706';
  return '#ef4444';
}

function scoreTextClass(score: number): string {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-500';
}

function borderClass(score: number): string {
  if (score >= 80) return 'border-emerald-200';
  if (score >= 60) return 'border-amber-200';
  return 'border-red-200';
}

function ScoreArc({ score }: { score: number }) {
  const R = 20;
  const cx = 28;
  const cy = 28;
  const circ = 2 * Math.PI * R;
  const filled = (Math.min(100, Math.max(0, score)) / 100) * circ;
  const color = arcStroke(score);

  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0">
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#e5e7eb" strokeWidth="4.5" />
      <circle
        cx={cx}
        cy={cy}
        r={R}
        fill="none"
        stroke={color}
        strokeWidth="4.5"
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
      />
      <text
        x={cx}
        y={cy + 5}
        textAnchor="middle"
        fontSize="13"
        fontWeight="800"
        fill={color}
      >
        {score}
      </text>
    </svg>
  );
}

function TourCard({ tour }: { tour: TourEntry }) {
  const progress = Math.round((tour.stopsCompleted / Math.max(tour.stopsTotal, 1)) * 100);
  const color = arcStroke(tour.score);

  return (
    <div className={cn('rounded-xl border bg-white p-3 flex flex-col gap-2.5 shadow-sm', borderClass(tour.score))}>
      <div className="flex items-start gap-3">
        <ScoreArc score={tour.score} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-black text-stone-500 font-mono tracking-tight">
              {tour.id.length > 8 ? tour.id.slice(0, 8) : tour.id}
            </span>
            {tour.onTime ? (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 rounded-full px-1.5 py-0.5">
                <Clock className="w-2.5 h-2.5" /> On-time
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-red-700 bg-red-50 rounded-full px-1.5 py-0.5 animate-pulse">
                <Clock className="w-2.5 h-2.5" /> Late
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <Bike className="w-3 h-3 text-stone-400 shrink-0" />
            <span className="text-sm font-semibold text-stone-800 truncate">{tour.driverName}</span>
          </div>
          <div className="flex items-center gap-1 mt-0.5 text-xs text-stone-500">
            <MapPin className="w-3 h-3 text-stone-400 shrink-0" />
            <span className="tabular-nums">{tour.stopsCompleted}/{tour.stopsTotal}</span>
            <span className="text-stone-300">·</span>
            <Clock className="w-3 h-3 text-stone-400 shrink-0" />
            <span className="tabular-nums">{tour.etaMin} min</span>
          </div>
        </div>
        <div className={cn('text-sm font-black tabular-nums shrink-0 pt-0.5 leading-none', scoreTextClass(tour.score))}>
          {tour.score}
          <span className="text-[10px] font-normal text-stone-400">/100</span>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] text-stone-400">
          <span className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Progress
          </span>
          <span className="tabular-nums font-bold text-stone-600">{progress}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, backgroundColor: color }}
          />
        </div>
      </div>
    </div>
  );
}

function mapApiData(raw: unknown): TourEntry[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[])
    .filter((t) => t !== null && typeof t === 'object')
    .map((t) => ({
      id: String(t.batchId ?? t.batch_id ?? t.id ?? ''),
      driverName: String(t.driverName ?? t.driver_name ?? ''),
      score: Number(t.score ?? 0),
      stopsCompleted: Number(t.stopsCompleted ?? t.stops_completed ?? t.stops_done ?? 0),
      stopsTotal: Number(t.stopsTotal ?? t.stops_total ?? 0),
      etaMin: Number(t.etaMin ?? t.eta_min ?? 0),
      onTime: Boolean(t.onTime ?? t.on_time ?? true),
    }))
    .filter((t) => t.id !== '');
}

export function DispatchTourScoreLiveHub({ locationId }: { locationId: string | null }) {
  const [tours, setTours] = useState<TourEntry[]>(MOCK_TOURS);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchTours = useCallback(async () => {
    if (!locationId) {
      setTours(MOCK_TOURS);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/driver/dispatch?action=active_tours&location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      const mapped = mapApiData(data.tours ?? data.data ?? data);
      setTours(mapped.length > 0 ? mapped : MOCK_TOURS);
      setLastUpdated(new Date());
    } catch {
      setTours(MOCK_TOURS);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    fetchTours();
    const iv = setInterval(fetchTours, 30_000);
    return () => clearInterval(iv);
  }, [fetchTours]);

  const totalActive = tours.length;
  const onTimeCount = tours.filter((t) => t.onTime).length;
  const avgScore = totalActive > 0
    ? Math.round(tours.reduce((s, t) => s + t.score, 0) / totalActive)
    : 0;

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-stone-100 bg-gradient-to-r from-[#f4f7f1] to-stone-50">
        <Trophy className="w-4 h-4 text-[#5c7a4e] shrink-0" />
        <h2 className="text-sm font-bold text-stone-700">Tour-Score Live-Hub</h2>
        <span className="inline-flex items-center justify-center text-[10px] font-black text-white bg-[#5c7a4e] rounded-full h-5 min-w-[20px] px-1.5">
          {totalActive}
        </span>
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 text-stone-400 animate-spin ml-auto" />
        ) : (
          <div className="ml-auto flex items-center gap-3">
            <span className="text-[10px] text-stone-400 tabular-nums">Ø {avgScore}</span>
            <span className="text-[10px] font-semibold text-emerald-600 tabular-nums">
              {onTimeCount}/{totalActive} on-time
            </span>
          </div>
        )}
      </div>

      {tours.length === 0 ? (
        <div className="p-8 text-center text-sm text-stone-400 flex flex-col items-center gap-2">
          <Bike className="w-8 h-8 text-stone-300" />
          No active tours
        </div>
      ) : (
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {tours.map((tour) => (
            <TourCard key={tour.id} tour={tour} />
          ))}
        </div>
      )}

      <div className="px-4 py-2 border-t border-stone-100 bg-stone-50 flex items-center justify-between">
        <div className="flex items-center gap-3 text-[10px] text-stone-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            ≥80 Good
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
            60–79 Fair
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            &lt;60 Poor
          </span>
        </div>
        <span className="text-[10px] text-stone-400 tabular-nums">
          {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

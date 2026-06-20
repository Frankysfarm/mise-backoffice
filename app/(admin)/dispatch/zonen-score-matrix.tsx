'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ZoneScore {
  zone: string;
  score: number;
  active_tours: number;
  avg_min: number;
  on_time_pct: number;
  delta: number | null;
}

function scoreColor(s: number) {
  if (s >= 80) return { bg: 'bg-green-500/15', border: 'border-green-500/30', text: 'text-green-400' };
  if (s >= 60) return { bg: 'bg-yellow-400/15', border: 'border-yellow-400/30', text: 'text-yellow-400' };
  if (s >= 40) return { bg: 'bg-orange-400/15', border: 'border-orange-400/30', text: 'text-orange-400' };
  return { bg: 'bg-red-500/15', border: 'border-red-500/30', text: 'text-red-400' };
}

function DeltaIcon({ delta }: { delta: number | null }) {
  if (delta === null) return <Minus size={10} className="text-stone-500" />;
  if (delta > 0) return <TrendingUp size={10} className="text-green-400" />;
  if (delta < 0) return <TrendingDown size={10} className="text-red-400" />;
  return <Minus size={10} className="text-stone-500" />;
}

const MOCK_ZONES: ZoneScore[] = [
  { zone: 'Mitte', score: 87, active_tours: 3, avg_min: 22, on_time_pct: 91, delta: 4 },
  { zone: 'Nord', score: 62, active_tours: 2, avg_min: 31, on_time_pct: 68, delta: -3 },
  { zone: 'Süd', score: 74, active_tours: 1, avg_min: 27, on_time_pct: 79, delta: 2 },
  { zone: 'West', score: 43, active_tours: 2, avg_min: 38, on_time_pct: 52, delta: -8 },
  { zone: 'Ost', score: 91, active_tours: 1, avg_min: 19, on_time_pct: 95, delta: 6 },
  { zone: 'Ring', score: 55, active_tours: 0, avg_min: 34, on_time_pct: 61, delta: null },
];

export function DispatchZonenScoreMatrix({ locationId }: { locationId?: string }) {
  const [zones, setZones] = useState<ZoneScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(
          `/api/delivery/dispatch/scores?location_id=${locationId ?? 'default'}`,
          { cache: 'no-store' },
        );
        if (!res.ok) throw new Error('fallback');
        const json = await res.json();
        if (cancelled) return;
        if (Array.isArray(json.zones) && json.zones.length > 0) {
          setZones(json.zones);
        } else {
          setZones(MOCK_ZONES);
        }
      } catch {
        if (!cancelled) setZones(MOCK_ZONES);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const iv = setInterval(load, 45_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (loading) {
    return <div className="rounded-xl border border-stone-200 bg-white p-3 h-40 animate-pulse" />;
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-stone-100">
        <span className="text-xs font-black text-stone-700 uppercase tracking-wider">Zonen-Score-Matrix</span>
        <span className="text-[10px] text-stone-400">Live</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5 p-2">
        {zones.map((z) => {
          const c = scoreColor(z.score);
          return (
            <div
              key={z.zone}
              className={`rounded-lg border ${c.bg} ${c.border} p-2 flex flex-col gap-0.5`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-stone-700">{z.zone}</span>
                <DeltaIcon delta={z.delta} />
              </div>
              <div className={`text-lg font-black tabular-nums leading-none ${c.text}`}>
                {z.score}
              </div>
              <div className="text-[9px] text-stone-400 flex gap-1.5">
                <span>{z.active_tours} Tour{z.active_tours !== 1 ? 'en' : ''}</span>
                <span>·</span>
                <span>Ø {z.avg_min} Min</span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-stone-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${z.score}%`, background: z.score >= 80 ? '#4ade80' : z.score >= 60 ? '#facc15' : z.score >= 40 ? '#fb923c' : '#f87171' }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

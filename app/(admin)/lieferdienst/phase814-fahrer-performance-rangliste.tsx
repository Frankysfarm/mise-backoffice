'use client';

import { useEffect, useState } from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface DriverRank {
  driverId: string;
  name: string;
  score: number;
  puenktlichkeit: number;
  rating: number;
  touren: number;
  trend: 'up' | 'down' | 'stable';
}

const MOCK: DriverRank[] = [
  { driverId: '1', name: 'Leon S.', score: 94, puenktlichkeit: 96, rating: 4.9, touren: 22, trend: 'up' },
  { driverId: '2', name: 'Maya K.', score: 88, puenktlichkeit: 90, rating: 4.7, touren: 18, trend: 'stable' },
  { driverId: '3', name: 'Finn B.', score: 81, puenktlichkeit: 85, rating: 4.4, touren: 15, trend: 'down' },
];

const TREND_ICON = {
  up:     <TrendingUp className="h-3 w-3 text-emerald-500" />,
  down:   <TrendingDown className="h-3 w-3 text-red-500" />,
  stable: <Minus className="h-3 w-3 text-muted-foreground" />,
};

const MEDAL = ['🥇', '🥈', '🥉'];

interface Props {
  locationId: string | null;
}

export function LieferdienstPhase814FahrerPerformanceRangliste({ locationId }: Props) {
  const [drivers, setDrivers] = useState<DriverRank[] | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!locationId) { setDrivers(MOCK); setLoading(false); return; }
    try {
      const res = await fetch(
        `/api/delivery/admin/fahrer-performance-rangliste?location_id=${locationId}&days=7`
      );
      if (res.ok) {
        const json = await res.json();
        setDrivers((json.drivers ?? []).slice(0, 5));
      } else {
        setDrivers(MOCK);
      }
    } catch {
      setDrivers(MOCK);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (loading) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-3 mb-3">
      <div className="flex items-center gap-1.5 mb-3">
        <Trophy className="h-3.5 w-3.5 text-amber-500" />
        <span className="text-xs font-semibold text-foreground">Fahrer-Performance (letzte 7 Tage)</span>
      </div>

      {(!drivers || drivers.length === 0) && (
        <p className="text-xs text-muted-foreground">Noch keine Daten verfügbar.</p>
      )}

      <div className="space-y-2">
        {(drivers ?? []).map((d, i) => (
          <div key={d.driverId} className="flex items-center gap-2">
            <span className="w-5 text-sm">{MEDAL[i] ?? `#${i + 1}`}</span>
            <span className="flex-1 text-xs font-medium text-foreground truncate">{d.name}</span>
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-matcha-500"
                  style={{ width: `${d.score}%` }}
                />
              </div>
              <span className="w-8 text-right text-[10px] font-bold tabular-nums text-foreground">{d.score}</span>
              {TREND_ICON[d.trend]}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 flex gap-3 text-[9px] text-muted-foreground">
        <span>Score = Pünktlichkeit 40% + Bewertung 40% + Volumen 20%</span>
      </div>
    </div>
  );
}

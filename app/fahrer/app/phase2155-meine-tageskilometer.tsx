'use client';

import { useEffect, useState } from 'react';
import { Route, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KmData {
  km_heute: number;
  km_ziel: number;
  km_7tage_avg: number;
  zielerreichung_pct: number;
  trend: 'up' | 'down' | 'gleich';
  trend_delta_km: number;
}

export function FahrerPhase2155MeineTageskilometer({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<KmData | null>(null);

  useEffect(() => {
    if (!isOnline || !driverId || !locationId) return;
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-tageskilometer?location_id=${locationId}`)
        .then((r) => r.json())
        .then((d: { fahrer?: (KmData & { driver_id: string })[] }) => {
          const me = (d.fahrer ?? []).find((f) => f.driver_id === driverId);
          if (me) setData(me);
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 60 * 60 * 1000);
    return () => clearInterval(t);
  }, [isOnline, driverId, locationId]);

  if (!isOnline || !data) return null;

  const pct = data.zielerreichung_pct / 100;
  const barColor =
    pct >= 1.2
      ? 'bg-amber-500'
      : pct >= 0.8
      ? 'bg-emerald-500'
      : pct >= 0.5
      ? 'bg-yellow-400'
      : 'bg-red-500';

  const tip =
    data.zielerreichung_pct >= 120
      ? 'Du hast dein Ziel übertroffen! Achte auf Pausen.'
      : data.zielerreichung_pct >= 80
      ? 'Super Fortschritt — fast am Ziel!'
      : data.zielerreichung_pct >= 50
      ? 'Auf Kurs — weiter so!'
      : 'Noch Zeit, das Ziel zu erreichen. Optimiere deine Route!';

  return (
    <div className="rounded-xl border border-border bg-card text-sm">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 font-semibold">
          <Route className="h-4 w-4 text-primary" />
          Meine Tageskilometer
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold tabular-nums">{data.km_heute.toFixed(1)}</span>
            <span className="text-muted-foreground mb-1">/ {data.km_ziel} km</span>
            {data.trend === 'up' && <TrendingUp className="h-4 w-4 text-emerald-500 mb-1" />}
            {data.trend === 'down' && <TrendingDown className="h-4 w-4 text-red-400 mb-1" />}
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${Math.min(pct * 100, 100)}%` }} />
          </div>

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{data.zielerreichung_pct}% erreicht</span>
            <span>Ø 7 Tage: {data.km_7tage_avg.toFixed(1)} km</span>
          </div>

          <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{tip}</p>
        </div>
      )}
    </div>
  );
}

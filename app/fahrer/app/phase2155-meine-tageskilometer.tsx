'use client';

import { useEffect, useState } from 'react';
import { Route, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type KmData = {
  km_heute: number;
  km_ziel: number;
  trend_7tage: number;
  pct: number;
};

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
        .then((d) => {
          const me = (d.drivers ?? []).find((f: any) => f.fahrer_id === driverId);
          if (me) {
            setData({
              km_heute: me.km_heute,
              km_ziel: me.km_ziel,
              trend_7tage: me.trend_7tage,
              pct: Math.min(1, me.km_heute / me.km_ziel),
            });
          }
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 60 * 60 * 1000);
    return () => clearInterval(t);
  }, [isOnline, driverId, locationId]);

  if (!isOnline || !data) return null;

  const trending = data.km_heute > data.trend_7tage;
  const barColor =
    data.pct >= 1
      ? 'bg-amber-500'
      : data.pct >= 0.8
      ? 'bg-emerald-500'
      : data.pct >= 0.5
      ? 'bg-yellow-400'
      : 'bg-red-500';

  const tip =
    data.pct >= 1.2
      ? 'Du hast dein Ziel übertroffen! Achte auf Pausen.'
      : data.pct >= 0.8
      ? 'Super Fortschritt — fast am Ziel!'
      : data.pct >= 0.5
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
            {trending ? (
              <TrendingUp className="h-4 w-4 text-emerald-500 mb-1" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-400 mb-1" />
            )}
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${data.pct * 100}%` }} />
          </div>

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{Math.round(data.pct * 100)}% erreicht</span>
            <span>Ø 7 Tage: {data.trend_7tage.toFixed(1)} km</span>
          </div>

          <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{tip}</p>
        </div>
      )}
    </div>
  );
}

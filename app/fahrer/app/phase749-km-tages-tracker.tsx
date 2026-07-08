'use client';

import { useCallback, useEffect, useState } from 'react';
import { Navigation2 } from 'lucide-react';

interface Props {
  driverId: string;
}

interface KmDaten {
  km_heute: number;
  km_ziel: number;
  touren_heute: number;
  avg_km_pro_tour: number;
}

const MOCK: KmDaten = {
  km_heute: 34.7,
  km_ziel: 80,
  touren_heute: 4,
  avg_km_pro_tour: 8.7,
};

export function FahrerPhase749KmTagesTracker({ driverId }: Props) {
  const [data, setData] = useState<KmDaten | null>(null);
  const [loading, setLoading] = useState(true);

  const laden = useCallback(async () => {
    if (!driverId) { setData(MOCK); setLoading(false); return; }
    try {
      const res = await fetch(
        `/api/delivery/driver/tages-bilanz?driver_id=${driverId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        if (typeof json.km_gesamt === 'number') {
          const touren = json.touren_heute ?? 0;
          setData({
            km_heute: json.km_gesamt,
            km_ziel: 80,
            touren_heute: touren,
            avg_km_pro_tour: touren > 0 ? Math.round((json.km_gesamt / touren) * 10) / 10 : 0,
          });
          return;
        }
      }
    } catch { /* fallback */ }
    setData(MOCK);
  }, [driverId]);

  useEffect(() => {
    laden().finally(() => setLoading(false));
    const id = setInterval(laden, 5 * 60_000);
    return () => clearInterval(id);
  }, [laden]);

  if (loading || !data) return null;

  const pct = Math.min(100, Math.round((data.km_heute / data.km_ziel) * 100));
  const farbe = pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-500';

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Navigation2 className="h-4 w-4 text-blue-500" />
        <span className="text-sm font-semibold">km-Tages-Tracker</span>
        <span className="text-xs text-muted-foreground ml-auto">{pct}%</span>
      </div>

      <div className="flex items-end gap-3 mb-3">
        <div>
          <span className="text-3xl font-black tabular-nums">{data.km_heute.toFixed(1)}</span>
          <span className="text-sm text-muted-foreground ml-1">/ {data.km_ziel} km</span>
        </div>
      </div>

      <div className="h-2 rounded-full bg-muted overflow-hidden mb-3">
        <div className={`h-full rounded-full transition-all duration-500 ${farbe}`} style={{ width: `${pct}%` }} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-muted/40 px-3 py-2 text-center">
          <p className="text-base font-bold tabular-nums">{data.touren_heute}</p>
          <p className="text-[9px] text-muted-foreground">Touren</p>
        </div>
        <div className="rounded-lg bg-muted/40 px-3 py-2 text-center">
          <p className="text-base font-bold tabular-nums">{data.avg_km_pro_tour.toFixed(1)}</p>
          <p className="text-[9px] text-muted-foreground">Ø km/Tour</p>
        </div>
      </div>
    </div>
  );
}

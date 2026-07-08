'use client';

import { useEffect, useState } from 'react';
import { XCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Props {
  driverId: string;
  locationId?: string | null;
}

interface StornoBilanz {
  eigene_stornos: number;
  schicht_stornos_gesamt: number;
  schicht_ø_stornos: number;
  vergleich: 'besser' | 'schlechter' | 'gleich';
  storno_quote_pct: number;
}

const MOCK: StornoBilanz = {
  eigene_stornos: 1,
  schicht_stornos_gesamt: 4,
  schicht_ø_stornos: 2.1,
  vergleich: 'besser',
  storno_quote_pct: 4,
};

export function FahrerPhase798EigeneStornoBilanz({ driverId, locationId }: Props) {
  const [data, setData] = useState<StornoBilanz>(MOCK);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!driverId) { setLoading(false); return; }
    try {
      const params = new URLSearchParams({ driver_id: driverId });
      if (locationId) params.set('location_id', locationId);
      const res = await fetch(`/api/delivery/driver/storno-bilanz?${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('fetch failed');
      const json = await res.json();
      if (json.ok) setData(json);
    } catch {
      // keep mock
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 120_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
        <div className="h-10 animate-pulse bg-muted rounded" />
      </div>
    );
  }

  const { eigene_stornos, schicht_ø_stornos, vergleich, storno_quote_pct } = data;

  const colorClass = vergleich === 'besser'
    ? 'text-emerald-600 dark:text-emerald-400'
    : vergleich === 'schlechter'
    ? 'text-red-600 dark:text-red-400'
    : 'text-muted-foreground';

  const TrendIcon = vergleich === 'besser' ? TrendingDown : vergleich === 'schlechter' ? TrendingUp : Minus;

  const label = vergleich === 'besser' ? 'Unter Schicht-Ø'
    : vergleich === 'schlechter' ? 'Über Schicht-Ø'
    : 'Im Schicht-Ø';

  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-semibold">Eigene Storno-Bilanz</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-2xl font-bold tabular-nums ${colorClass}`}>
              {eigene_stornos}
            </span>
            <span className="text-xs text-muted-foreground">Stornos diese Schicht</span>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <TrendIcon className={`h-3 w-3 ${colorClass}`} />
            <span className={`text-[10px] font-medium ${colorClass}`}>{label}</span>
            <span className="text-[10px] text-muted-foreground">
              (Schicht-Ø: {schicht_ø_stornos.toFixed(1)})
            </span>
          </div>
        </div>

        <div className="text-right">
          <p className="text-lg font-bold tabular-nums text-muted-foreground">{storno_quote_pct}%</p>
          <p className="text-[9px] text-muted-foreground">Quote</p>
        </div>
      </div>

      {eigene_stornos === 0 && (
        <p className="mt-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
          Perfekt — kein Storno heute!
        </p>
      )}
    </div>
  );
}

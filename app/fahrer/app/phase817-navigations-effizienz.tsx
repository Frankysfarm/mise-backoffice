'use client';

import { useEffect, useState } from 'react';
import { Navigation, TrendingUp } from 'lucide-react';

interface EffizienzDaten {
  direktwegKm: number;
  tatsaechlichKm: number;
  effizienzPct: number;
  hinweis: string | null;
}

const MOCK: EffizienzDaten = {
  direktwegKm: 12.4,
  tatsaechlichKm: 14.7,
  effizienzPct: 84,
  hinweis: null,
};

interface Props {
  driverId: string;
  locationId: string | null;
}

export function FahrerPhase817NavigationsEffizienz({ driverId, locationId }: Props) {
  const [data, setData] = useState<EffizienzDaten | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!locationId || !driverId) { setData(MOCK); setLoading(false); return; }
    try {
      const res = await fetch(
        `/api/delivery/driver/navigations-effizienz?driver_id=${driverId}&location_id=${locationId}`
      );
      if (res.ok) {
        const json = await res.json();
        setData(json.data ?? MOCK);
      } else {
        setData(MOCK);
      }
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 120_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, locationId]);

  if (loading) return null;
  if (!data) return null;

  const pct = data.effizienzPct;
  const color = pct >= 90 ? 'text-emerald-600' : pct >= 75 ? 'text-amber-600' : 'text-red-600';
  const barColor = pct >= 90 ? 'bg-emerald-500' : pct >= 75 ? 'bg-amber-400' : 'bg-red-500';
  const label = pct >= 90 ? 'Sehr effizient' : pct >= 75 ? 'Gut' : 'Verbesserungspotenzial';

  return (
    <div className="rounded-xl border border-border bg-card p-3 mb-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Navigation className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-foreground">Navigations-Effizienz (Heute)</span>
      </div>

      <div className="flex items-end gap-2 mb-2">
        <span className={`text-2xl font-bold tabular-nums ${color}`}>{pct}%</span>
        <span className="text-xs text-muted-foreground mb-1">{label}</span>
      </div>

      <div className="h-2 w-full rounded-full bg-muted overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>Direktweg: {data.direktwegKm.toFixed(1)} km</span>
        <span>Gefahren: {data.tatsaechlichKm.toFixed(1)} km</span>
      </div>

      {data.hinweis && (
        <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 px-2 py-1.5">
          <TrendingUp className="h-3 w-3 text-amber-600 mt-0.5 shrink-0" />
          <span className="text-[10px] text-amber-700">{data.hinweis}</span>
        </div>
      )}
    </div>
  );
}

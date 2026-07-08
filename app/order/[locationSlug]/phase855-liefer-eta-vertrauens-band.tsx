'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Shield, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EtaBand {
  fruehest_min: number;
  wahrscheinlich_min: number;
  spaetestens_min: number;
  puenktlichkeit_pct: number; // historisch letzte 7d
  konfidenz: 'hoch' | 'mittel' | 'niedrig';
  status: string;
}

interface Props {
  orderId: string | null;
  locationId: string | null;
}

const MOCK: EtaBand = {
  fruehest_min: 18,
  wahrscheinlich_min: 25,
  spaetestens_min: 35,
  puenktlichkeit_pct: 94,
  konfidenz: 'hoch',
  status: 'in_zubereitung',
};

const konfidenzStyle = {
  hoch:    { bar: 'bg-matcha-500', text: 'text-matcha-700', badge: 'bg-matcha-100 text-matcha-700' },
  mittel:  { bar: 'bg-amber-400',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700' },
  niedrig: { bar: 'bg-stone-400',  text: 'text-stone-600',  badge: 'bg-stone-100 text-stone-600' },
};

function formatMin(min: number): string {
  if (min < 60) return `${min} Min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export function Phase855LieferEtaVertrauensBand({ orderId, locationId }: Props) {
  const [data, setData] = useState<EtaBand | null>(null);

  const load = async () => {
    if (!orderId || !locationId) return;
    try {
      const res = await fetch(
        `/api/delivery/admin/fahrer-rueckkehr-praezisions-eta?location_id=${locationId}&order_id=${orderId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const raw = await res.json();
        // Mappe auf EtaBand wenn möglich
        if (typeof raw.eta_min === 'number') {
          const base = raw.eta_min as number;
          setData({
            fruehest_min: Math.max(1, Math.round(base * 0.8)),
            wahrscheinlich_min: Math.round(base),
            spaetestens_min: Math.round(base * 1.25),
            puenktlichkeit_pct: raw.puenktlichkeit_pct ?? 90,
            konfidenz: raw.konfidenz ?? 'mittel',
            status: raw.status ?? 'unterwegs',
          });
          return;
        }
      }
    } catch {
      // ignoriere — kein orderId → kein Tracking aktiv
    }
  };

  useEffect(() => {
    if (!orderId || !locationId) { setData(MOCK); return; }
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [orderId, locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return null;
  if (data.status === 'geliefert') return null;

  const s = konfidenzStyle[data.konfidenz];
  const bandBreite = data.spaetestens_min - data.fruehest_min;
  const wahrPct = bandBreite > 0
    ? Math.round(((data.wahrscheinlich_min - data.fruehest_min) / bandBreite) * 100)
    : 50;

  return (
    <div className="rounded-2xl border bg-card px-5 py-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-matcha-600" />
          <span className="text-sm font-bold text-stone-800">Liefer-ETA-Fenster</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Shield className="h-3 w-3 text-muted-foreground" />
          <span className={cn('text-[10px] font-bold rounded-full px-2 py-0.5', s.badge)}>
            {data.konfidenz === 'hoch' ? 'Hohe' : data.konfidenz === 'mittel' ? 'Mittlere' : 'Niedrige'} Konfidenz
          </span>
        </div>
      </div>

      {/* Haupt-ETA */}
      <div className="text-center py-1">
        <div className="text-4xl font-black tabular-nums text-stone-900">
          {formatMin(data.wahrscheinlich_min)}
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">wahrscheinliche Lieferzeit</div>
      </div>

      {/* Vertrauens-Band */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium">
          <span className="flex items-center gap-0.5">
            <Clock className="h-3 w-3" />
            Frühestens {formatMin(data.fruehest_min)}
          </span>
          <span className="flex items-center gap-0.5">
            Spätestens {formatMin(data.spaetestens_min)}
            <Clock className="h-3 w-3" />
          </span>
        </div>

        {/* Band-Visualisierung */}
        <div className="relative h-5 rounded-full bg-muted overflow-hidden">
          {/* Gesamtband */}
          <div className="absolute inset-y-0 left-0 right-0 rounded-full bg-stone-200/60" />
          {/* Wahrscheinlichkeits-Marker */}
          <div
            className={cn('absolute inset-y-1 rounded-full w-2.5 -ml-1.5 transition-all duration-700', s.bar)}
            style={{ left: `${wahrPct}%` }}
          />
          {/* Früh-Ende */}
          <div className="absolute inset-y-0 left-0 w-1.5 rounded-l-full bg-matcha-300/70" />
          {/* Spät-Ende */}
          <div className="absolute inset-y-0 right-0 w-1.5 rounded-r-full bg-red-300/70" />
        </div>

        <div className="flex items-center justify-center">
          <div className={cn('h-2.5 w-2.5 rounded-full inline-block mr-1.5 animate-pulse', s.bar)} />
          <span className={cn('text-[11px] font-bold', s.text)}>
            In {formatMin(data.wahrscheinlich_min)} bei dir
          </span>
        </div>
      </div>

      {/* Pünktlichkeits-Badge */}
      <div className="flex items-center gap-2 rounded-xl bg-matcha-50 border border-matcha-200 px-3 py-2">
        <CheckCircle2 className="h-3.5 w-3.5 text-matcha-600 shrink-0" />
        <span className="text-[11px] text-matcha-700">
          <span className="font-black">{data.puenktlichkeit_pct}%</span> pünktliche Lieferungen letzte 7 Tage
        </span>
      </div>
    </div>
  );
}

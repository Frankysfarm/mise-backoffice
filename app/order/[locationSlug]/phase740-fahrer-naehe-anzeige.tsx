'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bike } from 'lucide-react';

interface Props {
  locationId: string | null;
  bestellungId?: string;
  status?: string;
}

const UNTERWEGS_STATUS = ['in_lieferung', 'unterwegs', 'on_the_way', 'delivering'];

interface NaeheDaten {
  entfernung_km: number;
  eta_min: number;
  fahrer_name: string | null;
}

export function Phase740FahrerNaehe({ locationId, bestellungId, status }: Props) {
  const [data, setData] = useState<NaeheDaten | null>(null);
  const [loading, setLoading] = useState(false);

  const istUnterwegs = status ? UNTERWEGS_STATUS.some((s) => status.toLowerCase().includes(s)) : false;

  const laden = useCallback(async () => {
    if (!istUnterwegs || !locationId || !bestellungId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/fahrer-live-status?location_id=${locationId}&order_id=${bestellungId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        if (typeof json.entfernung_km === 'number') {
          setData({
            entfernung_km: json.entfernung_km,
            eta_min: json.eta_min ?? Math.ceil(json.entfernung_km / 0.5),
            fahrer_name: json.fahrer_name ?? null,
          });
        }
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [istUnterwegs, locationId, bestellungId]);

  useEffect(() => {
    if (!istUnterwegs) { setData(null); return; }
    laden();
    const id = setInterval(laden, 30_000);
    return () => clearInterval(id);
  }, [istUnterwegs, laden]);

  if (!istUnterwegs || (!loading && !data)) return null;

  if (loading && !data) {
    return (
      <div className="rounded-xl border bg-muted/30 px-4 py-3 animate-pulse h-14" />
    );
  }

  if (!data) return null;

  const nah = data.entfernung_km < 1;

  return (
    <div className={`rounded-xl border px-4 py-3 ${nah ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800' : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'}`}>
      <div className="flex items-center gap-3">
        <Bike className={`h-5 w-5 shrink-0 ${nah ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold ${nah ? 'text-emerald-800 dark:text-emerald-300' : 'text-blue-800 dark:text-blue-300'}`}>
            {nah ? 'Fahrer gleich da!' : `Fahrer ${data.entfernung_km.toFixed(1)} km entfernt`}
          </p>
          {data.fahrer_name && (
            <p className="text-[10px] text-muted-foreground">{data.fahrer_name}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className={`text-sm font-black tabular-nums ${nah ? 'text-emerald-700 dark:text-emerald-300' : 'text-blue-700 dark:text-blue-300'}`}>
            ~{data.eta_min} Min
          </p>
        </div>
      </div>
    </div>
  );
}

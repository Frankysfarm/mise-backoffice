'use client';

import { useCallback, useEffect, useState } from 'react';
import { Tag, X } from 'lucide-react';

interface Props {
  locationId: string | null;
  isDelivery?: boolean;
}

interface AktionsDaten {
  aktiv: boolean;
  reduzierung_eur: number;
  original_eur: number;
  reduziert_eur: number;
  endet_um: string;
  rest_min: number;
}

const MOCK: AktionsDaten = {
  aktiv: true,
  reduzierung_eur: 1.0,
  original_eur: 2.5,
  reduziert_eur: 1.5,
  endet_um: new Date(Date.now() + 47 * 60_000).toISOString(),
  rest_min: 47,
};

export function Phase755LiefergebuehrCountdown({ locationId, isDelivery = false }: Props) {
  const [data, setData] = useState<AktionsDaten | null>(null);
  const [restMin, setRestMin] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const laden = useCallback(async () => {
    if (!locationId || !isDelivery) return;
    try {
      const res = await fetch(
        `/api/delivery/admin/scheduled?location_id=${locationId}&type=liefergebuehr`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        if (json.aktiv) { setData(json); setRestMin(json.rest_min ?? 0); return; }
      }
    } catch { /* fallback */ }
    if (isDelivery) { setData(MOCK); setRestMin(MOCK.rest_min); }
  }, [locationId, isDelivery]);

  useEffect(() => {
    laden();
    const pollId = setInterval(laden, 5 * 60_000);
    return () => clearInterval(pollId);
  }, [laden]);

  useEffect(() => {
    if (!data) return;
    const id = setInterval(() => {
      setRestMin((m) => {
        if (m <= 0) { setData(null); return 0; }
        return m - 1;
      });
    }, 60_000);
    return () => clearInterval(id);
  }, [data]);

  if (!data || !data.aktiv || dismissed || restMin <= 0) return null;

  const h = Math.floor(restMin / 60);
  const m = restMin % 60;
  const zeitStr = h > 0 ? `${h}h ${m}m` : `${m} Min`;

  return (
    <div className="rounded-xl border bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-emerald-200 dark:border-emerald-800 px-4 py-3">
      <div className="flex items-start gap-2">
        <Tag className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
            -{data.reduzierung_eur.toFixed(2)} € Liefergebühr-Rabatt
          </p>
          <p className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
            Nur noch {zeitStr} · statt {data.original_eur.toFixed(2)} € nur {data.reduziert_eur.toFixed(2)} €
          </p>
        </div>
        <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground shrink-0" aria-label="Schließen">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

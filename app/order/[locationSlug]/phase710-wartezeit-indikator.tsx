'use client';

import { useCallback, useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface Props {
  locationId: string | null;
  basisEtaMinuten?: number;
}

interface KuechenLast {
  auslastung_pct: number;
  verzoegerung_min: number;
  meldung: string;
}

const MOCK: KuechenLast = {
  auslastung_pct: 78,
  verzoegerung_min: 5,
  meldung: 'Küche hat gerade viel zu tun',
};

export function Phase710WartezeitIndikator({ locationId, basisEtaMinuten = 30 }: Props) {
  const [data, setData] = useState<KuechenLast | null>(null);

  const laden = useCallback(async () => {
    if (!locationId) {
      setData(MOCK);
      return;
    }
    try {
      const res = await fetch(
        `/api/delivery/admin/kuechen-kapazitaets-warnsignal?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        if (typeof json.auslastung_pct === 'number') {
          const verzoegerung =
            json.auslastung_pct >= 90 ? 10
            : json.auslastung_pct >= 75 ? 5
            : 0;
          setData({
            auslastung_pct: json.auslastung_pct,
            verzoegerung_min: verzoegerung,
            meldung:
              json.auslastung_pct >= 90
                ? 'Küche voll ausgelastet — Wartezeit verlängert'
                : json.auslastung_pct >= 75
                ? 'Küche hat gerade viel zu tun'
                : '',
          });
          return;
        }
      }
    } catch {
      // fallback
    }
    setData(null);
  }, [locationId]);

  useEffect(() => {
    laden();
    const id = setInterval(laden, 2 * 60_000);
    return () => clearInterval(id);
  }, [laden]);

  if (!data || data.verzoegerung_min === 0) return null;

  const gesamtEta = basisEtaMinuten + data.verzoegerung_min;

  const farbe =
    data.auslastung_pct >= 90
      ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
      : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400';

  return (
    <div className={`rounded-xl border p-3 ${farbe}`}>
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold">{data.meldung} — +{data.verzoegerung_min} Min</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Geschätzte Lieferzeit: ca. {gesamtEta} Minuten
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-base font-bold tabular-nums">~{gesamtEta} Min</p>
          <p className="text-[9px] text-muted-foreground">{data.auslastung_pct}% Last</p>
        </div>
      </div>
    </div>
  );
}

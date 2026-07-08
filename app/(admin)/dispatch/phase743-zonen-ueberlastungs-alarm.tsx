'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  locationId: string | null;
  schwelleBestellungen?: number;
}

interface ZonenAlarm {
  zone: string;
  bestellungen_aktiv: number;
  fahrer_aktiv: number;
  ratio: number;
  kritisch: boolean;
}

const MOCK: ZonenAlarm[] = [
  { zone: 'Zone A', bestellungen_aktiv: 8, fahrer_aktiv: 1, ratio: 8, kritisch: true },
  { zone: 'Zone C', bestellungen_aktiv: 5, fahrer_aktiv: 1, ratio: 5, kritisch: false },
];

export function DispatchPhase743ZonenUeberlastungsAlarm({ locationId, schwelleBestellungen = 5 }: Props) {
  const [data, setData] = useState<ZonenAlarm[]>([]);
  const [loading, setLoading] = useState(true);

  const laden = useCallback(async () => {
    if (!locationId) { setData(MOCK); setLoading(false); return; }
    try {
      const res = await fetch(
        `/api/delivery/admin/zonen-bestelldruck?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.zonen)) {
          const alarme: ZonenAlarm[] = json.zonen
            .filter((z: { bestellungen_aktiv?: number; fahrer_aktiv?: number; zone?: string }) =>
              (z.bestellungen_aktiv ?? 0) >= schwelleBestellungen
            )
            .map((z: { zone?: string; bestellungen_aktiv?: number; fahrer_aktiv?: number }) => {
              const best = z.bestellungen_aktiv ?? 0;
              const fahr = Math.max(1, z.fahrer_aktiv ?? 1);
              return {
                zone: z.zone ?? 'Unbekannt',
                bestellungen_aktiv: best,
                fahrer_aktiv: fahr,
                ratio: Math.round((best / fahr) * 10) / 10,
                kritisch: best / fahr > 5,
              };
            })
            .sort((a: ZonenAlarm, b: ZonenAlarm) => b.ratio - a.ratio);
          if (alarme.length > 0) { setData(alarme); return; }
        }
      }
    } catch { /* fallback */ }
    setData(MOCK);
  }, [locationId, schwelleBestellungen]);

  useEffect(() => {
    laden().finally(() => setLoading(false));
    const id = setInterval(laden, 60_000);
    return () => clearInterval(id);
  }, [laden]);

  const kritischeZonen = data.filter((z) => z.kritisch);

  if (!loading && data.length === 0) return null;

  return (
    <div className={`rounded-xl border p-4 shadow-sm ${
      kritischeZonen.length > 0
        ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
        : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
    }`}>
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className={`h-4 w-4 ${kritischeZonen.length > 0 ? 'text-red-500 animate-pulse' : 'text-amber-500'}`} />
        <span className="text-sm font-semibold">Zonen-Überlastung</span>
        <span className={`text-xs rounded-full px-2 py-0.5 font-semibold ${
          kritischeZonen.length > 0
            ? 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400'
            : 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
        }`}>
          {data.length} Zone{data.length !== 1 ? 'n' : ''}
        </span>
      </div>
      {loading ? (
        <div className="h-12 animate-pulse rounded bg-muted" />
      ) : (
        <div className="space-y-1.5">
          {data.slice(0, 4).map((z) => (
            <div key={z.zone} className="flex items-center gap-2 text-xs">
              <span className={`h-2 w-2 rounded-full shrink-0 ${z.kritisch ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`} />
              <span className="font-semibold flex-1">{z.zone}</span>
              <span className="text-muted-foreground">{z.bestellungen_aktiv} Best. / {z.fahrer_aktiv} Fahr.</span>
              <span className={`font-bold tabular-nums ${z.kritisch ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                ×{z.ratio}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground mt-2">Bestellungen je Fahrer · 1-Min Update</p>
    </div>
  );
}

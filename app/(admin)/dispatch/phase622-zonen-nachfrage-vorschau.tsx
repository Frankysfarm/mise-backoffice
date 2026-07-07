'use client';

import { useEffect, useState, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus, MapPin } from 'lucide-react';

interface ZonePrognose {
  zone: string;
  aktuelleRate: number;
  prognose2h: number;
  trend: 'steigend' | 'fallend' | 'stabil';
}

interface Props {
  locationId: string | null;
}

const MOCK: ZonePrognose[] = [
  { zone: 'A', aktuelleRate: 8, prognose2h: 14, trend: 'steigend' },
  { zone: 'B', aktuelleRate: 12, prognose2h: 10, trend: 'fallend' },
  { zone: 'C', aktuelleRate: 5, prognose2h: 5, trend: 'stabil' },
  { zone: 'D', aktuelleRate: 3, prognose2h: 7, trend: 'steigend' },
  { zone: 'E', aktuelleRate: 9, prognose2h: 8, trend: 'stabil' },
];

const MAX_BALKEN = 20;

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp className="h-3.5 w-3.5 text-green-500" />;
  if (trend === 'fallend') return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-gray-400" />;
}

export function DispatchPhase622ZonenNachfrageVorschau({ locationId }: Props) {
  const [zonen, setZonen] = useState<ZonePrognose[]>([]);
  const [useMock, setUseMock] = useState(false);

  const laden = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(
        `/api/delivery/admin/zonen-nachfrage-prognose?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error('API error');
      const json = await res.json();
      if (json.ok && Array.isArray(json.zonen)) {
        setZonen(json.zonen);
        setUseMock(false);
      } else {
        setZonen(MOCK);
        setUseMock(true);
      }
    } catch {
      setZonen(MOCK);
      setUseMock(true);
    }
  }, [locationId]);

  useEffect(() => {
    laden();
    const id = setInterval(laden, 60_000);
    return () => clearInterval(id);
  }, [laden]);

  if (zonen.length === 0 || !locationId) return null;

  return (
    <div className="mb-4 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <MapPin className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        <span className="text-sm font-bold text-purple-800 dark:text-purple-200 uppercase tracking-wide">
          Zonen-Nachfrage-Vorschau
        </span>
        <span className="ml-1 text-xs text-purple-500 dark:text-purple-400">+2h</span>
        {useMock && (
          <span className="ml-auto text-[10px] text-gray-400 dark:text-gray-500">Demo</span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {zonen.map((z) => {
          const maxVal = Math.max(z.aktuelleRate, z.prognose2h, 1);
          const istBreite = Math.round((z.aktuelleRate / (MAX_BALKEN > maxVal ? MAX_BALKEN : maxVal)) * 100);
          const progBreite = Math.round((z.prognose2h / (MAX_BALKEN > maxVal ? MAX_BALKEN : maxVal)) * 100);

          return (
            <div key={z.zone} className="flex items-center gap-3">
              <div className="w-6 shrink-0 text-center">
                <span className="text-xs font-bold text-purple-700 dark:text-purple-300">{z.zone}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1 mb-0.5">
                  <div
                    className="h-2 rounded-full bg-purple-400 dark:bg-purple-500 transition-all"
                    style={{ width: `${istBreite}%`, minWidth: z.aktuelleRate > 0 ? '4px' : '0' }}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <div
                    className="h-2 rounded-full bg-purple-200 dark:bg-purple-700 transition-all"
                    style={{ width: `${progBreite}%`, minWidth: z.prognose2h > 0 ? '4px' : '0' }}
                  />
                </div>
              </div>
              <div className="w-20 shrink-0 flex items-center justify-end gap-1">
                <TrendIcon trend={z.trend} />
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 tabular-nums">
                  {z.aktuelleRate}→{z.prognose2h}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-4 text-[10px] text-gray-400 dark:text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-3 rounded-full bg-purple-400" /> Aktuell
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-3 rounded-full bg-purple-200" /> Prognose 2h
        </span>
      </div>
    </div>
  );
}

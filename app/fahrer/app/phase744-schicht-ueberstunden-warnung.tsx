'use client';

import { useCallback, useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface Props {
  driverId: string;
  isOnline: boolean;
}

interface SchichtDaten {
  schicht_min: number;
  ueberstunden_min: number;
  hat_ueberstunden: boolean;
}

export function FahrerPhase744SchichtUeberstundenWarnung({ driverId, isOnline }: Props) {
  const [data, setData] = useState<SchichtDaten | null>(null);

  const laden = useCallback(async () => {
    if (!driverId || !isOnline) { setData(null); return; }
    try {
      const res = await fetch(
        `/api/delivery/driver/shift-status?driver_id=${driverId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        if (json.started_at) {
          const startMs = new Date(json.started_at).getTime();
          const schichtMin = Math.floor((Date.now() - startMs) / 60_000);
          const STANDARD_H = 8;
          const ueberstundenMin = Math.max(0, schichtMin - STANDARD_H * 60);
          setData({ schicht_min: schichtMin, ueberstunden_min: ueberstundenMin, hat_ueberstunden: ueberstundenMin > 0 });
          return;
        }
      }
    } catch { /* silent */ }
    setData(null);
  }, [driverId, isOnline]);

  useEffect(() => {
    laden();
    const id = setInterval(laden, 5 * 60_000);
    return () => clearInterval(id);
  }, [laden]);

  if (!isOnline || !data || !data.hat_ueberstunden) return null;

  const h = Math.floor(data.schicht_min / 60);
  const min = data.schicht_min % 60;
  const uebH = Math.floor(data.ueberstunden_min / 60);
  const uebMin = data.ueberstunden_min % 60;

  return (
    <div className="rounded-xl border bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700 px-4 py-3">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
            Überstunden: {uebH > 0 ? `${uebH}h ` : ''}{uebMin} Min
          </p>
          <p className="text-[10px] text-amber-700/70 dark:text-amber-400/70 mt-0.5">
            Schicht läuft seit {h}h {min}m · Standard 8h
          </p>
        </div>
      </div>
    </div>
  );
}

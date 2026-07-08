'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertOctagon } from 'lucide-react';

interface Props {
  driverId: string;
  isOnline: boolean;
}

interface SlaDaten {
  batch_id: string;
  dauer_min: number;
  ueberzogen_min: number;
  stops: number;
}

export function FahrerPhase754SlaAlarmWidget({ driverId, isOnline }: Props) {
  const [alarm, setAlarm] = useState<SlaDaten | null>(null);

  const pruefen = useCallback(async () => {
    if (!driverId || !isOnline) { setAlarm(null); return; }
    try {
      const res = await fetch(
        `/api/delivery/driver/naechste-tour?driver_id=${driverId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        if (json.batch?.created_at) {
          const dauerMin = Math.floor((Date.now() - new Date(json.batch.created_at).getTime()) / 60_000);
          const SLA = 45;
          if (dauerMin > SLA) {
            setAlarm({
              batch_id: json.batch.id,
              dauer_min: dauerMin,
              ueberzogen_min: dauerMin - SLA,
              stops: json.batch.stops_count ?? 1,
            });
            return;
          }
        }
      }
    } catch { /* silent */ }
    setAlarm(null);
  }, [driverId, isOnline]);

  useEffect(() => {
    pruefen();
    const id = setInterval(pruefen, 60_000);
    return () => clearInterval(id);
  }, [pruefen]);

  if (!isOnline || !alarm) return null;

  return (
    <div className="rounded-xl border bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-700 px-4 py-3">
      <div className="flex items-center gap-2">
        <AlertOctagon className="h-5 w-5 text-red-500 animate-pulse shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-red-800 dark:text-red-300">
            SLA überschritten — {alarm.dauer_min} Min seit Bestellung
          </p>
          <p className="text-[10px] text-red-700/70 dark:text-red-400/70 mt-0.5">
            {alarm.ueberzogen_min} Min über Ziel (45 Min) · {alarm.stops} Stop{alarm.stops !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </div>
  );
}

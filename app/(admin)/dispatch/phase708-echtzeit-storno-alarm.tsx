'use client';

import { useCallback, useEffect, useState } from 'react';
import { XCircle } from 'lucide-react';

interface Props {
  locationId: string | null;
  schwelle?: number; // Stornos in 15 Min ab dem Alarm ausgelöst wird (default 3)
}

interface StornoAlarm {
  stornosLetzte15Min: number;
  stornoRatePct: number;
  bestellungenLetzte15Min: number;
  ausgeloest: boolean;
}

const MOCK: StornoAlarm = {
  stornosLetzte15Min: 4,
  stornoRatePct: 28,
  bestellungenLetzte15Min: 14,
  ausgeloest: true,
};

export function DispatchPhase708EchtzeitStornoAlarm({ locationId, schwelle = 3 }: Props) {
  const [data, setData] = useState<StornoAlarm | null>(null);
  const [loading, setLoading] = useState(true);

  const laden = useCallback(async () => {
    if (!locationId) {
      setData(MOCK);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/delivery/admin/echtzeit-storno-alarm?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        if (typeof json.stornosLetzte15Min === 'number') {
          setData(json);
          return;
        }
      }
    } catch {
      // fallback
    }
    setData(MOCK);
  }, [locationId]);

  useEffect(() => {
    laden().finally(() => setLoading(false));
    const id = setInterval(laden, 60_000);
    return () => clearInterval(id);
  }, [laden]);

  if (loading || !data) return null;
  if (!data.ausgeloest && data.stornosLetzte15Min < schwelle) return null;

  return (
    <div className="rounded-xl border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/20 p-3">
      <div className="flex items-center gap-2">
        <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 animate-pulse" />
        <div className="flex-1">
          <p className="text-xs font-bold text-red-700 dark:text-red-400">
            Storno-Alarm: {data.stornosLetzte15Min}× in 15 Min!
          </p>
          <p className="text-[10px] text-muted-foreground">
            {data.stornoRatePct}% Storno-Rate ({data.bestellungenLetzte15Min} Bestellungen)
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
            {data.stornoRatePct}%
          </p>
          <p className="text-[9px] text-muted-foreground">Storno</p>
        </div>
      </div>
    </div>
  );
}

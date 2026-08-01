'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

// Phase 5465 — Schichtstunden-Ticker (Kitchen)
// Clock teal-400; Fleißigste/r #1 Name+h; Team-Ø; Wenig-Alert; 30-Min-Polling; Mock-Fallback

interface ApiResponse {
  fleissigster_name: string;
  fahrer: Array<{ rang: number; avg_stunden: number; alert_wenig: boolean }>;
  team_avg_stunden: number;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fleissigster_name: 'Julia F.',
  fahrer: [
    { rang: 1, avg_stunden: 7.5, alert_wenig: false },
    { rang: 2, avg_stunden: 6.8, alert_wenig: false },
    { rang: 3, avg_stunden: 5.5, alert_wenig: false },
    { rang: 4, avg_stunden: 3.9, alert_wenig: true  },
  ],
  team_avg_stunden: 5.93,
  alert_count: 1,
  gesamt: 4,
};

export function KitchenPhase5465SchichtstundenTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-schichtstunden-ranking?location_id=${locationId}`);
      if (r.ok) setData(await r.json());
    } catch { /* use mock */ }
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 30 * 60_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const best = data.fahrer.find(f => f.rang === 1);

  return (
    <div className="flex items-center gap-3 rounded-lg bg-gray-900 border border-gray-700/50 px-3 py-2">
      <Clock className="h-3.5 w-3.5 text-teal-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-white truncate">
            #1 {data.fleissigster_name}
          </span>
          {best && (
            <span className="text-xs font-mono text-teal-400">{best.avg_stunden.toFixed(1)}h</span>
          )}
        </div>
        <div className="text-[10px] text-gray-500">
          Team-Ø {data.team_avg_stunden.toFixed(1)}h · Schichtstunden
        </div>
      </div>
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-red-400 shrink-0">
          <AlertTriangle className="h-3 w-3" />
          Wenig
        </div>
      )}
    </div>
  );
}

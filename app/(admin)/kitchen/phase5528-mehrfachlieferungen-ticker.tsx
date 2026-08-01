'use client';

import { useEffect, useRef, useState } from 'react';
import { Layers, AlertTriangle } from 'lucide-react';

// Phase 5528 — Mehrfachlieferungen-Ticker (Kitchen)
// Layers sky-400; Höchste/r #1 Name+Wert; Team-Ø; Niedrig-Alert; 30-Min-Polling; Mock-Fallback

interface ApiResponse {
  hoechste_name: string;
  fahrer: Array<{ rang: number; avg_lieferungen: number; alert_niedrig: boolean }>;
  team_avg: number;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  hoechste_name: 'Julia F.',
  fahrer: [
    { rang: 1, avg_lieferungen: 3.8, alert_niedrig: false },
    { rang: 2, avg_lieferungen: 3.2, alert_niedrig: false },
    { rang: 3, avg_lieferungen: 2.5, alert_niedrig: false },
    { rang: 4, avg_lieferungen: 1.6, alert_niedrig: true  },
  ],
  team_avg: 2.8,
  alert_count: 1,
  gesamt: 4,
};

export function KitchenPhase5528MehrfachlieferungenTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-mehrfach-ranking?location_id=${locationId}`);
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
      <Layers className="h-3.5 w-3.5 text-sky-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-white truncate">
            #1 {data.hoechste_name}
          </span>
          {best && (
            <span className="text-xs font-mono text-sky-400">{best.avg_lieferungen}× /Tour</span>
          )}
        </div>
        <div className="text-[10px] text-gray-500">
          Team-Ø {data.team_avg}× · Mehrfachlieferungen (30 Tage)
        </div>
      </div>
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-red-400 shrink-0">
          <AlertTriangle className="h-3 w-3" />
          Niedrig
        </div>
      )}
    </div>
  );
}

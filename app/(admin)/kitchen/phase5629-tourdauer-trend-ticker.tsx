'use client';

import { useEffect, useRef, useState } from 'react';
import { Hourglass, AlertTriangle } from 'lucide-react';

// Phase 5629 — Tourdauer-Trend-Ticker (Kitchen) — Batch 101
// Hourglass purple; Schnellste/r #1 Name+Delta; Team-Trend; Rückfall-Alert; 30-Min-Polling; Mock-Fallback

interface ApiResponse {
  schnellste_name: string;
  fahrer: Array<{ rang: number; tourdauer_delta_min: number; alert_rueckfall: boolean }>;
  team_avg_delta_min: number;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  schnellste_name: 'Julia F.',
  fahrer: [
    { rang: 1, tourdauer_delta_min: -4.2, alert_rueckfall: false },
    { rang: 2, tourdauer_delta_min: -1.8, alert_rueckfall: false },
    { rang: 3, tourdauer_delta_min:  0.5, alert_rueckfall: false },
    { rang: 4, tourdauer_delta_min:  6.3, alert_rueckfall: true  },
  ],
  team_avg_delta_min: 0.2,
  alert_count: 1,
  gesamt: 4,
};

export function KitchenPhase5629TourdauerTrendTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-tourdauer-trend-ranking?location_id=${locationId}`);
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
    <div className="flex items-center gap-3 rounded-lg bg-gray-900 border border-purple-700/40 px-3 py-2">
      <Hourglass className="h-3.5 w-3.5 text-purple-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-white truncate">
            #1 {data.schnellste_name}
          </span>
          {best && (
            <span className="text-xs font-mono text-purple-400">
              {best.tourdauer_delta_min > 0 ? '+' : ''}{best.tourdauer_delta_min.toFixed(1)} min
            </span>
          )}
        </div>
        <div className="text-[10px] text-gray-500">
          Team-Trend {data.team_avg_delta_min > 0 ? '+' : ''}{data.team_avg_delta_min.toFixed(1)} min · Tourdauer-Verbesserung
        </div>
      </div>
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-red-400 shrink-0">
          <AlertTriangle className="h-3 w-3" />
          Rückfall
        </div>
      )}
    </div>
  );
}

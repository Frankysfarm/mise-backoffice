'use client';

import { useEffect, useRef, useState } from 'react';
import { Route, AlertTriangle } from 'lucide-react';

// Phase 5429 — km/Tour-Ticker (Kitchen)
// Route green-400; Kürzeste/r #1 Name+km; Team-Ø; Lange-Route-Alert; 30-Min-Polling; Mock-Fallback

interface ApiResponse {
  bester_name: string;
  fahrer: Array<{ rang: number; km_avg: number; alert_top: boolean }>;
  team_avg: number;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  bester_name: 'Julia F.',
  fahrer: [
    { rang: 1, km_avg: 4.2, alert_top: false },
    { rang: 2, km_avg: 5.1, alert_top: false },
    { rang: 3, km_avg: 6.8, alert_top: false },
    { rang: 4, km_avg: 9.3, alert_top: true  },
  ],
  team_avg: 6.35,
  alert_count: 1,
  gesamt: 4,
};

export function KitchenPhase5429KmProTourTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-km-pro-tour-ranking?location_id=${locationId}`);
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
      <Route className="h-3.5 w-3.5 text-green-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-white truncate">
            #1 {data.bester_name}
          </span>
          {best && (
            <span className="text-xs font-mono text-green-400">{best.km_avg.toFixed(1)} km</span>
          )}
        </div>
        <div className="text-[10px] text-gray-500">
          Team-Ø {data.team_avg.toFixed(1)} km/Tour
        </div>
      </div>
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-red-400 shrink-0">
          <AlertTriangle className="h-3 w-3" />
          Lange Route
        </div>
      )}
    </div>
  );
}

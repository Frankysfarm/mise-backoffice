'use client';

import { useEffect, useRef, useState } from 'react';
import { Zap, AlertTriangle } from 'lucide-react';

// Phase 5445 — Stopp-Effizienz-Ticker (Kitchen)
// Zap amber-400; Schnellste/r #1 Name+/h; Team-Ø; Niedrig-Alert; 30-Min-Polling; Mock-Fallback

interface ApiResponse {
  bester_name: string;
  fahrer: Array<{ rang: number; stopps_pro_stunde: number; alert_bottom: boolean }>;
  team_avg: number;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  bester_name: 'Julia F.',
  fahrer: [
    { rang: 1, stopps_pro_stunde: 3.2, alert_bottom: false },
    { rang: 2, stopps_pro_stunde: 2.8, alert_bottom: false },
    { rang: 3, stopps_pro_stunde: 2.1, alert_bottom: false },
    { rang: 4, stopps_pro_stunde: 1.4, alert_bottom: true  },
  ],
  team_avg: 2.4,
  alert_count: 1,
  gesamt: 4,
};

export function KitchenPhase5445StoppEffizienzTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-stopps-pro-stunde-ranking?location_id=${locationId}`);
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
      <Zap className="h-3.5 w-3.5 text-amber-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-white truncate">
            #1 {data.bester_name}
          </span>
          {best && (
            <span className="text-xs font-mono text-amber-400">{best.stopps_pro_stunde.toFixed(1)}/h</span>
          )}
        </div>
        <div className="text-[10px] text-gray-500">
          Team-Ø {data.team_avg.toFixed(1)}/h · Stopp-Effizienz
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

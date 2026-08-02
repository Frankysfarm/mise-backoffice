'use client';

import { useEffect, useRef, useState } from 'react';
import { Zap, AlertTriangle } from 'lucide-react';

// Phase 5580 — Dispatch-Reaktionszeit-Ticker (Kitchen)
// Zap yellow-400; Schnellste/r #1 Name+min; Team-Ø; Hoch-Alert; 30-Min-Polling; Mock-Fallback

interface ApiResponse {
  schnellster_name: string;
  fahrer: Array<{ rang: number; avg_reaktionszeit_min: number; alert_hoch: boolean }>;
  team_avg_min: number;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  schnellster_name: 'Julia F.',
  fahrer: [
    { rang: 1, avg_reaktionszeit_min:  2.1, alert_hoch: false },
    { rang: 2, avg_reaktionszeit_min:  4.3, alert_hoch: false },
    { rang: 3, avg_reaktionszeit_min:  6.8, alert_hoch: false },
    { rang: 4, avg_reaktionszeit_min: 11.2, alert_hoch: true  },
  ],
  team_avg_min: 6.1,
  alert_count: 1,
  gesamt: 4,
};

export function KitchenPhase5580ReaktionszeitTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-reaktionszeit-ranking?location_id=${locationId}`);
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
      <Zap className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-white truncate">
            #1 {data.schnellster_name}
          </span>
          {best && (
            <span className="text-xs font-mono text-yellow-400">{best.avg_reaktionszeit_min.toFixed(1)} Min</span>
          )}
        </div>
        <div className="text-[10px] text-gray-500">
          Team-Ø {data.team_avg_min.toFixed(1)} Min · Dispatch-Reaktionszeit (30 Tage)
        </div>
      </div>
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-red-400 shrink-0">
          <AlertTriangle className="h-3 w-3" />
          Langsam
        </div>
      )}
    </div>
  );
}

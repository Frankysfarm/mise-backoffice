'use client';

import { useEffect, useRef, useState } from 'react';
import { Gauge, AlertTriangle } from 'lucide-react';

// Phase 5559 — km-pro-Tag-Ticker (Kitchen)
// Gauge blue-400; Aktivste/r #1 Name+km/Tag; Team-Ø; Niedrig-Alert; 30-Min-Polling; Mock-Fallback

interface ApiResponse {
  aktivster_name: string;
  fahrer: Array<{ rang: number; avg_km_pro_tag: number; alert_niedrig: boolean }>;
  team_avg_km_pro_tag: number;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  aktivster_name: 'Sara K.',
  fahrer: [
    { rang: 1, avg_km_pro_tag: 87.4, alert_niedrig: false },
    { rang: 2, avg_km_pro_tag: 74.2, alert_niedrig: false },
    { rang: 3, avg_km_pro_tag: 58.1, alert_niedrig: false },
    { rang: 4, avg_km_pro_tag: 31.5, alert_niedrig: true  },
  ],
  team_avg_km_pro_tag: 62.8,
  alert_count: 1,
  gesamt: 4,
};

export function KitchenPhase5559KmProTagTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-km-pro-tag?location_id=${locationId}`);
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
      <Gauge className="h-3.5 w-3.5 text-blue-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-white truncate">
            #1 {data.aktivster_name}
          </span>
          {best && (
            <span className="text-xs font-mono text-blue-400">{best.avg_km_pro_tag.toFixed(1)} km/Tag</span>
          )}
        </div>
        <div className="text-[10px] text-gray-500">
          Team-Ø {data.team_avg_km_pro_tag.toFixed(1)} km/Tag · Kilometer pro aktivem Tag (30 Tage)
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

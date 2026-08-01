'use client';

import { useEffect, useRef, useState } from 'react';
import { Calendar, AlertTriangle } from 'lucide-react';

// Phase 5461 — Wochenend-Anteil-Ticker (Kitchen)
// Calendar violet-400; Meister #1 Name+%; Team-Ø; Hoch-Alert; 30-Min-Polling; Mock-Fallback

interface ApiResponse {
  meister_name: string;
  fahrer: Array<{ rang: number; wochenend_anteil_pct: number; alert_hoch: boolean }>;
  team_avg_pct: number;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  meister_name: 'Julia F.',
  fahrer: [
    { rang: 1, wochenend_anteil_pct: 62, alert_hoch: true  },
    { rang: 2, wochenend_anteil_pct: 48, alert_hoch: false },
    { rang: 3, wochenend_anteil_pct: 31, alert_hoch: false },
    { rang: 4, wochenend_anteil_pct: 15, alert_hoch: false },
  ],
  team_avg_pct: 39,
  alert_count: 1,
  gesamt: 4,
};

export function KitchenPhase5461WochenendAnteilTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-wochenend-anteil-ranking?location_id=${locationId}`);
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
      <Calendar className="h-3.5 w-3.5 text-violet-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-white truncate">
            #1 {data.meister_name}
          </span>
          {best && (
            <span className="text-xs font-mono text-violet-400">{best.wochenend_anteil_pct.toFixed(0)}%</span>
          )}
        </div>
        <div className="text-[10px] text-gray-500">
          Team-Ø {data.team_avg_pct.toFixed(0)}% · Wochenend-Anteil
        </div>
      </div>
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-red-400 shrink-0">
          <AlertTriangle className="h-3 w-3" />
          Hoch
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { XCircle, AlertTriangle } from 'lucide-react';

// Phase 5564 — Storno-Quote-Ticker (Kitchen)
// XCircle red-400; Beste/r #1 Name+%; Team-Ø; Hoch-Alert; 30-Min-Polling; Mock-Fallback

interface ApiResponse {
  beste_name: string;
  fahrer: Array<{ rang: number; rate_pct: number; alert_hoch: boolean }>;
  team_avg_rate: number;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  beste_name: 'Julia F.',
  fahrer: [
    { rang: 1, rate_pct:  1, alert_hoch: false },
    { rang: 2, rate_pct:  4, alert_hoch: false },
    { rang: 3, rate_pct:  8, alert_hoch: false },
    { rang: 4, rate_pct: 17, alert_hoch: true  },
  ],
  team_avg_rate: 8,
  alert_count: 1,
  gesamt: 4,
};

export function KitchenPhase5564StornoQuoteTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-storno-rate-ranking?location_id=${locationId}`);
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
      <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-white truncate">
            #1 {data.beste_name}
          </span>
          {best && (
            <span className="text-xs font-mono text-green-400">{best.rate_pct.toFixed(1)} %</span>
          )}
        </div>
        <div className="text-[10px] text-gray-500">
          Team-Ø {data.team_avg_rate.toFixed(1)} % · Storno-Quote (30 Tage)
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

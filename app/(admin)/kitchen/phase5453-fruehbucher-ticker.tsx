'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarCheck, AlertTriangle } from 'lucide-react';

// Phase 5453 — Frühbucher-Ticker (Kitchen)
// CalendarCheck green-400; Bester/r #1 Name+%; Team-Ø; Niedrig-Alert; 30-Min-Polling; Mock-Fallback

interface ApiResponse {
  bester_name: string;
  fahrer: Array<{ rang: number; fruehbucher_quote_pct: number; alert_niedrig: boolean }>;
  team_avg_pct: number;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  bester_name: 'Julia F.',
  fahrer: [
    { rang: 1, fruehbucher_quote_pct: 87, alert_niedrig: false },
    { rang: 2, fruehbucher_quote_pct: 74, alert_niedrig: false },
    { rang: 3, fruehbucher_quote_pct: 55, alert_niedrig: false },
    { rang: 4, fruehbucher_quote_pct: 31, alert_niedrig: true  },
  ],
  team_avg_pct: 62,
  alert_count: 1,
  gesamt: 4,
};

export function KitchenPhase5453FruehbucherTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-fruehbucher-score?location_id=${locationId}`);
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
      <CalendarCheck className="h-3.5 w-3.5 text-green-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-white truncate">
            #1 {data.bester_name}
          </span>
          {best && (
            <span className="text-xs font-mono text-green-400">{best.fruehbucher_quote_pct}%</span>
          )}
        </div>
        <div className="text-[10px] text-gray-500">
          Team-Ø {data.team_avg_pct}% · Frühbucher-Score
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

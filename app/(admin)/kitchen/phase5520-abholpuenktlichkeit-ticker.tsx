'use client';

import { useEffect, useRef, useState } from 'react';
import { Timer, AlertTriangle } from 'lucide-react';

// Phase 5520 — Abholpünktlichkeit-Ticker (Kitchen)
// Timer violet-400; Schnellste/r #1 Name+min; Team-Ø; Langsam-Alert; 30-Min-Polling; Mock-Fallback

interface ApiResponse {
  schnellste_name: string;
  fahrer: Array<{ rang: number; avg_minuten: number; alert_langsam: boolean }>;
  team_avg_minuten: number;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  schnellste_name: 'Julia F.',
  fahrer: [
    { rang: 1, avg_minuten: 2.1, alert_langsam: false },
    { rang: 2, avg_minuten: 3.8, alert_langsam: false },
    { rang: 3, avg_minuten: 5.2, alert_langsam: true  },
    { rang: 4, avg_minuten: 7.6, alert_langsam: true  },
  ],
  team_avg_minuten: 4.7,
  alert_count: 2,
  gesamt: 4,
};

export function KitchenPhase5520AbholpuenktlichkeitTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-abholpuenktlichkeit-ranking?location_id=${locationId}`);
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
      <Timer className="h-3.5 w-3.5 text-violet-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-white truncate">
            #1 {data.schnellste_name}
          </span>
          {best && (
            <span className="text-xs font-mono text-violet-400">{best.avg_minuten} min</span>
          )}
        </div>
        <div className="text-[10px] text-gray-500">
          Team-Ø {data.team_avg_minuten} min · Abholpünktlichkeit (30 Tage)
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

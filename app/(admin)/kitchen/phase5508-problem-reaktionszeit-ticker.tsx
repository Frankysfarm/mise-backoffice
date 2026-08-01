'use client';

import { useEffect, useRef, useState } from 'react';
import { Zap, AlertTriangle } from 'lucide-react';

// Phase 5508 — Problem-Reaktionszeit-Ticker (Kitchen)
// Zap yellow-400; Schnellste/r #1 Name+Reaktionszeit; Team-Ø; Langsam-Alert; 30-Min-Polling; Mock-Fallback

interface ApiResponse {
  schnellste_name: string;
  fahrer: Array<{ rang: number; reaktionszeit_min: number; alert_langsam: boolean }>;
  team_avg_min: number;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  schnellste_name: 'Julia F.',
  fahrer: [
    { rang: 1, reaktionszeit_min:  8.0, alert_langsam: false },
    { rang: 2, reaktionszeit_min: 14.0, alert_langsam: false },
    { rang: 3, reaktionszeit_min: 22.0, alert_langsam: false },
    { rang: 4, reaktionszeit_min: 38.0, alert_langsam: true  },
  ],
  team_avg_min: 20.5,
  alert_count: 1,
  gesamt: 4,
};

export function KitchenPhase5508ProblemReaktionszeitTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-problem-reaktionszeit-ranking?location_id=${locationId}`);
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
            #1 {data.schnellste_name}
          </span>
          {best && (
            <span className="text-xs font-mono text-yellow-400">{best.reaktionszeit_min.toFixed(1)} min</span>
          )}
        </div>
        <div className="text-[10px] text-gray-500">
          Team-Ø {data.team_avg_min.toFixed(1)} min · Problem-Reaktionszeit (30 Tage)
        </div>
      </div>
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-yellow-400 shrink-0">
          <AlertTriangle className="h-3 w-3" />
          Langsam
        </div>
      )}
    </div>
  );
}

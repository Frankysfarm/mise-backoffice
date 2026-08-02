'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

// Phase 5593 — Wartezeit-Restaurant-Ticker (Kitchen)
// Clock cyan-400; Beste/r #1 Name+min; Team-Ø; Lang-Alert; 30-Min-Polling; Mock-Fallback

interface ApiResponse {
  beste_name: string;
  fahrer: Array<{ rang: number; avg_wartezeit_min: number; alert_lang: boolean }>;
  team_avg_wartezeit: number;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  beste_name: 'Tim B.',
  fahrer: [
    { rang: 1, avg_wartezeit_min: 3,  alert_lang: false },
    { rang: 2, avg_wartezeit_min: 5,  alert_lang: false },
    { rang: 3, avg_wartezeit_min: 8,  alert_lang: false },
    { rang: 4, avg_wartezeit_min: 13, alert_lang: true  },
  ],
  team_avg_wartezeit: 7,
  alert_count: 1,
  gesamt: 4,
};

export function KitchenPhase5593WartezeitRestaurantTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-wartezeit-restaurant-ranking?location_id=${locationId}`);
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
      <Clock className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-white truncate">
            #1 {data.beste_name}
          </span>
          {best && (
            <span className="text-xs font-mono text-green-400">{best.avg_wartezeit_min} min</span>
          )}
        </div>
        <div className="text-[10px] text-gray-500">
          Team-Ø {data.team_avg_wartezeit} min · Wartezeit Restaurant (30 Tage)
        </div>
      </div>
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-red-400 shrink-0">
          <AlertTriangle className="h-3 w-3" />
          Lang
        </div>
      )}
    </div>
  );
}

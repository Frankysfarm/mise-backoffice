'use client';

import { useEffect, useRef, useState } from 'react';
import { Star, AlertTriangle } from 'lucide-react';

// Phase 5609 — Bewertungs-Trend-Ticker (Kitchen)
// Star yellow-400; Beste/r #1 Name+Delta; Team-Trend; Rückfall-Alert; 30-Min-Polling; Mock-Fallback

interface ApiResponse {
  bester_name: string;
  fahrer: Array<{ rang: number; bewertung_delta: number; alert_rueckfall: boolean }>;
  team_avg_delta: number;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  bester_name: 'Max M.',
  fahrer: [
    { rang: 1, bewertung_delta:  0.4, alert_rueckfall: false },
    { rang: 2, bewertung_delta:  0.2, alert_rueckfall: false },
    { rang: 3, bewertung_delta: -0.1, alert_rueckfall: false },
    { rang: 4, bewertung_delta: -0.5, alert_rueckfall: true  },
  ],
  team_avg_delta: 0.0,
  alert_count: 1,
  gesamt: 4,
};

export function KitchenPhase5609BewertungsTrendTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-bewertungs-trend-ranking?location_id=${locationId}`);
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
      <Star className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-white truncate">
            #1 {data.bester_name}
          </span>
          {best && (
            <span className="text-xs font-mono text-yellow-400">
              {best.bewertung_delta > 0 ? '+' : ''}{best.bewertung_delta.toFixed(1)}★
            </span>
          )}
        </div>
        <div className="text-[10px] text-gray-500">
          Team-Trend {data.team_avg_delta > 0 ? '+' : ''}{data.team_avg_delta.toFixed(1)}★ · Bewertungs-Verbesserung
        </div>
      </div>
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-red-400 shrink-0">
          <AlertTriangle className="h-3 w-3" />
          Rückfall
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { Heart, AlertTriangle } from 'lucide-react';

// Phase 5540 — Kundenbindungs-Rate-Ticker (Kitchen)
// Heart rose-400; Beste/r #1 Name+Wiederkehrer-%; Team-Ø; Niedrig-Alert <60%; 30-Min-Polling; Mock-Fallback

interface ApiResponse {
  bester_name: string;
  fahrer: Array<{ rang: number; kundenbindungs_pct: number; alert_niedrig: boolean }>;
  team_avg: number;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  bester_name: 'Sara K.',
  fahrer: [
    { rang: 1, kundenbindungs_pct: 84, alert_niedrig: false },
    { rang: 2, kundenbindungs_pct: 76, alert_niedrig: false },
    { rang: 3, kundenbindungs_pct: 63, alert_niedrig: false },
    { rang: 4, kundenbindungs_pct: 52, alert_niedrig: true  },
  ],
  team_avg: 68.75,
  alert_count: 1,
  gesamt: 4,
};

export function KitchenPhase5540KundenbindungsRateTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-kundenbindungs-rate-ranking?location_id=${locationId}`);
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
      <Heart className="h-3.5 w-3.5 text-rose-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-white truncate">
            #1 {data.bester_name}
          </span>
          {best && (
            <span className="text-xs font-mono text-rose-400">{best.kundenbindungs_pct}%</span>
          )}
        </div>
        <div className="text-[10px] text-gray-500">
          Team-Ø {data.team_avg}% · Kundenbindungs-Rate (30 Tage)
        </div>
      </div>
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-yellow-400 shrink-0">
          <AlertTriangle className="h-3 w-3" />
          Niedrig
        </div>
      )}
    </div>
  );
}

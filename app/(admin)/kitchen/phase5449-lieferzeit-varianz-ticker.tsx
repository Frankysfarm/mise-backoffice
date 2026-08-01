'use client';

import { useEffect, useRef, useState } from 'react';
import { Sigma, AlertTriangle } from 'lucide-react';

// Phase 5449 — Lieferzeit-Varianz-Ticker (Kitchen)
// Sigma purple-400; Konstanteste/r #1 Name+±min; Team-Ø; Hoch-Alert; 30-Min-Polling; Mock-Fallback

interface ApiResponse {
  bester_name: string;
  fahrer: Array<{ rang: number; lieferzeit_varianz_min: number; alert_hoch: boolean }>;
  team_avg: number;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  bester_name: 'Sara K.',
  fahrer: [
    { rang: 1, lieferzeit_varianz_min: 1.8, alert_hoch: false },
    { rang: 2, lieferzeit_varianz_min: 3.2, alert_hoch: false },
    { rang: 3, lieferzeit_varianz_min: 5.7, alert_hoch: false },
    { rang: 4, lieferzeit_varianz_min: 9.4, alert_hoch: true  },
  ],
  team_avg: 5.0,
  alert_count: 1,
  gesamt: 4,
};

export function KitchenPhase5449LieferzeitVarianzTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-lieferzeit-varianz-ranking?location_id=${locationId}`);
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
      <Sigma className="h-3.5 w-3.5 text-purple-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-white truncate">
            #1 {data.bester_name}
          </span>
          {best && (
            <span className="text-xs font-mono text-purple-400">±{best.lieferzeit_varianz_min.toFixed(1)}min</span>
          )}
        </div>
        <div className="text-[10px] text-gray-500">
          Team-Ø ±{data.team_avg.toFixed(1)}min · Lieferzeit-Varianz
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

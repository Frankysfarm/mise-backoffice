'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock3, AlertTriangle } from 'lucide-react';

// Phase 5539 — Schichtstart-Pünktlichkeit-Ticker (Kitchen)
// Clock3 sky-400; Pünktlichste/r #1 Name+Ø-Verzögerung min; Team-Ø; Hoch-Alert >3min; 30-Min-Polling; Mock-Fallback

interface ApiResponse {
  puenktlichster_name: string;
  fahrer: Array<{ rang: number; avg_verzoegerung_min: number; alert_hoch: boolean }>;
  team_avg: number;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  puenktlichster_name: 'Nico W.',
  fahrer: [
    { rang: 1, avg_verzoegerung_min: 0.5, alert_hoch: false },
    { rang: 2, avg_verzoegerung_min: 1.2, alert_hoch: false },
    { rang: 3, avg_verzoegerung_min: 2.8, alert_hoch: false },
    { rang: 4, avg_verzoegerung_min: 4.1, alert_hoch: true  },
  ],
  team_avg: 2.15,
  alert_count: 1,
  gesamt: 4,
};

export function KitchenPhase5539SchichtstartPuenktlichkeitTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-schichtstart-puenktlichkeit-ranking?location_id=${locationId}`);
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
      <Clock3 className="h-3.5 w-3.5 text-sky-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-white truncate">
            #1 {data.puenktlichster_name}
          </span>
          {best && (
            <span className="text-xs font-mono text-sky-400">+{best.avg_verzoegerung_min}min Ø</span>
          )}
        </div>
        <div className="text-[10px] text-gray-500">
          Team-Ø +{data.team_avg}min · Schichtstart-Pünktlichkeit (30 Tage)
        </div>
      </div>
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-yellow-400 shrink-0">
          <AlertTriangle className="h-3 w-3" />
          Hoch
        </div>
      )}
    </div>
  );
}

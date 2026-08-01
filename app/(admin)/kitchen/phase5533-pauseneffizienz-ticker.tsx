'use client';

import { useEffect, useRef, useState } from 'react';
import { Coffee, AlertTriangle } from 'lucide-react';

// Phase 5533 — Pauseneffizienz-Ticker (Kitchen)
// Coffee cyan-400; Effizienteste/r #1 Name+%; Team-Ø; Hoch-Alert; 30-Min-Polling; Mock-Fallback

interface ApiResponse {
  effizienteste_name: string;
  fahrer: Array<{ rang: number; pausenquote_pct: number; alert_hoch: boolean }>;
  team_avg_pct: number;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  effizienteste_name: 'Julia F.',
  fahrer: [
    { rang: 1, pausenquote_pct: 3.2,  alert_hoch: false },
    { rang: 2, pausenquote_pct: 6.8,  alert_hoch: false },
    { rang: 3, pausenquote_pct: 11.4, alert_hoch: true  },
    { rang: 4, pausenquote_pct: 18.7, alert_hoch: true  },
  ],
  team_avg_pct: 10.0,
  alert_count: 2,
  gesamt: 4,
};

export function KitchenPhase5533PauseneffizienzTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-pauseneffizienz-ranking?location_id=${locationId}`);
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
      <Coffee className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-white truncate">
            #1 {data.effizienteste_name}
          </span>
          {best && (
            <span className="text-xs font-mono text-cyan-400">{best.pausenquote_pct}% Pause</span>
          )}
        </div>
        <div className="text-[10px] text-gray-500">
          Team-Ø {data.team_avg_pct}% · Pauseneffizienz (30 Tage)
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

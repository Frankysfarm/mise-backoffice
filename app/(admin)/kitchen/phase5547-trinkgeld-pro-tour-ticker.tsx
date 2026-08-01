'use client';

import { useEffect, useRef, useState } from 'react';
import { Coins, AlertTriangle } from 'lucide-react';

// Phase 5547 — Trinkgeld-pro-Tour-Ticker (Kitchen)
// Coins yellow-400; Beste/r #1 Name+€avg; Team-Ø; Niedrig-Alert; 30-Min-Polling; Mock-Fallback

interface ApiResponse {
  beste_name: string;
  fahrer: Array<{ rang: number; avg_trinkgeld: number; alert_niedrig: boolean }>;
  team_avg_trinkgeld: number;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  beste_name: 'Julia F.',
  fahrer: [
    { rang: 1, avg_trinkgeld: 2.80, alert_niedrig: false },
    { rang: 2, avg_trinkgeld: 2.10, alert_niedrig: false },
    { rang: 3, avg_trinkgeld: 1.50, alert_niedrig: false },
    { rang: 4, avg_trinkgeld: 0.40, alert_niedrig: true  },
  ],
  team_avg_trinkgeld: 1.70,
  alert_count: 1,
  gesamt: 4,
};

export function KitchenPhase5547TrinkgeldProTourTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-trinkgeld-pro-tour-ranking?location_id=${locationId}`);
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
      <Coins className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-white truncate">
            #1 {data.beste_name}
          </span>
          {best && (
            <span className="text-xs font-mono text-yellow-400">{best.avg_trinkgeld.toFixed(2)} €</span>
          )}
        </div>
        <div className="text-[10px] text-gray-500">
          Team-Ø {data.team_avg_trinkgeld.toFixed(2)} € · Trinkgeld pro Tour (30 Tage)
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

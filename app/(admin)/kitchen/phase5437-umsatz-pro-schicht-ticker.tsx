'use client';

import { useEffect, useRef, useState } from 'react';
import { Banknote, AlertTriangle } from 'lucide-react';

// Phase 5437 — Umsatz/Schicht-Ticker (Kitchen)
// Banknote orange-400; Beste/r #1 Name+€; Team-Ø; Niedrig-Alert; 30-Min-Polling; Mock-Fallback

interface ApiResponse {
  beste_name: string;
  fahrer: Array<{ rang: number; umsatz_pro_schicht: number; alert_niedrig: boolean }>;
  team_avg_umsatz: number;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  beste_name: 'Julia F.',
  fahrer: [
    { rang: 1, umsatz_pro_schicht: 187, alert_niedrig: false },
    { rang: 2, umsatz_pro_schicht: 162, alert_niedrig: false },
    { rang: 3, umsatz_pro_schicht: 143, alert_niedrig: false },
    { rang: 4, umsatz_pro_schicht:  98, alert_niedrig: true  },
  ],
  team_avg_umsatz: 147.5,
  alert_count: 1,
  gesamt: 4,
};

export function KitchenPhase5437UmsatzProSchichtTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-umsatz-pro-schicht-ranking?location_id=${locationId}`);
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
      <Banknote className="h-3.5 w-3.5 text-orange-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-white truncate">
            #1 {data.beste_name}
          </span>
          {best && (
            <span className="text-xs font-mono text-orange-400">{best.umsatz_pro_schicht.toFixed(0)} €/S</span>
          )}
        </div>
        <div className="text-[10px] text-gray-500">
          Team-Ø {data.team_avg_umsatz.toFixed(0)} € · Umsatz/Schicht
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

'use client';

import { useEffect, useRef, useState } from 'react';
import { RotateCcw, AlertTriangle } from 'lucide-react';

// Phase 5474 — Retour-Quote-Ticker (Kitchen)
// RotateCcw orange-400; Beste/r #1 Name+%; Team-Ø; Hoch-Alert; 30-Min-Polling; Mock-Fallback

interface ApiResponse {
  beste_name: string;
  fahrer: Array<{ rang: number; retour_quote_pct: number; alert_hoch: boolean }>;
  team_avg_pct: number;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  beste_name: 'Julia F.',
  fahrer: [
    { rang: 1, retour_quote_pct:  1.2, alert_hoch: false },
    { rang: 2, retour_quote_pct:  2.5, alert_hoch: false },
    { rang: 3, retour_quote_pct:  5.8, alert_hoch: false },
    { rang: 4, retour_quote_pct: 12.3, alert_hoch: true  },
  ],
  team_avg_pct: 5.45,
  alert_count: 1,
  gesamt: 4,
};

export function KitchenPhase5474RetourQuoteTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-retour-quote-ranking?location_id=${locationId}`);
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
      <RotateCcw className="h-3.5 w-3.5 text-orange-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-white truncate">
            #1 {data.beste_name}
          </span>
          {best && (
            <span className="text-xs font-mono text-orange-400">{best.retour_quote_pct.toFixed(1)}%</span>
          )}
        </div>
        <div className="text-[10px] text-gray-500">
          Team-Ø {data.team_avg_pct.toFixed(1)}% · Retour-Quote
        </div>
      </div>
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-orange-400 shrink-0">
          <AlertTriangle className="h-3 w-3" />
          Hoch
        </div>
      )}
    </div>
  );
}

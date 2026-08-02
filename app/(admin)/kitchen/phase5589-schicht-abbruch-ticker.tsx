'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertOctagon, AlertTriangle } from 'lucide-react';

// Phase 5589 — Schicht-Abbruch-Quote-Ticker (Kitchen)
// AlertOctagon red-400; Beste/r #1 Name+%; Team-Ø; Hoch-Alert; 30-Min-Polling; Mock-Fallback

interface ApiResponse {
  bester_name: string;
  fahrer: Array<{ rang: number; abbruch_pct: number; alert_hoch: boolean }>;
  team_avg_abbruch_pct: number;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  bester_name: 'Julia F.',
  fahrer: [
    { rang: 1, abbruch_pct:  1.5, alert_hoch: false },
    { rang: 2, abbruch_pct:  3.8, alert_hoch: false },
    { rang: 3, abbruch_pct:  7.2, alert_hoch: false },
    { rang: 4, abbruch_pct: 14.3, alert_hoch: true  },
  ],
  team_avg_abbruch_pct: 6.7,
  alert_count: 1,
  gesamt: 4,
};

export function KitchenPhase5589SchichtAbbruchTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-schicht-abbruch-ranking?location_id=${locationId}`);
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
      <AlertOctagon className="h-3.5 w-3.5 text-red-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-white truncate">
            #1 {data.bester_name}
          </span>
          {best && (
            <span className="text-xs font-mono text-green-400">{best.abbruch_pct.toFixed(1)} %</span>
          )}
        </div>
        <div className="text-[10px] text-gray-500">
          Team-Ø {data.team_avg_abbruch_pct.toFixed(1)} % · Schicht-Abbruch-Quote (30 Tage)
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

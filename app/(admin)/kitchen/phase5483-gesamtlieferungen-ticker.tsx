'use client';

import { useEffect, useRef, useState } from 'react';
import { Package2, AlertTriangle } from 'lucide-react';

// Phase 5483 — Gesamtlieferungen-Ticker (Kitchen)
// Package2 green-400; Aktivste/r #1 Name+Anzahl; Team-Ø; Niedrig-Alert; 30-Min-Polling; Mock-Fallback

interface ApiResponse {
  aktivster_name: string;
  fahrer: Array<{ rang: number; gesamt_lieferungen: number; alert_niedrig: boolean }>;
  team_avg: number;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  aktivster_name: 'Julia F.',
  fahrer: [
    { rang: 1, gesamt_lieferungen: 312, alert_niedrig: false },
    { rang: 2, gesamt_lieferungen: 287, alert_niedrig: false },
    { rang: 3, gesamt_lieferungen: 215, alert_niedrig: false },
    { rang: 4, gesamt_lieferungen:  98, alert_niedrig: true  },
  ],
  team_avg: 228,
  alert_count: 1,
  gesamt: 4,
};

export function KitchenPhase5483GesamtlieferungenTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-gesamtlieferungen-ranking?location_id=${locationId}`);
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
      <Package2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-white truncate">
            #1 {data.aktivster_name}
          </span>
          {best && (
            <span className="text-xs font-mono text-green-400">{best.gesamt_lieferungen} L</span>
          )}
        </div>
        <div className="text-[10px] text-gray-500">
          Team-Ø {data.team_avg} · Gesamtlieferungen (30 Tage)
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

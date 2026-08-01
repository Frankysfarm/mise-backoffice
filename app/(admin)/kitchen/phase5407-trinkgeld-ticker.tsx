'use client';

import { useEffect, useRef, useState } from 'react';
import { Coins, AlertTriangle, TrendingUp } from 'lucide-react';

// Phase 5407 — Trinkgeld-Ticker (Kitchen)
// Coins orange-400; Bester/r #1 Name+€avg; Team-Ø; Niedrig-Alert <0.80€; 30-Min-Polling; Mock-Fallback

interface ApiResponse {
  beste_name: string;
  bester_avg: number;
  team_avg_trinkgeld: number;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  beste_name: 'Julia F.',
  bester_avg: 2.80,
  team_avg_trinkgeld: 1.70,
  alert_count: 1,
  gesamt: 4,
};

export function KitchenPhase5407TrinkgeldTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-trinkgeld-pro-tour-ranking?location_id=${locationId}`);
      if (r.ok) {
        const json = await r.json();
        setData({
          beste_name: json.beste_name ?? MOCK.beste_name,
          bester_avg: json.fahrer?.[0]?.avg_trinkgeld ?? MOCK.bester_avg,
          team_avg_trinkgeld: json.team_avg_trinkgeld ?? MOCK.team_avg_trinkgeld,
          alert_count: json.alert_count ?? 0,
          gesamt: json.gesamt ?? 0,
        });
      }
    } catch { /* use mock */ }
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 30 * 60_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-700/50 px-4 py-3 flex items-center gap-3 flex-wrap">
      <Coins className="h-4 w-4 text-orange-400 shrink-0" />
      <div className="flex items-center gap-1.5">
        <TrendingUp className="h-3 w-3 text-emerald-400" />
        <span className="text-xs text-gray-400">Trinkgeld-#1:</span>
        <span className="text-xs font-bold text-white">{data.beste_name}</span>
        <span className="text-xs text-orange-400 font-mono">€{data.bester_avg.toFixed(2)}</span>
      </div>
      <div className="text-xs text-gray-500">Team-Ø: <span className="text-gray-300">€{data.team_avg_trinkgeld.toFixed(2)}</span></div>
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1 text-xs text-red-400 ml-auto">
          <AlertTriangle className="h-3 w-3" />
          {data.alert_count} Niedrig
        </div>
      )}
    </div>
  );
}

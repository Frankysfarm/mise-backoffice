'use client';

import { useEffect, useRef, useState } from 'react';
import { ThumbsUp, AlertTriangle, TrendingUp } from 'lucide-react';

// Phase 5421 — Akzeptanzrate-Ticker (Kitchen)
// ThumbsUp green-400; Beste/r #1 Name+%; Team-Ø; Niedrig-Alert; 30-Min-Polling; Mock-Fallback

interface ApiResponse {
  beste_name: string;
  beste_rate: number;
  team_avg_akzeptanz: number;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  beste_name: 'Julia F.',
  beste_rate: 96,
  team_avg_akzeptanz: 81.25,
  alert_count: 1,
  gesamt: 4,
};

export function KitchenPhase5421AkzeptanzTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-akzeptanz-rate-ranking?location_id=${locationId}`);
      if (r.ok) {
        const json = await r.json();
        setData({
          beste_name: json.beste_name ?? MOCK.beste_name,
          beste_rate: json.fahrer?.[0]?.akzeptanz_rate ?? MOCK.beste_rate,
          team_avg_akzeptanz: json.team_avg_akzeptanz ?? MOCK.team_avg_akzeptanz,
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
      <ThumbsUp className="h-4 w-4 text-green-400 shrink-0" />
      <div className="flex items-center gap-1.5">
        <TrendingUp className="h-3 w-3 text-emerald-400" />
        <span className="text-xs text-gray-400">Akzeptanz-#1:</span>
        <span className="text-xs font-bold text-white">{data.beste_name}</span>
        <span className="text-xs text-green-400 font-mono">{data.beste_rate.toFixed(0)} %</span>
      </div>
      <div className="text-xs text-gray-500">Team-Ø: <span className="text-gray-300">{data.team_avg_akzeptanz.toFixed(1)} %</span></div>
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1 text-xs text-red-400 ml-auto">
          <AlertTriangle className="h-3 w-3" />
          {data.alert_count} Niedrig
        </div>
      )}
    </div>
  );
}

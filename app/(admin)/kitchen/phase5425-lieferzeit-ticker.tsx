'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock, AlertTriangle, Zap } from 'lucide-react';

// Phase 5425 — Lieferzeit-Ticker (Kitchen)
// Clock blue-400; Schnellste/r #1 Name+Min; Team-Ø; Langsam-Alert; 30-Min-Polling; Mock-Fallback

interface ApiResponse {
  schnellster_name: string;
  schnellster_min: number;
  team_avg_min: number;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  schnellster_name: 'Julia F.',
  schnellster_min: 18.2,
  team_avg_min: 24.2,
  alert_count: 1,
  gesamt: 4,
};

export function KitchenPhase5425LieferzeitTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-avg-lieferzeit-ranking?location_id=${locationId}`);
      if (r.ok) {
        const json = await r.json();
        setData({
          schnellster_name: json.schnellster_name ?? MOCK.schnellster_name,
          schnellster_min:  json.fahrer?.[0]?.avg_lieferzeit_min ?? MOCK.schnellster_min,
          team_avg_min:     json.team_avg_min ?? MOCK.team_avg_min,
          alert_count:      json.alert_count ?? 0,
          gesamt:           json.gesamt ?? 0,
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
      <Clock className="h-4 w-4 text-blue-400 shrink-0" />
      <div className="flex items-center gap-1.5">
        <Zap className="h-3 w-3 text-emerald-400" />
        <span className="text-xs text-gray-400">Lieferzeit-#1:</span>
        <span className="text-xs font-bold text-white">{data.schnellster_name}</span>
        <span className="text-xs text-blue-400 font-mono">{data.schnellster_min.toFixed(1)} Min</span>
      </div>
      <div className="text-xs text-gray-500">Team-Ø: <span className="text-gray-300">{data.team_avg_min.toFixed(1)} Min</span></div>
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1 text-xs text-red-400 ml-auto">
          <AlertTriangle className="h-3 w-3" />
          {data.alert_count} Langsam
        </div>
      )}
    </div>
  );
}

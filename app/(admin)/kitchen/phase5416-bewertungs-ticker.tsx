'use client';

import { useEffect, useRef, useState } from 'react';
import { Star, AlertTriangle, TrendingUp } from 'lucide-react';

// Phase 5416 — Bewertungs-Ticker (Kitchen)
// Star yellow-400; Beste/r #1 Name+★avg; Team-Ø; Niedrig-Alert; 30-Min-Polling; Mock-Fallback

interface ApiResponse {
  bester_name: string;
  bester_avg: number;
  team_avg_rating: number;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  bester_name: 'Julia F.',
  bester_avg: 4.9,
  team_avg_rating: 4.28,
  alert_count: 1,
  gesamt: 4,
};

export function KitchenPhase5416BewertungsTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-bewertungs-ranking?location_id=${locationId}`);
      if (r.ok) {
        const json = await r.json();
        setData({
          bester_name: json.bester_name ?? MOCK.bester_name,
          bester_avg: json.fahrer?.[0]?.avg_rating ?? MOCK.bester_avg,
          team_avg_rating: json.team_avg_rating ?? MOCK.team_avg_rating,
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
      <Star className="h-4 w-4 text-yellow-400 shrink-0" />
      <div className="flex items-center gap-1.5">
        <TrendingUp className="h-3 w-3 text-emerald-400" />
        <span className="text-xs text-gray-400">Bewertungs-#1:</span>
        <span className="text-xs font-bold text-white">{data.bester_name}</span>
        <span className="text-xs text-yellow-400 font-mono">★ {data.bester_avg.toFixed(2)}</span>
      </div>
      <div className="text-xs text-gray-500">Team-Ø: <span className="text-gray-300">★ {data.team_avg_rating.toFixed(2)}</span></div>
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1 text-xs text-red-400 ml-auto">
          <AlertTriangle className="h-3 w-3" />
          {data.alert_count} Niedrig
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { Timer, AlertTriangle } from 'lucide-react';

// Phase 5491 — Tourstart-Reaktionszeit-Ticker (Kitchen)
// Timer violet-400; Schnellste/r #1 Name+Reaktionszeit; Team-Ø; Langsam-Alert; 30-Min-Polling; Mock-Fallback

interface ApiResponse {
  bester_name: string;
  fahrer: Array<{ rang: number; avg_min: number; alert_bottom: boolean }>;
  team_avg_min: number;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  bester_name: 'Max M.',
  fahrer: [
    { rang: 1, avg_min:  2, alert_bottom: false },
    { rang: 2, avg_min:  4, alert_bottom: false },
    { rang: 3, avg_min:  8, alert_bottom: false },
    { rang: 4, avg_min: 15, alert_bottom: true  },
  ],
  team_avg_min: 7,
  alert_count: 1,
  gesamt: 4,
};

function fmtMin(m: number): string {
  if (m < 1) return '<1 min';
  return `${m.toFixed(1)} min`;
}

export function KitchenPhase5491TourstartReaktionszeitTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-tourstart-reaktionszeit-ranking?location_id=${locationId}`);
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
      <Timer className="h-3.5 w-3.5 text-violet-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-white truncate">
            #1 {data.bester_name}
          </span>
          {best && (
            <span className="text-xs font-mono text-violet-400">{fmtMin(best.avg_min)}</span>
          )}
        </div>
        <div className="text-[10px] text-gray-500">
          Team-Ø {fmtMin(data.team_avg_min)} · Tourstart-Reaktionszeit (30 Tage)
        </div>
      </div>
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-yellow-400 shrink-0">
          <AlertTriangle className="h-3 w-3" />
          Langsam
        </div>
      )}
    </div>
  );
}

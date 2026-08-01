'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock3, AlertTriangle } from 'lucide-react';

// Phase 5487 — Tourstart-Pünktlichkeit-Ticker (Kitchen)
// Clock3 blue-400; Pünktlichste/r #1 Name+Verzögerung; Team-Ø; Verspätet-Alert; 30-Min-Polling; Mock-Fallback

interface ApiResponse {
  bester_name: string;
  fahrer: Array<{ rang: number; avg_verzoegerung_min: number; alert_verspaetet: boolean }>;
  team_avg_min: number;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  bester_name: 'Julia F.',
  fahrer: [
    { rang: 1, avg_verzoegerung_min:  0, alert_verspaetet: false },
    { rang: 2, avg_verzoegerung_min:  2, alert_verspaetet: false },
    { rang: 3, avg_verzoegerung_min:  5, alert_verspaetet: false },
    { rang: 4, avg_verzoegerung_min: 12, alert_verspaetet: true  },
  ],
  team_avg_min: 4.75,
  alert_count: 1,
  gesamt: 4,
};

function fmtMin(m: number): string {
  if (m === 0) return '0 min';
  return `${m.toFixed(1)} min`;
}

export function KitchenPhase5487TourstartPuenktlichkeitTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-tourstart-puenktlichkeit?location_id=${locationId}`);
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
      <Clock3 className="h-3.5 w-3.5 text-blue-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-white truncate">
            #1 {data.bester_name}
          </span>
          {best && (
            <span className="text-xs font-mono text-blue-400">{fmtMin(best.avg_verzoegerung_min)}</span>
          )}
        </div>
        <div className="text-[10px] text-gray-500">
          Team-Ø {fmtMin(data.team_avg_min)} · Tourstart-Pünktlichkeit (30 Tage)
        </div>
      </div>
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-yellow-400 shrink-0">
          <AlertTriangle className="h-3 w-3" />
          Verspätet
        </div>
      )}
    </div>
  );
}

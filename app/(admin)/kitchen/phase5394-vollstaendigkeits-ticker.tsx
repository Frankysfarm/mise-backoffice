'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

// Phase 5394 — Vollständigkeits-Ticker (Kitchen)
// CheckCircle emerald-400; Beste/r #1 Name+%; Team-Ø; Niedrig-Alert <88%; 30-Min-Polling; Mock-Fallback

interface ApiResponse {
  fahrer: { fahrer_id: string; fahrer_name: string; rang: number; vollstaendigkeit_pct: number; alert_niedrig: boolean }[];
  team_avg_pct: number;
  beste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, vollstaendigkeit_pct: 97.0, alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, vollstaendigkeit_pct: 84.0, alert_niedrig: true  },
  ],
  team_avg_pct: 91.5,
  beste_name: 'Julia F.',
  alert_count: 1,
  gesamt: 4,
};

export function KitchenPhase5394VollstaendigkeitsTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const poll = () => {
      const url = locationId
        ? `/api/delivery/admin/fahrer-vollstaendigkeit-ranking?location_id=${locationId}`
        : '/api/delivery/admin/fahrer-vollstaendigkeit-ranking';
      fetch(url, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setData(d); })
        .catch(() => {});
    };
    poll();
    ivRef.current = setInterval(poll, 30 * 60_000);
    return () => { if (ivRef.current) clearInterval(ivRef.current); };
  }, [locationId]);

  const top = data.fahrer[0];

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 flex items-center gap-3 text-sm font-mono">
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-[10px] text-zinc-500">Vollständigkeit #1</span>
        <span className="text-xs font-bold text-zinc-200 truncate">{top?.fahrer_name ?? '–'}</span>
        <span className="text-xs font-bold text-emerald-400">{top?.vollstaendigkeit_pct ?? 0}%</span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[10px] text-zinc-500">Ø {data.team_avg_pct}%</span>
        {data.alert_count > 0 && (
          <div className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-red-400" />
            <span className="text-[10px] text-red-400">{data.alert_count}</span>
          </div>
        )}
      </div>
    </div>
  );
}

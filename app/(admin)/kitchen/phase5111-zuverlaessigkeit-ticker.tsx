'use client';

import { useEffect, useState } from 'react';
import { Shield, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  score: number;
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_score: number;
  alert_count: number;
}

export function KitchenPhase5111ZuverlaessigkeitTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const url = locationId
      ? `/api/delivery/admin/fahrer-zuverlaessigkeits-score-ranking?location_id=${locationId}`
      : '/api/delivery/admin/fahrer-zuverlaessigkeits-score-ranking';
    const res = await fetch(url);
    if (res.ok) setData(await res.json());
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data?.fahrer?.length) return null;

  const top = data.fahrer[0];

  return (
    <div className="rounded-xl border border-violet-700 bg-violet-900/60 px-4 py-3 mb-3 flex items-center gap-3">
      <Shield className="w-4 h-4 text-violet-300 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-400">Zuverlässigkeits-Score — Höchster Score</div>
        <div className="text-sm font-bold text-violet-100 truncate">
          #{top.rang} {top.fahrer_name} — {top.score} Punkte
        </div>
        <div className="text-[10px] text-gray-500 mt-0.5">
          Team-Ø: {data.team_avg_score}
          {data.alert_count > 0 && (
            <span className="ml-2 text-red-400 inline-flex items-center gap-0.5">
              <AlertTriangle className="w-3 h-3" />
              {data.alert_count} Niedrig
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

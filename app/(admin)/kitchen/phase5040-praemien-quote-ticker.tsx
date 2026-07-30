'use client';

import { useEffect, useState } from 'react';
import { Award, AlertTriangle } from 'lucide-react';

interface ApiResponse {
  fahrer: Array<{
    fahrer_id: string;
    fahrer_name: string;
    praemien_quote: number;
    rang: number;
    ampel: 'gruen' | 'gelb' | 'rot';
  }>;
  team_avg_pct: number;
  alert_count: number;
}

export function KitchenPhase5040PraemienQuoteTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const url = locationId
      ? `/api/delivery/admin/fahrer-praemien-quote-ranking?location_id=${locationId}`
      : '/api/delivery/admin/fahrer-praemien-quote-ranking';
    const res = await fetch(url);
    if (res.ok) setData(await res.json());
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data) return null;

  const top = data.fahrer[0];

  return (
    <div className="rounded-xl border border-yellow-700 bg-yellow-900/60 px-4 py-3 mb-3 flex items-center gap-3">
      <Award className="w-4 h-4 text-yellow-300 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-400">Prämien-Quote-Ranking — Champion</div>
        <div className="text-sm font-bold text-yellow-100 truncate">
          #{top?.rang} {top?.fahrer_name} — {top?.praemien_quote}%
        </div>
        <div className="text-xs text-gray-500">Team-Ø: {data.team_avg_pct}% · Ziel ≥75%</div>
      </div>
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1 text-xs text-red-400 shrink-0">
          <AlertTriangle className="w-3 h-3" />
          {data.alert_count}
        </div>
      )}
    </div>
  );
}

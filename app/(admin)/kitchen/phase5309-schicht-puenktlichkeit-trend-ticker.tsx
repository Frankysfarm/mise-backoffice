'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  trend_pct: number;
  aktuell_pct: number;
  alert_negativ: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_trend_pct: number;
  alert_count: number;
  gesamt: number;
}

export function KitchenPhase5309SchichtPuenktlichkeitTrendTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const url = locationId
      ? `/api/delivery/admin/fahrer-schicht-puenktlichkeit-trend-ranking?location_id=${locationId}`
      : '/api/delivery/admin/fahrer-schicht-puenktlichkeit-trend-ranking';
    const res = await fetch(url).catch(() => null);
    if (res?.ok) setData(await res.json());
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data?.fahrer?.length) return null;

  const top = data.fahrer[0];
  const isPositive = top.trend_pct >= 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <div className="rounded-xl border border-emerald-700 bg-emerald-900/60 px-4 py-3 mb-3 flex items-center gap-3">
      <TrendIcon className="w-4 h-4 text-emerald-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-400">Pünktlichkeits-Trend — Größte Verbesserung</div>
        <div className="text-sm font-bold text-emerald-100 truncate">
          #{top.rang} {top.fahrer_name} — {isPositive ? '+' : ''}{top.trend_pct}% (jetzt {top.aktuell_pct}%)
        </div>
        <div className="text-[10px] text-gray-500 mt-0.5">
          Team-Trend: {data.team_trend_pct >= 0 ? '+' : ''}{data.team_trend_pct}% · {data.gesamt} Fahrer erfasst
          {data.alert_count > 0 && (
            <span className="ml-2 text-red-400 inline-flex items-center gap-0.5">
              <AlertTriangle className="w-3 h-3" />
              {data.alert_count} Negativ-Trend
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

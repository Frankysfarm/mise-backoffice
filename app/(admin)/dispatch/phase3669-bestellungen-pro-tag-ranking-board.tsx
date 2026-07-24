'use client';

import { useState, useEffect, useCallback } from 'react';
import { Route, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  bestellungen_pro_tag: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rang: number;
  alert_low: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
}

const AMPEL_COLOR: Record<string, string> = {
  gruen: 'text-emerald-600',
  gelb: 'text-orange-500',
  rot: 'text-red-600',
};

const AMPEL_BG: Record<string, string> = {
  gruen: 'bg-emerald-50 border-emerald-200',
  gelb: 'bg-orange-50 border-orange-200',
  rot: 'bg-red-50 border-red-200',
};

const RANK_BADGE: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function DispatchPhase3669BestellungenProTagRankingBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-bestellungen-pro-tag?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (loading) return <div className="animate-pulse h-48 bg-gray-100 rounded-xl" />;
  if (!data || !locationId) return null;

  const sorted = [...data.fahrer].sort((a, b) => b.bestellungen_pro_tag - a.bestellungen_pro_tag);
  const bester = sorted[0];
  const wenigste = sorted[sorted.length - 1];
  const maxVal = bester?.bestellungen_pro_tag ?? 1;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Route className="w-5 h-5 text-purple-500" />
        <h3 className="font-semibold text-gray-900">Bestellungen/Tag — Ranking</h3>
        {data.alert_count > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-red-600">
            <AlertTriangle className="w-3.5 h-3.5" /> {data.alert_count} Alarm
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="bg-purple-50 rounded-lg p-2">
          <div className="font-semibold text-purple-700 truncate">{bester?.fahrer_name ?? '—'}</div>
          <div className="text-purple-600">{bester ? `${bester.bestellungen_pro_tag.toFixed(1)}/Tag` : '—'}</div>
          <div className="text-gray-400">Fleißigster</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="font-semibold text-gray-700">{data.team_avg.toFixed(1)}/Tag</div>
          <div className="text-gray-400">Team-Ø</div>
        </div>
        <div className="bg-red-50 rounded-lg p-2">
          <div className="font-semibold text-red-700 truncate">{wenigste?.fahrer_name ?? '—'}</div>
          <div className="text-red-600">{wenigste ? `${wenigste.bestellungen_pro_tag.toFixed(1)}/Tag` : '—'}</div>
          <div className="text-gray-400">Wenigste</div>
        </div>
      </div>

      <div className="space-y-2">
        {sorted.map((f) => {
          const DeltaIcon = f.rank_delta > 0 ? TrendingUp : f.rank_delta < 0 ? TrendingDown : Minus;
          const deltaColor = f.rank_delta > 0 ? 'text-emerald-500' : f.rank_delta < 0 ? 'text-red-500' : 'text-gray-400';
          const pct = maxVal > 0 ? (f.bestellungen_pro_tag / maxVal) * 100 : 0;

          return (
            <div key={f.fahrer_id} className={`rounded-lg border p-2.5 ${AMPEL_BG[f.ampel]}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-bold text-gray-500 w-5">{RANK_BADGE[f.rang] ?? `#${f.rang}`}</span>
                <span className="flex-1 text-sm font-medium text-gray-900 truncate">{f.fahrer_name}</span>
                <span className={`text-sm font-bold ${AMPEL_COLOR[f.ampel]}`}>{f.bestellungen_pro_tag.toFixed(1)}/Tag</span>
                <DeltaIcon className={`w-3.5 h-3.5 ${deltaColor}`} />
                {f.rank_delta !== 0 && (
                  <span className={`text-xs font-medium ${deltaColor}`}>
                    {f.rank_delta > 0 ? `+${f.rank_delta}` : f.rank_delta}
                  </span>
                )}
                {f.alert_low && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
              </div>
              <div className="w-full bg-white/60 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all ${f.ampel === 'gruen' ? 'bg-emerald-400' : f.ampel === 'gelb' ? 'bg-orange-400' : 'bg-red-400'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {f.alert_low && (
                <div className="text-xs text-red-600 mt-1">Wenige Bestellungen/Tag!</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

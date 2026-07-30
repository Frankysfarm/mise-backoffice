'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Star } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_rating: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_rating: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
  gesamt: number;
}

function DeltaIcon({ delta }: { delta: number }) {
  if (delta > 0) return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (delta < 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-400" />;
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-amber-300';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-red-400';
}

function barColor(a: string) {
  if (a === 'gruen') return 'bg-amber-400';
  if (a === 'gelb') return 'bg-yellow-500';
  return 'bg-red-600';
}

export function DispatchPhase4954BewertungsBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const url = locationId
      ? `/api/delivery/admin/fahrer-bewertungs-ranking?location_id=${locationId}`
      : '/api/delivery/admin/fahrer-bewertungs-ranking';
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

  const maxVal = Math.max(...data.fahrer.map(f => f.avg_rating), 1);

  return (
    <div className="rounded-2xl border border-amber-700 bg-amber-950/40 overflow-hidden mb-4">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-amber-700/50 bg-amber-900/20">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-300" />
          <span className="text-sm font-semibold text-amber-200">Kundenbewertungs-Ranking (⭐)</span>
        </div>
        {data.alert_count > 0 && (
          <div className="flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            {data.alert_count} niedrig
          </div>
        )}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-3 divide-x divide-amber-800/50 border-b border-amber-800/50">
        {[
          { label: 'Beste ⭐',   val: `${data.fahrer[0]?.avg_rating ?? '—'} ⭐`, sub: data.bester_name },
          { label: 'Team-Ø',    val: `${data.team_avg_rating} ⭐`,                sub: `${data.gesamt} Fahrer` },
          { label: 'Niedrigste', val: `${data.fahrer[data.fahrer.length - 1]?.avg_rating ?? '—'} ⭐`, sub: data.letzter_name },
        ].map(k => (
          <div key={k.label} className="flex flex-col items-center py-3 gap-0.5">
            <span className="text-sm font-bold text-amber-100">{k.val}</span>
            <span className="text-[10px] text-amber-400">{k.label}</span>
            <span className="text-[10px] text-gray-500 truncate max-w-[80px] text-center">{k.sub}</span>
          </div>
        ))}
      </div>

      {/* Ranking — descending: Rang 1 = highest avg_rating */}
      <div className="divide-y divide-amber-900/40">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className="px-4 py-2.5 flex items-center gap-3">
            <span className={`text-sm font-bold w-5 text-center ${f.rang === 1 ? 'text-yellow-400' : 'text-gray-400'}`}>
              {f.rang}
            </span>
            <DeltaIcon delta={f.rank_delta} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white truncate">{f.fahrer_name}</span>
                {f.alert_niedrig && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-900/70 text-red-300">
                    niedrig
                  </span>
                )}
              </div>
              <div className="mt-1 h-1.5 bg-amber-900/50 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${barColor(f.ampel)}`}
                  style={{ width: `${(f.avg_rating / maxVal) * 100}%` }}
                />
              </div>
            </div>
            <span className={`text-sm font-bold tabular-nums shrink-0 ${ampelColor(f.ampel)}`}>
              {f.avg_rating}
            </span>
            <span className="text-[10px] text-gray-500 shrink-0">⭐</span>
          </div>
        ))}
      </div>

      <div className="px-4 py-2 border-t border-amber-800/30 flex items-center justify-between">
        <span className="text-[10px] text-gray-600">Rang 1 = höchste Bewertung · 30-Min-Polling · letzte 30 Tage</span>
        <span className="text-[10px] text-gray-600">Ziel: ≥4,5 ⭐</span>
      </div>
    </div>
  );
}

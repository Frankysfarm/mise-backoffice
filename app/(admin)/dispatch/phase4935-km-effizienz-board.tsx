'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Route } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  km_pro_tour: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_km: number;
  meister_name: string;
  wenigster_name: string;
  alert_count: number;
  gesamt: number;
}

function DeltaIcon({ delta }: { delta: number }) {
  if (delta > 0) return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (delta < 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-400" />;
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-green-400';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-red-400';
}

function barColor(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-yellow-500';
  return 'bg-red-500';
}

export function DispatchPhase4935KmEffizienzBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const url = locationId
      ? `/api/delivery/admin/fahrer-km-effizienz-ranking?location_id=${locationId}`
      : '/api/delivery/admin/fahrer-km-effizienz-ranking';
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

  const maxKm = Math.max(...data.fahrer.map(f => f.km_pro_tour), 1);

  return (
    <div className="rounded-2xl border border-emerald-700 bg-emerald-950/40 overflow-hidden mb-4">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-emerald-700/50 bg-emerald-900/20">
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-emerald-300" />
          <span className="text-sm font-semibold text-emerald-200">Kilometer-Effizienz (km/Tour)</span>
        </div>
        {data.alert_count > 0 && (
          <div className="flex items-center gap-1 text-xs text-red-300">
            <AlertTriangle className="w-3.5 h-3.5" />
            {data.alert_count} &gt;8,0 km
          </div>
        )}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-3 divide-x divide-emerald-800/50 border-b border-emerald-800/50">
        {[
          { label: 'Effizienteste', val: `${data.fahrer[0]?.km_pro_tour.toFixed(1) ?? '—'} km`, sub: data.meister_name },
          { label: 'Team-Ø',       val: `${data.team_avg_km.toFixed(1)} km`,                   sub: `${data.gesamt} Fahrer` },
          { label: 'Höchste km',   val: `${data.fahrer[data.fahrer.length - 1]?.km_pro_tour.toFixed(1) ?? '—'} km`, sub: data.wenigster_name },
        ].map(k => (
          <div key={k.label} className="flex flex-col items-center py-3 gap-0.5">
            <span className="text-sm font-bold text-emerald-100">{k.val}</span>
            <span className="text-[10px] text-emerald-400">{k.label}</span>
            <span className="text-[10px] text-gray-500 truncate max-w-[80px] text-center">{k.sub}</span>
          </div>
        ))}
      </div>

      {/* Ranking — INVERTED: Rang 1 = lowest km */}
      <div className="divide-y divide-emerald-900/40">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className="px-4 py-2.5 flex items-center gap-3">
            <span className={`text-sm font-bold w-5 text-center ${f.rang === 1 ? 'text-yellow-400' : 'text-gray-400'}`}>
              {f.rang}
            </span>
            <DeltaIcon delta={f.rank_delta} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white truncate">{f.fahrer_name}</span>
                {f.alert_hoch && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-900/70 text-red-300">
                    &gt;8 km
                  </span>
                )}
              </div>
              <div className="mt-1 h-1.5 bg-emerald-900/50 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${barColor(f.ampel)}`}
                  style={{ width: `${(f.km_pro_tour / maxKm) * 100}%` }}
                />
              </div>
            </div>
            <span className={`text-sm font-bold tabular-nums shrink-0 ${ampelColor(f.ampel)}`}>
              {f.km_pro_tour.toFixed(1)}
            </span>
            <span className="text-[10px] text-gray-500 shrink-0">km</span>
          </div>
        ))}
      </div>

      <div className="px-4 py-2 border-t border-emerald-800/30 flex items-center justify-between">
        <span className="text-[10px] text-gray-600">Rang 1 = wenigste km/Tour · 30-Min-Polling · letzte 30 Tage</span>
        <span className="text-[10px] text-gray-600">Ziel: &lt;5,5 km/Tour</span>
      </div>
    </div>
  );
}

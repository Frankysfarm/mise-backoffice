'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Navigation } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  km_avg: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_top: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
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
  if (a === 'gruen') return 'text-green-400';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-red-400';
}

function barColor(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-yellow-500';
  return 'bg-red-500';
}

export function DispatchPhase4752KmProTourBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const url = locationId
      ? `/api/delivery/admin/fahrer-km-ranking?location_id=${locationId}`
      : '/api/delivery/admin/fahrer-km-ranking';
    const res = await fetch(url);
    if (res.ok) setData(await res.json());
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!data) return null;

  const maxKm = Math.max(...data.fahrer.map(f => f.km_avg), 1);

  return (
    <div className="rounded-xl border border-indigo-800 bg-indigo-950/40 p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <Navigation className="w-4 h-4 text-indigo-400" />
        <span className="text-sm font-semibold text-indigo-300">KM pro Tour — Effizienz-Ranking</span>
        <span className="ml-auto text-xs text-gray-500">Rang 1 = kürzeste Route</span>
      </div>

      {data.alert_count > 0 && (
        <div className="flex items-center gap-2 text-xs text-red-300 bg-red-900/30 rounded px-3 py-1.5 mb-3">
          <AlertTriangle className="w-3 h-3" />
          {data.alert_count} Fahrer mit hohem KM-Aufwand pro Tour
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        <div className="bg-black/20 rounded p-2">
          <div className="text-xs text-gray-400">Effizienteste</div>
          <div className="text-sm font-bold text-green-400">{data.fahrer[0]?.km_avg.toFixed(1)} km</div>
        </div>
        <div className="bg-black/20 rounded p-2">
          <div className="text-xs text-gray-400">Team-Ø</div>
          <div className="text-sm font-bold text-indigo-300">{data.team_avg.toFixed(1)} km</div>
        </div>
        <div className="bg-black/20 rounded p-2">
          <div className="text-xs text-gray-400">Längste Route</div>
          <div className="text-sm font-bold text-red-400">{data.fahrer[data.fahrer.length - 1]?.km_avg.toFixed(1)} km</div>
        </div>
      </div>

      <div className="space-y-2">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className="flex items-center gap-2">
            <span className="text-xs w-4 text-gray-400">{f.rang}</span>
            <span className={`text-xs w-14 truncate font-medium ${ampelColor(f.ampel)}`}>{f.fahrer_name}</span>
            <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${barColor(f.ampel)}`}
                style={{ width: `${(f.km_avg / maxKm) * 100}%` }}
              />
            </div>
            <span className={`text-xs w-14 text-right ${ampelColor(f.ampel)}`}>{f.km_avg.toFixed(1)} km</span>
            <DeltaIcon delta={f.rank_delta} />
          </div>
        ))}
      </div>

      <div className="mt-3 text-xs text-gray-500 text-center">
        Effizienteste Route: {data.bester_name}
      </div>
    </div>
  );
}

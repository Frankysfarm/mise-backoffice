'use client';

import { useEffect, useState } from 'react';
import { TrendingDown, TrendingUp, Minus, AlertTriangle } from 'lucide-react';

interface FahrerVerbesserung {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  delta_min: number;
  aktuell_min: number;
  vormonat_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface VerbesserungResponse {
  fahrer: FahrerVerbesserung[];
  team_avg_delta: number;
  bester_name: string;
  alert_count: number;
  gesamt: number;
  ziel_delta_min: number;
}

function fmt(v: number) {
  if (v < 0) return `${v} min`;
  if (v > 0) return `+${v} min`;
  return '±0 min';
}

function RankDeltaIcon({ d }: { d: number }) {
  if (d < 0) return <TrendingDown className="inline w-3 h-3 text-green-500" />;
  if (d > 0) return <TrendingUp className="inline w-3 h-3 text-red-500" />;
  return <Minus className="inline w-3 h-3 text-gray-400" />;
}

export function DispatchPhase3989ReactionsVerbesserungBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<VerbesserungResponse | null>(null);

  async function load() {
    try {
      const params = locationId ? `?location_id=${locationId}` : '';
      const res = await fetch(`/api/delivery/admin/fahrer-reaktionszeit-verbesserung${params}`);
      if (res.ok) setData(await res.json());
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const ampelColor = (a: string) =>
    a === 'gruen' ? 'text-green-600' : a === 'gelb' ? 'text-yellow-600' : 'text-red-600';

  const bester = data.fahrer[0];
  const schlechtester = data.fahrer[data.fahrer.length - 1];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <TrendingDown className="w-5 h-5 text-green-600" />
        <span className="font-semibold text-gray-800">Reaktionszeit-Verbesserung</span>
        <span className="ml-auto text-xs text-gray-400">vs. Vormonat</span>
      </div>

      {data.alert_count > 0 && (
        <div className="flex items-center gap-1 mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4" />
          <span>Sinkende Reaktionszeit! {data.alert_count} Fahrer verschlechtert</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 mb-3">
        {bester && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-2 text-center">
            <div className="text-xs text-gray-500">Bester</div>
            <div className="font-semibold text-green-700 text-sm truncate">{bester.fahrer_name}</div>
            <div className="text-xs text-green-600">{fmt(bester.delta_min)}</div>
          </div>
        )}
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-2 text-center">
          <div className="text-xs text-gray-500">Team-Avg</div>
          <div className="font-semibold text-gray-700 text-sm">{fmt(data.team_avg_delta)}</div>
          <div className="text-xs text-gray-400">Ziel {fmt(data.ziel_delta_min)}</div>
        </div>
        {schlechtester && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-2 text-center">
            <div className="text-xs text-gray-500">Schlechtester</div>
            <div className="font-semibold text-red-700 text-sm truncate">{schlechtester.fahrer_name}</div>
            <div className="text-xs text-red-600">{fmt(schlechtester.delta_min)}</div>
          </div>
        )}
      </div>

      <div className="space-y-1">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className="flex items-center gap-2 text-sm">
            <span className="w-5 text-xs text-gray-400 text-right">{f.rang}.</span>
            <span className={`flex-1 font-medium ${ampelColor(f.ampel)}`}>{f.fahrer_name}</span>
            <span className="text-xs text-gray-400"><RankDeltaIcon d={f.rank_delta} /></span>
            <span className={`text-xs font-mono ${f.delta_min < 0 ? 'text-green-600' : f.delta_min > 0 ? 'text-red-600' : 'text-gray-500'}`}>
              {fmt(f.delta_min)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

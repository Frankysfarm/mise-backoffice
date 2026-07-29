'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Clock } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_wartezeit_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_lang: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_wartezeit: number;
  beste_name: string;
  laengste_name: string;
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

export function DispatchPhase4737WartezeitRestaurantBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const url = locationId
      ? `/api/delivery/admin/fahrer-wartezeit-restaurant-ranking?location_id=${locationId}`
      : '/api/delivery/admin/fahrer-wartezeit-restaurant-ranking';
    const res = await fetch(url);
    if (res.ok) setData(await res.json());
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!data) return null;

  const maxMin = Math.max(...data.fahrer.map(f => f.avg_wartezeit_min), 1);

  return (
    <div className="rounded-xl border border-orange-800 bg-orange-950/40 p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-orange-400" />
        <span className="text-sm font-semibold text-orange-300">Wartezeit am Restaurant</span>
        <span className="ml-auto text-xs text-gray-500">Rang 1 = kürzeste Zeit</span>
      </div>

      {data.alert_count > 0 && (
        <div className="flex items-center gap-2 text-xs text-red-300 bg-red-900/30 rounded px-3 py-1.5 mb-3">
          <AlertTriangle className="w-3 h-3" />
          {data.alert_count} Fahrer mit langer Wartezeit (&gt;15 min)
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        <div className="bg-black/20 rounded p-2">
          <div className="text-xs text-gray-400">Kürzeste</div>
          <div className="text-sm font-bold text-green-400">{data.fahrer[0]?.avg_wartezeit_min.toFixed(1)} min</div>
        </div>
        <div className="bg-black/20 rounded p-2">
          <div className="text-xs text-gray-400">Team-Ø</div>
          <div className="text-sm font-bold text-orange-300">{data.team_avg_wartezeit.toFixed(1)} min</div>
        </div>
        <div className="bg-black/20 rounded p-2">
          <div className="text-xs text-gray-400">Längste</div>
          <div className="text-sm font-bold text-red-400">{data.fahrer[data.fahrer.length - 1]?.avg_wartezeit_min.toFixed(1)} min</div>
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
                style={{ width: `${(f.avg_wartezeit_min / maxMin) * 100}%` }}
              />
            </div>
            <span className="text-xs w-12 text-right text-gray-300">{f.avg_wartezeit_min.toFixed(1)} min</span>
            <DeltaIcon delta={f.rank_delta} />
          </div>
        ))}
      </div>

      <div className="mt-2 text-xs text-gray-500 text-right">Schnellster: {data.beste_name}</div>
    </div>
  );
}

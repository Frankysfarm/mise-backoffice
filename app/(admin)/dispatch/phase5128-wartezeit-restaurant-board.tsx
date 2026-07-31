'use client';

import { useEffect, useState } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

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
  if (a === 'gruen') return 'text-green-300';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-red-400';
}

function barColor(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-yellow-500';
  return 'bg-red-500';
}

export function DispatchPhase5128WartezeitRestaurantBoard({ locationId }: { locationId: string | null }) {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data) return null;

  const schnellste = data.fahrer[0];
  const langsamste = data.fahrer[data.fahrer.length - 1];
  const maxMin = Math.max(...data.fahrer.map(f => f.avg_wartezeit_min), 1);

  return (
    <div className="rounded-2xl border border-orange-700 bg-orange-950/40 overflow-hidden mb-4">
      <div className="px-4 py-3 flex items-center justify-between border-b border-orange-700/50 bg-orange-900/20">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-orange-300" />
          <span className="text-sm font-semibold text-orange-200">Wartezeit am Restaurant je Fahrer (letzte 30 Tage)</span>
        </div>
        {data.alert_count > 0 && (
          <div className="flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            {data.alert_count} Lang-Alert
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 divide-x divide-orange-800/40 border-b border-orange-700/30">
        <div className="px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">Niedrigste</div>
          <div className="text-sm font-bold text-green-300">{schnellste?.avg_wartezeit_min ?? '–'} min</div>
          <div className="text-[10px] text-gray-500 truncate">{schnellste?.fahrer_name ?? '–'}</div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">Team-Ø</div>
          <div className="text-sm font-bold text-orange-200">{data.team_avg_wartezeit} min</div>
          <div className="text-[10px] text-gray-500">Wartezeit</div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">Höchste</div>
          <div className="text-sm font-bold text-gray-400">{langsamste?.avg_wartezeit_min ?? '–'} min</div>
          <div className="text-[10px] text-gray-500 truncate">{langsamste?.fahrer_name ?? '–'}</div>
        </div>
      </div>

      <div className="px-4 py-3 space-y-2.5">
        {data.fahrer.map((f) => (
          <div key={f.fahrer_id} className="flex items-center gap-2">
            <span className={`text-xs font-bold w-5 shrink-0 ${ampelColor(f.ampel)}`}>#{f.rang}</span>
            <span className="text-xs text-gray-300 truncate flex-1">{f.fahrer_name}</span>
            <div className="w-20 h-1.5 rounded-full bg-gray-800 overflow-hidden shrink-0">
              <div
                className={`h-full rounded-full ${barColor(f.ampel)}`}
                style={{ width: `${Math.round((f.avg_wartezeit_min / maxMin) * 100)}%` }}
              />
            </div>
            <span className={`text-xs font-semibold w-12 text-right shrink-0 ${ampelColor(f.ampel)}`}>
              {f.avg_wartezeit_min} min
            </span>
            <DeltaIcon delta={f.rank_delta} />
            {f.alert_lang && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
          </div>
        ))}
      </div>

      <div className="px-4 py-2 border-t border-orange-800/30 bg-orange-900/10">
        <div className="text-[10px] text-gray-500">
          Schnellste: <span className="text-green-300 font-semibold">{data.beste_name}</span> ·
          Längste: <span className="text-gray-400">{data.laengste_name}</span>
        </div>
      </div>
    </div>
  );
}

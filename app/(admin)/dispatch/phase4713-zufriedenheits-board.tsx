'use client';

import { useEffect, useState } from 'react';
import { TrendingDown, TrendingUp, Minus, Star, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  zufriedenheits_index: number;
  avg_rating: number;
  puenktlichkeit_pct: number;
  erstkontakt_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_index: number;
  beste_name: string;
  niedrigste_name: string;
  alert_count: number;
  gesamt: number;
}

function DeltaIcon({ delta }: { delta: number }) {
  if (delta > 0) return <TrendingUp className="w-3 h-3 text-emerald-500" />;
  if (delta < 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-400" />;
}

const ampelColor: Record<string, string> = {
  gruen: 'bg-emerald-500',
  gelb:  'bg-amber-400',
  rot:   'bg-red-500',
};

export function DispatchPhase4713ZufriedenheitsBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-zufriedenheits-index-ranking?location_id=${locationId}`);
      if (r.ok) setData(await r.json());
    } catch { /* silent fallback */ }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return (
    <div className="rounded-2xl bg-indigo-900 p-4 text-indigo-300 text-sm animate-pulse">
      Lade Zufriedenheits-Index…
    </div>
  );

  const maxIdx = Math.max(...data.fahrer.map(f => f.zufriedenheits_index), 1);

  return (
    <div className="rounded-2xl bg-indigo-900 text-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-indigo-300" />
          <span className="font-semibold text-indigo-100">Zufriedenheits-Index Ranking</span>
        </div>
        <span className="text-xs text-indigo-400">30 Tage</span>
      </div>

      {data.alert_count > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-red-900/50 border border-red-600 px-3 py-2 text-red-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Niedriger Zufriedenheits-Index! Team-Ø unter 60
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-indigo-800/60 p-2">
          <p className="text-xs text-indigo-400">Höchster</p>
          <p className="text-sm font-bold text-emerald-400">{data.fahrer[0]?.zufriedenheits_index ?? '—'}</p>
          <p className="text-xs text-indigo-300 truncate">{data.beste_name}</p>
        </div>
        <div className="rounded-lg bg-indigo-800/60 p-2">
          <p className="text-xs text-indigo-400">Team-Ø</p>
          <p className="text-sm font-bold text-indigo-200">{data.team_avg_index}</p>
        </div>
        <div className="rounded-lg bg-indigo-800/60 p-2">
          <p className="text-xs text-indigo-400">Niedrigster</p>
          <p className="text-sm font-bold text-red-400">{data.fahrer[data.fahrer.length - 1]?.zufriedenheits_index ?? '—'}</p>
          <p className="text-xs text-indigo-300 truncate">{data.niedrigste_name}</p>
        </div>
      </div>

      <div className="space-y-2">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-indigo-400 w-4">#{f.rang}</span>
                <DeltaIcon delta={f.rank_delta} />
                <span className="text-indigo-100">{f.fahrer_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-indigo-300 text-[10px]">★{f.avg_rating.toFixed(1)} · {f.puenktlichkeit_pct}% · {f.erstkontakt_pct}%</span>
                <span className="font-bold text-white">{f.zufriedenheits_index}</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-indigo-800">
              <div
                className={`h-full rounded-full ${ampelColor[f.ampel]}`}
                style={{ width: `${(f.zufriedenheits_index / maxIdx) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

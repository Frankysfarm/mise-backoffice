'use client';

import { useEffect, useState } from 'react';
import { Star, TrendingDown, TrendingUp, Minus, WifiOff, AlertTriangle } from 'lucide-react';

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
  if (delta > 0) return <TrendingUp className="w-3 h-3 text-green-600 dark:text-green-400" />;
  if (delta < 0) return <TrendingDown className="w-3 h-3 text-red-500 dark:text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-400" />;
}

function ampelDot(ampel: 'gruen' | 'gelb' | 'rot') {
  if (ampel === 'gruen') return 'bg-green-500';
  if (ampel === 'gelb') return 'bg-yellow-400';
  return 'bg-red-500';
}

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`w-2.5 h-2.5 ${i <= Math.round(value) ? 'text-rose-500 fill-rose-500' : 'text-gray-300 dark:text-gray-600'}`}
        />
      ))}
    </div>
  );
}

export function DispatchPhase4673BewertungBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const params = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/fahrer-bewertung-ranking${params}`);
        if (!res.ok) throw new Error('fetch failed');
        const json: ApiResponse = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError(true);
      }
    }

    load();
    const iv = setInterval(load, 30 * 60 * 1000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (error) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 flex items-center gap-2 text-gray-400">
        <WifiOff className="w-4 h-4" />
        <span className="text-xs">Bewertung-Ranking nicht verfügbar</span>
      </div>
    );
  }

  if (!data) {
    return <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 animate-pulse h-48" />;
  }

  const maxRating = Math.max(...data.fahrer.map(f => f.avg_rating), 1);
  const hoechste = data.fahrer[0];
  const niedrigste = data.fahrer[data.fahrer.length - 1];

  return (
    <div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-white dark:bg-gray-900 p-3 space-y-2">
      <div className="flex items-center gap-1.5 justify-between">
        <div className="flex items-center gap-1.5">
          <Star className="w-4 h-4 text-rose-900 dark:text-rose-400 fill-rose-900 dark:fill-rose-400" />
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Kundenbewertung</span>
        </div>
        <span className="text-[10px] text-gray-400">{data.gesamt} Fahrer · 30 Tage</span>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-3 gap-1">
        <div className="bg-rose-50 dark:bg-rose-950 rounded-lg px-2 py-1.5 text-center">
          <div className="text-base font-extrabold text-rose-800 dark:text-rose-300">{hoechste?.avg_rating?.toFixed(1) ?? '–'}</div>
          <div className="text-[9px] text-gray-500 truncate">{hoechste?.fahrer_name ?? '–'}</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-2 py-1.5 text-center">
          <div className="text-base font-extrabold text-gray-700 dark:text-gray-300">{data.team_avg_rating.toFixed(2)}</div>
          <div className="text-[9px] text-gray-500">Team-Ø</div>
        </div>
        <div className="bg-red-50 dark:bg-red-950 rounded-lg px-2 py-1.5 text-center">
          <div className="text-base font-extrabold text-red-600 dark:text-red-400">{niedrigste?.avg_rating?.toFixed(1) ?? '–'}</div>
          <div className="text-[9px] text-gray-500 truncate">{niedrigste?.fahrer_name ?? '–'}</div>
        </div>
      </div>

      {/* Alert */}
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950 rounded-lg px-2 py-1.5">
          <AlertTriangle className="w-3 h-3 text-red-600 dark:text-red-400 shrink-0" />
          <span className="text-[10px] text-red-700 dark:text-red-300 font-medium">
            {data.alert_count} Fahrer mit niedriger Bewertung (&lt;4.0)
          </span>
        </div>
      )}

      {/* Per-Fahrer Bars */}
      <div className="space-y-1.5">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${ampelDot(f.ampel)}`} />
              <span className="text-[9px] text-gray-500 w-4 shrink-0">#{f.rang}</span>
              <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300 truncate flex-1">{f.fahrer_name}</span>
              <div className="flex items-center gap-1">
                <DeltaIcon delta={f.rank_delta} />
                <StarRating value={f.avg_rating} />
                <span className="text-[10px] font-bold text-rose-800 dark:text-rose-300">{f.avg_rating.toFixed(1)}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2">
                <div
                  className="bg-rose-500 dark:bg-rose-400 h-2 rounded-full"
                  style={{ width: `${(f.avg_rating / maxRating) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-1.5">
        <span>Ziel: <span className="font-medium text-rose-800 dark:text-rose-300">≥ 4.5 Sterne</span></span>
        <span className="text-[10px] text-gray-400">30-Min-Update</span>
      </div>
    </div>
  );
}

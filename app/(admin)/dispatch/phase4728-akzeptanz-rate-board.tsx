'use client';

import { useEffect, useState } from 'react';
import { TrendingDown, TrendingUp, Minus, WifiOff } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  akzeptanz_rate: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_akzeptanz: number;
  beste_name: string;
  niedrigste_name: string;
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

function barColor(ampel: 'gruen' | 'gelb' | 'rot') {
  if (ampel === 'gruen') return 'bg-green-500 dark:bg-green-400';
  if (ampel === 'gelb') return 'bg-yellow-400 dark:bg-yellow-300';
  return 'bg-red-500 dark:bg-red-400';
}

export function DispatchPhase4728AkzeptanzRateBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const params = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/fahrer-akzeptanz-rate-ranking${params}`);
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
        <span className="text-xs">Akzeptanz-Rate-Ranking nicht verfügbar</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 animate-pulse h-32" />
    );
  }

  const maxVal = Math.max(...data.fahrer.map(f => f.akzeptanz_rate), 1);

  return (
    <div className="rounded-2xl border border-teal-200 dark:border-teal-900 bg-teal-50 dark:bg-teal-950 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-teal-900 dark:text-teal-200 uppercase tracking-wide">
          Akzeptanz-Rate Ranking
        </span>
        <span className="text-[10px] text-teal-700 dark:text-teal-400">30 Tage</span>
      </div>

      {data.alert_count > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg px-2 py-1 text-[10px] text-amber-700 dark:text-amber-300">
          {data.alert_count} Fahrer mit niedriger Akzeptanz-Rate
        </div>
      )}

      <div className="grid grid-cols-3 gap-1.5">
        {[
          { label: 'Höchste', value: `${data.fahrer[0]?.akzeptanz_rate.toFixed(1)} %` },
          { label: 'Team-Ø', value: `${data.team_avg_akzeptanz.toFixed(1)} %` },
          { label: 'Niedrigste', value: `${data.fahrer[data.fahrer.length - 1]?.akzeptanz_rate.toFixed(1)} %` },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white dark:bg-teal-900/30 rounded-xl p-1.5 text-center">
            <div className="text-[11px] font-bold text-teal-900 dark:text-teal-200">{kpi.value}</div>
            <div className="text-[9px] text-teal-700 dark:text-teal-400 mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${ampelDot(f.ampel)}`} />
              <span className="text-[9px] text-gray-500 w-4 shrink-0">#{f.rang}</span>
              <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300 truncate flex-1">{f.fahrer_name}</span>
              <div className="flex items-center gap-1">
                <DeltaIcon delta={f.rank_delta} />
                <span className="text-[10px] font-bold text-teal-900 dark:text-teal-200">{f.akzeptanz_rate.toFixed(1)} %</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full ${barColor(f.ampel)}`}
                  style={{ width: `${(f.akzeptanz_rate / maxVal) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 border-t border-teal-100 dark:border-teal-900 pt-1.5">
        <span>Bester: <span className="font-medium text-teal-900 dark:text-teal-200">{data.beste_name}</span></span>
        <span>30-Min-Update</span>
      </div>
    </div>
  );
}

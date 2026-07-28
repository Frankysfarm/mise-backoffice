'use client';

import { useEffect, useState } from 'react';
import { Calendar, TrendingDown, TrendingUp, Minus, WifiOff, AlertTriangle } from 'lucide-react';

interface FahrerVergleich {
  fahrer_id: string;
  fahrer_name: string;
  pct_wochenend: number;
  pct_wochentag: number;
  delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiResponse {
  fahrer: FahrerVergleich[];
  team_avg_we: number;
  team_avg_wt: number;
  team_avg_delta: number;
  we_leader_name: string;
  we_leader_pct: number;
  alert_wochenende: boolean;
  gesamt: number;
}

function DeltaIcon({ delta }: { delta: number }) {
  if (delta >= 5) return <TrendingUp className="w-3 h-3 text-green-600 dark:text-green-400" />;
  if (delta <= -5) return <TrendingDown className="w-3 h-3 text-red-500 dark:text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-400" />;
}

function ampelColor(ampel: 'gruen' | 'gelb' | 'rot') {
  if (ampel === 'gruen') return 'bg-green-500';
  if (ampel === 'gelb') return 'bg-yellow-400';
  return 'bg-red-500';
}

export function DispatchPhase4663WochenendVergleich({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const params = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/fahrer-wochenend-vergleich${params}`);
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
        <span className="text-xs">Wochenend-Vergleich nicht verfügbar</span>
      </div>
    );
  }

  if (!data) {
    return <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 animate-pulse h-48" />;
  }

  const maxPct = Math.max(...data.fahrer.flatMap(f => [f.pct_wochenend, f.pct_wochentag]), 1);

  return (
    <div className="rounded-2xl border border-violet-200 dark:border-violet-900 bg-white dark:bg-gray-900 p-3 space-y-2">
      <div className="flex items-center gap-1.5 justify-between">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-violet-900 dark:text-violet-300" />
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">WE vs. Wochentag</span>
        </div>
        <span className="text-[10px] text-gray-400">{data.gesamt} Fahrer · 30 Tage</span>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-1">
        <div className="bg-violet-50 dark:bg-violet-950 rounded-lg px-2 py-1.5 text-center">
          <div className="text-base font-extrabold text-violet-900 dark:text-violet-300">{data.team_avg_we}%</div>
          <div className="text-[9px] text-gray-500">Team WE-Ø</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-2 py-1.5 text-center">
          <div className="text-base font-extrabold text-gray-700 dark:text-gray-300">{data.team_avg_wt}%</div>
          <div className="text-[9px] text-gray-500">Team WT-Ø</div>
        </div>
        <div className={`rounded-lg px-2 py-1.5 text-center ${data.team_avg_delta >= 0 ? 'bg-green-50 dark:bg-green-950' : 'bg-red-50 dark:bg-red-950'}`}>
          <div className={`text-base font-extrabold ${data.team_avg_delta >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-400'}`}>
            {data.team_avg_delta >= 0 ? '+' : ''}{data.team_avg_delta}%
          </div>
          <div className="text-[9px] text-gray-500">Δ WE−WT</div>
        </div>
      </div>

      {/* Alert */}
      {data.alert_wochenende && (
        <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950 rounded-lg px-2 py-1.5">
          <AlertTriangle className="w-3 h-3 text-red-600 dark:text-red-400 shrink-0" />
          <span className="text-[10px] text-red-700 dark:text-red-300 font-medium">Mehr Fahrer am Wochenende nötig</span>
        </div>
      )}

      {/* Per-Fahrer Bar-Chart WE vs WT */}
      <div className="space-y-1.5">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${ampelColor(f.ampel)}`} />
              <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300 truncate flex-1">{f.fahrer_name}</span>
              <div className="flex items-center gap-0.5">
                <DeltaIcon delta={f.delta} />
                <span className={`text-[10px] font-bold ${f.delta >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {f.delta >= 0 ? '+' : ''}{f.delta}%
                </span>
              </div>
            </div>
            {/* WE bar */}
            <div className="flex items-center gap-1">
              <span className="text-[8px] text-violet-600 dark:text-violet-400 w-5 shrink-0">WE</span>
              <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2">
                <div
                  className="bg-violet-600 dark:bg-violet-400 h-2 rounded-full"
                  style={{ width: `${(f.pct_wochenend / maxPct) * 100}%` }}
                />
              </div>
              <span className="text-[9px] font-bold text-violet-900 dark:text-violet-300 w-7 text-right">{f.pct_wochenend}%</span>
            </div>
            {/* WT bar */}
            <div className="flex items-center gap-1">
              <span className="text-[8px] text-gray-500 w-5 shrink-0">WT</span>
              <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2">
                <div
                  className="bg-gray-400 dark:bg-gray-500 h-2 rounded-full"
                  style={{ width: `${(f.pct_wochentag / maxPct) * 100}%` }}
                />
              </div>
              <span className="text-[9px] font-bold text-gray-600 dark:text-gray-400 w-7 text-right">{f.pct_wochentag}%</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-1.5">
        <span>WE-Leader: <span className="font-medium text-violet-900 dark:text-violet-300">{data.we_leader_name}</span></span>
        <span className="font-medium text-violet-900 dark:text-violet-300">{data.we_leader_pct}%</span>
      </div>
    </div>
  );
}

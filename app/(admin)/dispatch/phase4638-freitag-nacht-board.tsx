'use client';

import { useEffect, useState } from 'react';
import { Moon, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  freitag_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  hoechste_name: string;
  niedrigste_name: string;
  alert_count: number;
  gesamt: number;
}

const AMPEL_COLOR: Record<string, string> = {
  gruen: 'bg-green-500',
  gelb: 'bg-yellow-400',
  rot: 'bg-red-500',
};

function DeltaIcon({ delta }: { delta: number }) {
  if (delta > 0) return <TrendingUp className="w-3 h-3 text-green-500" />;
  if (delta < 0) return <TrendingDown className="w-3 h-3 text-red-500" />;
  return <Minus className="w-3 h-3 text-gray-400" />;
}

export function DispatchPhase4638FreitagNachtBoard({
  locationId,
}: {
  locationId: string | null;
}) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const params = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/fahrer-freitag-nacht-ranking${params}`);
        if (!res.ok) throw new Error('fetch failed');
        const json: ApiResponse = await res.json();
        if (!cancelled) { setData(json); setOffline(false); }
      } catch {
        if (!cancelled) setOffline(true);
      }
    }

    load();
    const iv = setInterval(load, 30 * 60 * 1000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (offline) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 flex items-center gap-2 text-gray-400">
        <WifiOff className="w-5 h-5" />
        <span className="text-sm">Freitagnacht-Ranking nicht verfügbar</span>
      </div>
    );
  }

  if (!data) {
    return <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 animate-pulse h-48" />;
  }

  const hoechste = data.fahrer[0];
  const niedrigste = data.fahrer[data.fahrer.length - 1];

  return (
    <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-white dark:bg-gray-900 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Moon className="w-5 h-5 text-emerald-700 dark:text-emerald-300" />
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Freitagnacht-Ranking</h3>
        <span className="ml-auto text-xs text-gray-400">Fr 22–02 Uhr</span>
      </div>

      {data.alert_count > 0 && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          ⚠ Wenig Freitagnacht! {data.alert_count} Fahrer unter 10%
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">Höchste</p>
          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{hoechste?.freitag_pct ?? 0}%</p>
          <p className="text-xs text-gray-500 truncate">{data.hoechste_name}</p>
        </div>
        <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">Team-Avg</p>
          <p className="text-lg font-bold text-gray-700 dark:text-gray-200">{data.team_avg}%</p>
          <p className="text-xs text-gray-400">{data.gesamt} Fahrer</p>
        </div>
        <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">Niedrigste</p>
          <p className="text-lg font-bold text-red-500">{niedrigste?.freitag_pct ?? 0}%</p>
          <p className="text-xs text-gray-500 truncate">{data.niedrigste_name}</p>
        </div>
      </div>

      <div className="space-y-2">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className="flex items-center gap-2">
            <span className="w-5 text-xs text-gray-400 text-right">#{f.rang}</span>
            <DeltaIcon delta={f.rank_delta} />
            <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">{f.fahrer_name}</span>
            <div className="w-24 bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full ${AMPEL_COLOR[f.ampel]}`}
                style={{ width: `${Math.min(100, f.freitag_pct)}%` }}
              />
            </div>
            <span className="w-10 text-xs text-right text-gray-600 dark:text-gray-400">{f.freitag_pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

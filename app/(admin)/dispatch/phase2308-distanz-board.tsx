'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Navigation } from 'lucide-react';

type DistanzAmpel = 'gruen' | 'gelb' | 'rot';

type FahrerDistanzInfo = {
  fahrer_id: string;
  fahrer_name: string;
  km_heute: number;
  avg_km_tour: number;
  touren_anzahl: number;
  km_h_schnitt: number;
  trend_vs_vorwoche_pct: number | null;
  ampel: DistanzAmpel;
  alert: boolean;
};

type ApiData = {
  fahrer: FahrerDistanzInfo[];
  team_avg_km: number;
  team_avg_km_tour: number;
  alert_count: number;
};

function ampelIcon(a: DistanzAmpel): string {
  if (a === 'gruen') return '🟢';
  if (a === 'gelb') return '🟡';
  return '🔴';
}

function rowBg(a: DistanzAmpel): string {
  if (a === 'gruen') return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
  if (a === 'gelb') return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
  return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
}

function rowText(a: DistanzAmpel): string {
  if (a === 'gruen') return 'text-green-700 dark:text-green-300';
  if (a === 'gelb') return 'text-yellow-700 dark:text-yellow-300';
  return 'text-red-700 dark:text-red-300';
}

function trendArrow(pct: number | null): string {
  if (pct === null) return '';
  if (pct > 0) return `↑${pct}%`;
  if (pct < 0) return `↓${Math.abs(pct)}%`;
  return '→ ±0%';
}

function trendColor(pct: number | null): string {
  if (pct === null) return 'text-gray-400';
  if (pct > 0) return 'text-green-600 dark:text-green-400';
  if (pct < 0) return 'text-red-500 dark:text-red-400';
  return 'text-gray-500';
}

const MEDALS = ['🥇', '🥈', '🥉'];

export function DispatchPhase2308DistanzBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-distanz?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const sorted = useMemo(
    () => [...(data?.fahrer ?? [])].sort((a, b) => b.km_heute - a.km_heute),
    [data],
  );

  const alertFahrer = useMemo(() => sorted.filter((f) => f.alert), [sorted]);
  const hasAlert = alertFahrer.length > 0;

  if (!locationId || !data) return null;

  const teamLevel: DistanzAmpel =
    data.alert_count === 0 ? 'gruen' : data.alert_count <= 1 ? 'gelb' : 'rot';

  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4 mb-3">
      <button
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-blue-500" />
          <span className="font-semibold text-blue-900 dark:text-blue-200 text-sm">
            Distanz-Board
          </span>
          <span className={`text-xs font-bold ml-1 ${rowText(teamLevel)}`}>
            {ampelIcon(teamLevel)} {data.alert_count} Alerts
          </span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-blue-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-blue-400" />
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {hasAlert && (
            <div className="flex items-center gap-2 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>
                <strong>{alertFahrer.length} Fahrer</strong> mit Distanz-Alert —{' '}
                {alertFahrer.map((f) => f.fahrer_name).join(', ')}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-blue-100 dark:border-blue-900 p-2 text-center">
              <div className="font-bold text-base text-blue-700 dark:text-blue-300">
                {data.team_avg_km} km
              </div>
              <div className="text-gray-500 dark:text-gray-400">Ø Team km/Tag</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-blue-100 dark:border-blue-900 p-2 text-center">
              <div className="font-bold text-base text-blue-700 dark:text-blue-300">
                {data.team_avg_km_tour} km
              </div>
              <div className="text-gray-500 dark:text-gray-400">Ø km je Tour</div>
            </div>
          </div>

          <div className="space-y-1">
            {sorted.map((f, i) => (
              <div
                key={f.fahrer_id}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${rowBg(f.ampel)}`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{i < 3 ? MEDALS[i] : ampelIcon(f.ampel)}</span>
                  <span className="font-medium">{f.fahrer_name}</span>
                  <span className="text-gray-400 dark:text-gray-500">
                    ({f.touren_anzahl} Touren, {f.km_h_schnitt} km/h)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${rowText(f.ampel)}`}>{f.km_heute} km</span>
                  {f.trend_vs_vorwoche_pct !== null && (
                    <span className={`text-xs ${trendColor(f.trend_vs_vorwoche_pct)}`}>
                      {trendArrow(f.trend_vs_vorwoche_pct)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

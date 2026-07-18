'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Route } from 'lucide-react';

type FahrerRoutenScore = {
  fahrer_id: string;
  fahrer_name: string;
  routen_score: number;
  km_je_tour: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  delta_pct: number;
  touren_heute: number;
  level: 'hoch' | 'mittel' | 'niedrig';
  hinweis: string;
};

type ApiData = {
  fahrer: FahrerRoutenScore[];
  team_ø_score: number;
  team_ø_km_je_tour: number;
  alert: boolean;
};

const PODIUM = ['🥇', '🥈', '🥉'];

function scoreColor(level: FahrerRoutenScore['level']): string {
  if (level === 'hoch') return 'text-green-600 dark:text-green-400';
  if (level === 'mittel') return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function scoreBg(level: FahrerRoutenScore['level']): string {
  if (level === 'hoch') return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
  if (level === 'mittel') return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
  return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
}

function trendIcon(trend: FahrerRoutenScore['trend']): string {
  if (trend === 'besser') return '↓';
  if (trend === 'schlechter') return '↑';
  return '→';
}

export function DispatchPhase2240RoutenOptimierungsBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-routen-score?location_id=${locationId}`);
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

  const niedrigFahrer = useMemo(() => data?.fahrer.filter((f) => f.level === 'niedrig') ?? [], [data]);

  if (!locationId || !data) return null;

  return (
    <div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 p-4 mb-3">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-purple-500" />
          <span className="font-semibold text-purple-900 dark:text-purple-200">Routen-Optimierungs-Board</span>
          {data.alert && (
            <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Routen-Alert
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-purple-500" /> : <ChevronDown className="w-4 h-4 text-purple-500" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white dark:bg-gray-800 px-3 py-2 text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400">Team Routen-Score Ø</div>
              <div className={`text-xl font-bold ${data.team_ø_score >= 70 ? 'text-green-600 dark:text-green-400' : data.team_ø_score >= 45 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                {data.team_ø_score}
              </div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 px-3 py-2 text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400">Ø km / Tour</div>
              <div className="text-xl font-bold text-gray-800 dark:text-white">{data.team_ø_km_je_tour.toFixed(1)}</div>
            </div>
          </div>

          {data.alert && (
            <div className="flex items-center gap-2 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Team-Routen-Score kritisch — Tourenplanung sofort optimieren!</span>
            </div>
          )}

          <div className="space-y-1">
            {data.fahrer.map((f, i) => (
              <div key={f.fahrer_id} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${scoreBg(f.level)}`}>
                <div className="flex items-center gap-2">
                  <span className="text-base">{i < 3 ? PODIUM[i] : `${i + 1}.`}</span>
                  <div>
                    <div className="font-medium dark:text-white">{f.fahrer_name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{f.touren_heute} Touren · {f.km_je_tour.toFixed(1)} km/Tour</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-bold text-base ${scoreColor(f.level)}`}>{f.routen_score}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {trendIcon(f.trend)} {Math.abs(f.delta_pct).toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>

          {niedrigFahrer.length > 0 && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              <strong>Hinweis:</strong> {niedrigFahrer.map((f) => f.fahrer_name).join(', ')} — {niedrigFahrer[0].hinweis}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

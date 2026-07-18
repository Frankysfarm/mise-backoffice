'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Zap } from 'lucide-react';

type EnergieLevel = 'hoch' | 'mittel' | 'niedrig';

type FahrerEnergie = {
  fahrer_id: string;
  name: string;
  stopps_heute: number;
  schichtstunden: number;
  energie_score: number;
  energie_level: EnergieLevel;
  trend_7tage: number;
};

type ApiData = {
  drivers: FahrerEnergie[];
  team_avg_energie: number;
  team_energie_level: EnergieLevel;
};

function ampelKlasse(level: EnergieLevel): string {
  if (level === 'hoch') return 'text-green-600 dark:text-green-400';
  if (level === 'mittel') return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function ampelBg(level: EnergieLevel): string {
  if (level === 'hoch') return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
  if (level === 'mittel') return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
  return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
}

function ampelDot(level: EnergieLevel): string {
  if (level === 'hoch') return 'bg-green-500';
  if (level === 'mittel') return 'bg-yellow-500';
  return 'bg-red-500';
}

function levelLabel(level: EnergieLevel): string {
  if (level === 'hoch') return 'Hoch';
  if (level === 'mittel') return 'Mittel';
  return 'Niedrig';
}

export function DispatchPhase2227EnergieBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    try {
      const url = locationId
        ? `/api/delivery/admin/fahrer-energie?location_id=${locationId}`
        : '/api/delivery/admin/fahrer-energie';
      const res = await fetch(url);
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

  if (!data) return null;

  const roteFahrer = data.drivers.filter((f) => f.energie_level === 'niedrig');
  const topPerformer = [...data.drivers].sort((a, b) => b.energie_score - a.energie_score)[0];
  const sorted = [...data.drivers].sort((a, b) => b.energie_score - a.energie_score);

  return (
    <div className="rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30 p-4 mb-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-500" />
          <span className="font-semibold text-yellow-900 dark:text-yellow-200">Schicht-Energie-Board</span>
          {roteFahrer.length > 2 && (
            <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {roteFahrer.length} Niedrig
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-yellow-600" /> : <ChevronDown className="w-4 h-4 text-yellow-600" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/40 rounded-lg px-3 py-2">
            <span>Team-Ø Energie</span>
            <span className={`font-bold text-sm ${ampelKlasse(data.team_energie_level)}`}>
              {data.team_avg_energie} Stopps/h — {levelLabel(data.team_energie_level)}
            </span>
          </div>

          {roteFahrer.length > 2 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{roteFahrer.length} Fahrer mit niedrigem Energie-Level — Pause oder Neuplanung empfehlen!</span>
            </div>
          )}

          {sorted.map((f, i) => {
            const trend = f.energie_score - f.trend_7tage;
            return (
              <div key={f.fahrer_id} className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${ampelBg(f.energie_level)}`}>
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${ampelDot(f.energie_level)}`} />
                <span className="text-sm font-medium flex-1 dark:text-white">
                  {f.name}
                  {topPerformer?.fahrer_id === f.fahrer_id && (
                    <span className="ml-1 text-xs bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded-full font-bold">★ Top</span>
                  )}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{f.stopps_heute} Stopps / {f.schichtstunden}h</span>
                <span className={`text-sm font-bold ${ampelKlasse(f.energie_level)}`}>
                  {f.energie_score}/h
                </span>
                <span className={`text-xs ${trend >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                  {trend >= 0 ? '▲' : '▼'}{Math.abs(trend).toFixed(1)}
                </span>
              </div>
            );
          })}

          <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
            Energie-Score = Stopps/h heute. Grün ≥3.0 · Gelb ≥1.5 · Rot &lt;1.5
          </p>
        </div>
      )}
    </div>
  );
}

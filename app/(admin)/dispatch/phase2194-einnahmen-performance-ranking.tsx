'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Euro, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerEinnahmenPerf {
  fahrer_id: string;
  name: string;
  verdienst_eur: number;
  trinkgeld_eur: number;
  touren_heute: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta_eur: number;
  alert: boolean;
  rang: number;
}

interface ApiData {
  fahrer: FahrerEinnahmenPerf[];
  team_durchschnitt_eur: number;
}

function TrendIcon({ trend }: { trend: 'steigend' | 'fallend' | 'stabil' }) {
  if (trend === 'steigend') return <TrendingUp className="w-3 h-3 text-green-500" />;
  if (trend === 'fallend') return <TrendingDown className="w-3 h-3 text-red-500" />;
  return <Minus className="w-3 h-3 text-gray-400" />;
}

function fmt(eur: number) {
  return eur.toFixed(2).replace('.', ',') + ' €';
}

export function DispatchPhase2194EinnahmenPerformanceRanking({
  locationId,
}: {
  locationId: string | null;
}) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    try {
      const url = locationId
        ? `/api/delivery/admin/fahrer-einnahmen-performance?location_id=${locationId}`
        : '/api/delivery/admin/fahrer-einnahmen-performance';
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

  const alertFahrer = data.fahrer.filter((f) => f.alert);
  const sorted = [...data.fahrer].sort((a, b) => b.verdienst_eur - a.verdienst_eur);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <span>Einnahmen-Performance Ranking</span>
        <div className="flex items-center gap-2">
          {alertFahrer.length > 0 && (
            <span className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {alertFahrer.length} Alert
            </span>
          )}
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Euro className="w-3 h-3" />
            Team-Ø {fmt(data.team_durchschnitt_eur)}
          </span>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {alertFahrer.length > 0 && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-xs text-red-700 dark:text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                {alertFahrer.map((f) => f.name).join(', ')} — unter 50% des Team-Ø! Einsatz prüfen.
              </span>
            </div>
          )}

          <div className="space-y-2">
            {sorted.map((f, idx) => {
              const max = sorted[0]?.verdienst_eur || 1;
              const pct = max > 0 ? Math.round((f.verdienst_eur / max) * 100) : 0;
              return (
                <div key={f.fahrer_id} className="rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {idx === 0 && <span className="text-xs text-yellow-500 font-bold">★</span>}
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{f.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <TrendIcon trend={f.trend} />
                      <span className={cn(
                        'text-sm font-bold',
                        f.alert ? 'text-red-600' : f.verdienst_eur >= data.team_durchschnitt_eur ? 'text-green-600' : 'text-yellow-600'
                      )}>
                        {f.verdienst_eur > 0 ? fmt(f.verdienst_eur) : '–'}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mb-1">
                    <div
                      className={cn(
                        'h-1.5 rounded-full transition-all',
                        f.alert ? 'bg-red-500' : idx === 0 ? 'bg-green-500' : 'bg-blue-400'
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Trinkgeld: {fmt(f.trinkgeld_eur)}</span>
                    <span>{f.touren_heute} Touren · Δ {f.trend_delta_eur > 0 ? '+' : ''}{fmt(f.trend_delta_eur)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

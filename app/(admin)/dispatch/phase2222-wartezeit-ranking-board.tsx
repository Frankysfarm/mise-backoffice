'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Clock } from 'lucide-react';

type FahrerWartezeit = {
  fahrer_id: string;
  name: string;
  avg_wartezeit_min: number;
  auftraege_ueber5min: number;
  auftraege_gesamt: number;
  trend_7tage: number;
};

type ApiData = {
  drivers: FahrerWartezeit[];
  team_avg_wartezeit: number;
  location_id: string;
};

function ampelKlasse(min: number): string {
  if (min < 10) return 'text-green-600 dark:text-green-400';
  if (min < 15) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function ampelBg(min: number): string {
  if (min < 10) return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
  if (min < 15) return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
  return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
}

function ampelDot(min: number): string {
  if (min < 10) return 'bg-green-500';
  if (min < 15) return 'bg-yellow-500';
  return 'bg-red-500';
}

export function DispatchPhase2222WartezeitRankingBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    try {
      const url = locationId
        ? `/api/delivery/admin/fahrer-wartezeit?location_id=${locationId}`
        : '/api/delivery/admin/fahrer-wartezeit';
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

  if (!data || !data.drivers.length) return null;

  const sorted = [...data.drivers].sort((a, b) => b.avg_wartezeit_min - a.avg_wartezeit_min);
  const rotFahrer = sorted.filter((f) => f.avg_wartezeit_min >= 15);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden mb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-orange-500" />
          <span>Wartezeit-Ranking</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Ø {data.team_avg_wartezeit} Min. Team</span>
          {rotFahrer.length > 0 && (
            <span className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {rotFahrer.length} Rot
            </span>
          )}
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {rotFahrer.length > 0 && (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-xs text-red-700 dark:text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Lange Wartezeiten:</strong>{' '}
                {rotFahrer.map((f) => `${f.name} (${f.avg_wartezeit_min} Min.)`).join(', ')} —
                Prüfen: Küche-Timing oder Route optimieren?
              </span>
            </div>
          )}

          <div className="space-y-2">
            {sorted.map((f) => {
              const trend = f.avg_wartezeit_min - f.trend_7tage;
              const trendLabel = trend > 0 ? `+${trend.toFixed(1)}` : trend.toFixed(1);
              return (
                <div
                  key={f.fahrer_id}
                  className={`rounded-lg border px-3 py-2 ${ampelBg(f.avg_wartezeit_min)}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${ampelDot(f.avg_wartezeit_min)}`} />
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{f.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {f.auftraege_ueber5min}/{f.auftraege_gesamt} &gt;5 Min.
                      </span>
                      <span className={`text-sm font-bold ${ampelKlasse(f.avg_wartezeit_min)}`}>
                        {f.avg_wartezeit_min} Min.
                      </span>
                      <span className={`text-xs font-medium ${trend > 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {trendLabel}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-xs text-gray-400 dark:text-gray-500 text-right">
            Grün &lt;10 Min. · Gelb &lt;15 Min. · Rot ≥15 Min.
          </div>
        </div>
      )}
    </div>
  );
}

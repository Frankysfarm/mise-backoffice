'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Gauge } from 'lucide-react';

type FahrerTempoHeute = {
  fahrer_id: string;
  fahrer_name: string;
  avg_kmh: number;
  touren_anzahl: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_typ: 'tempoverdacht' | 'stau' | null;
  alert: boolean;
};

type ApiData = {
  fahrer: FahrerTempoHeute[];
  team_avg_kmh: number;
  alert_count: number;
};

function ampelEmoji(a: FahrerTempoHeute['ampel']): string {
  if (a === 'gruen') return '🟢';
  if (a === 'gelb') return '🟡';
  return '🔴';
}

function alertLabel(typ: FahrerTempoHeute['alert_typ']): string {
  if (typ === 'tempoverdacht') return '⚡';
  if (typ === 'stau') return '🚦';
  return '';
}

export function KitchenPhase2320TempoTicker({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-tempo-analyse?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const alertFahrer = useMemo(() => data?.fahrer.filter((f) => f.alert) ?? [], [data]);
  const hasAlert = alertFahrer.length > 0;

  if (!locationId || !data) return null;

  return (
    <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 p-3 mb-3">
      <button
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-orange-500" />
          <span className="font-semibold text-orange-800 dark:text-orange-200 text-sm">
            Tempo-Ticker — Fahrer km/h heute
          </span>
          {hasAlert && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">
              <AlertTriangle className="h-3 w-3" />
              {alertFahrer.length} Alert{alertFahrer.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <span className="text-xs text-orange-500">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {/* Team-Ø */}
          <div className="flex items-center justify-between rounded-lg bg-white dark:bg-gray-800 border border-orange-100 dark:border-orange-900 px-3 py-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">Team-Ø km/h heute</span>
            <span className="font-bold text-orange-700 dark:text-orange-300">{data.team_avg_kmh} km/h</span>
          </div>

          {/* Alert Banner */}
          {hasAlert && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-2.5 text-xs text-red-700 dark:text-red-300">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                {alertFahrer
                  .map((f) => `${f.fahrer_name} (${f.alert_typ === 'tempoverdacht' ? 'Tempo >60' : 'Stau <5 km/h'})`)
                  .join(' · ')}{' '}
                — Dispatcher informieren!
              </span>
            </div>
          )}

          {/* Fahrerliste kompakt */}
          <div className="space-y-1">
            {data.fahrer.map((f) => (
              <div
                key={f.fahrer_id}
                className="flex items-center justify-between rounded bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 px-2.5 py-1.5 text-xs"
              >
                <span className="text-gray-700 dark:text-gray-200">
                  {ampelEmoji(f.ampel)} {alertLabel(f.alert_typ)} {f.fahrer_name}
                </span>
                <span className="font-medium text-gray-600 dark:text-gray-300">
                  {f.avg_kmh} km/h · {f.touren_anzahl} Touren
                </span>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500 text-right">
            Grün 5–50 · Gelb 50–60 · Rot &gt;60 od. &lt;5 km/h · 15-Min-Update
          </p>
        </div>
      )}
    </div>
  );
}

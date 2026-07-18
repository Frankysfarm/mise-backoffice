'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, MapPin } from 'lucide-react';

type FahrerKmHeute = {
  fahrer_id: string;
  fahrer_name: string;
  km_gesamt: number;
  touren_anzahl: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
};

type ApiData = {
  fahrer: FahrerKmHeute[];
  team_avg_km: number;
  alert_count: number;
};

const ALERT_KM = 150;

function ampelEmoji(a: FahrerKmHeute['ampel']): string {
  if (a === 'gruen') return '🟢';
  if (a === 'gelb') return '🟡';
  return '🔴';
}

export function KitchenPhase2315KmTicker({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-km-heute?location_id=${locationId}`);
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

  const alertFahrer = useMemo(() => data?.fahrer.filter((f) => f.alert) ?? [], [data]);
  const hasAlert = alertFahrer.length > 0;

  if (!locationId || !data) return null;

  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-3 mb-3">
      <button
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-blue-500" />
          <span className="font-semibold text-blue-800 dark:text-blue-200 text-sm">
            KM-Ticker — Fahrerstrecken heute
          </span>
          {hasAlert && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">
              <AlertTriangle className="h-3 w-3" />
              {alertFahrer.length} &gt;{ALERT_KM} km
            </span>
          )}
        </div>
        <span className="text-xs text-blue-500">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {/* Team-Ø */}
          <div className="flex items-center justify-between rounded-lg bg-white dark:bg-gray-800 border border-blue-100 dark:border-blue-900 px-3 py-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">Team-Ø km heute</span>
            <span className="font-bold text-blue-700 dark:text-blue-300">{data.team_avg_km} km</span>
          </div>

          {/* Alert Banner */}
          {hasAlert && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-2.5 text-xs text-red-700 dark:text-red-300">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                <strong>{alertFahrer.map((f) => f.fahrer_name).join(', ')}</strong> haben heute
                über {ALERT_KM} km. Dispatcher: Schicht prüfen!
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
                  {ampelEmoji(f.ampel)} {f.fahrer_name}
                </span>
                <span className="font-medium text-gray-600 dark:text-gray-300">
                  {f.km_gesamt} km · {f.touren_anzahl} Touren
                </span>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500 text-right">
            Grün &lt;100 km · Gelb &lt;150 km · Rot ≥150 km · 30-Min-Update
          </p>
        </div>
      )}
    </div>
  );
}

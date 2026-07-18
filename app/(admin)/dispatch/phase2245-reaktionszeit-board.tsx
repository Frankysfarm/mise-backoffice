'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Timer } from 'lucide-react';

type FahrerReaktionszeit = {
  driver_id: string;
  name: string;
  avg_min: number;
  auftraege: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  trend_delta: number;
  alert: boolean;
};

type ApiData = {
  fahrer: FahrerReaktionszeit[];
  team_avg_min: number;
  alert_count: number;
};

function levelFarFahrer(f: FahrerReaktionszeit): 'schnell' | 'mittel' | 'langsam' {
  if (f.avg_min < 3) return 'schnell';
  if (f.avg_min < 6) return 'mittel';
  return 'langsam';
}

function rowBg(level: 'schnell' | 'mittel' | 'langsam'): string {
  if (level === 'schnell') return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
  if (level === 'mittel') return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
  return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
}

function rowText(level: 'schnell' | 'mittel' | 'langsam'): string {
  if (level === 'schnell') return 'text-green-600 dark:text-green-400';
  if (level === 'mittel') return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function trendIcon(trend: FahrerReaktionszeit['trend']): string {
  if (trend === 'besser') return '↓';
  if (trend === 'schlechter') return '↑';
  return '→';
}

function ampelLabel(level: 'schnell' | 'mittel' | 'langsam'): string {
  if (level === 'schnell') return '🟢';
  if (level === 'mittel') return '🟡';
  return '🔴';
}

export function DispatchPhase2245ReactionszeitBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-reaktionszeit?location_id=${locationId}`);
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

  const langsamFahrer = useMemo(() => data?.fahrer.filter((f) => levelFarFahrer(f) === 'langsam') ?? [], [data]);

  if (!locationId || !data) return null;

  const teamLevel = data.team_avg_min < 3 ? 'schnell' : data.team_avg_min < 6 ? 'mittel' : 'langsam';
  const hasAlert = data.alert_count > 0;

  return (
    <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 p-4 mb-3">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-orange-500" />
          <span className="font-semibold text-orange-900 dark:text-orange-200">Reaktionszeit-Board</span>
          {hasAlert && (
            <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {data.alert_count} Fahrer
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-orange-500" /> : <ChevronDown className="w-4 h-4 text-orange-500" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white dark:bg-gray-800 px-3 py-2 text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400">Team-Ø Reaktionszeit</div>
              <div className={`text-xl font-bold ${rowText(teamLevel)}`}>{data.team_avg_min.toFixed(1)} Min.</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 px-3 py-2 text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400">Fahrer mit Alert</div>
              <div className={`text-xl font-bold ${hasAlert ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {data.alert_count}
              </div>
            </div>
          </div>

          {hasAlert && (
            <div className="flex items-center gap-2 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Reaktionszeit kritisch — Fahrer auf Erreichbarkeit prüfen!</span>
            </div>
          )}

          <div className="space-y-1">
            {data.fahrer.map((f) => {
              const level = levelFarFahrer(f);
              return (
                <div key={f.driver_id} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${rowBg(level)}`}>
                  <div className="flex items-center gap-2">
                    <span>{ampelLabel(level)}</span>
                    <div>
                      <div className="font-medium dark:text-white">{f.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{f.auftraege} Aufträge heute</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold text-base ${rowText(level)}`}>{f.avg_min.toFixed(1)} Min.</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {trendIcon(f.trend)} {Math.abs(f.trend_delta).toFixed(1)} Min.
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {langsamFahrer.length > 0 && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              <strong>Dispatcher-Tipp:</strong> {langsamFahrer.map((f) => f.name).join(', ')} — App-Benachrichtigungen prüfen oder anrufen.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

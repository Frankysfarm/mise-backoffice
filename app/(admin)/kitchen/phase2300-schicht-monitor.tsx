'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Clock } from 'lucide-react';

type FahrerSchichtBilanz = {
  fahrer_id: string;
  fahrer_name: string;
  schicht_stunden: number;
  ampel: 'gruen' | 'gelb' | 'rot';
};

type ApiData = {
  fahrer: FahrerSchichtBilanz[];
  team_avg_stunden: number;
  alert_count: number;
};

export function KitchenPhase2300SchichtMonitor({
  locationId,
}: {
  locationId?: string | null;
}) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(
        `/api/delivery/admin/fahrer-schicht-kpi?location_id=${locationId}`
      );
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

  const alertFahrer = useMemo(
    () => data?.fahrer.filter((f) => f.ampel === 'rot') ?? [],
    [data]
  );

  const laengsteSchicht = useMemo(() => {
    if (!data || data.fahrer.length === 0) return null;
    return data.fahrer.reduce(
      (max, f) => (f.schicht_stunden > max.schicht_stunden ? f : max),
      data.fahrer[0]
    );
  }, [data]);

  const hinweis = useMemo(() => {
    if (!data) return '';
    if (data.alert_count > 0)
      return `${data.alert_count} Fahrer über 10h — Dispatcher: bitte Pause anordnen!`;
    if (data.team_avg_stunden >= 8)
      return 'Team nähert sich langen Schichten — auf Pausen achten.';
    return 'Schichtzeiten im grünen Bereich — kein Handlungsbedarf.';
  }, [data]);

  if (!locationId) return null;

  const level = data
    ? data.alert_count > 0
      ? 'schlecht'
      : data.team_avg_stunden >= 8
      ? 'mittel'
      : 'gut'
    : 'mittel';

  const borderFarbe =
    level === 'gut'
      ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30'
      : level === 'mittel'
      ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30'
      : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30';

  const iconFarbe =
    level === 'gut'
      ? 'text-green-500'
      : level === 'mittel'
      ? 'text-amber-500'
      : 'text-red-500';

  const titelFarbe =
    level === 'gut'
      ? 'text-green-900 dark:text-green-200'
      : level === 'mittel'
      ? 'text-amber-900 dark:text-amber-200'
      : 'text-red-900 dark:text-red-200';

  const scoreFarbe =
    level === 'gut'
      ? 'text-green-600 dark:text-green-400'
      : level === 'mittel'
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-red-600 dark:text-red-400';

  return (
    <div className={`rounded-xl border p-4 mb-3 ${borderFarbe}`}>
      <button
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Clock className={`w-4 h-4 ${iconFarbe}`} />
          <span className={`font-semibold text-sm ${titelFarbe}`}>Schicht-Monitor</span>
          {data && (
            <span className={`text-xs font-bold ${scoreFarbe}`}>
              ⏱ Team-Ø {data.team_avg_stunden.toFixed(1)}h
            </span>
          )}
        </div>
        {open ? (
          <ChevronUp className={`w-4 h-4 ${iconFarbe}`} />
        ) : (
          <ChevronDown className={`w-4 h-4 ${iconFarbe}`} />
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {alertFahrer.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>
                <strong>{alertFahrer.length} Fahrer</strong> über 10h:{' '}
                {alertFahrer.map((f) => f.fahrer_name).join(', ')}
              </span>
            </div>
          )}

          {laengsteSchicht && (
            <div className="text-xs text-center rounded-lg bg-white dark:bg-gray-800 border border-amber-100 dark:border-amber-900 p-2">
              <span className="text-gray-500 dark:text-gray-400">Längste Schicht: </span>
              <span className={`font-bold ${scoreFarbe}`}>
                {laengsteSchicht.fahrer_name} ({laengsteSchicht.schicht_stunden.toFixed(1)}h)
              </span>
            </div>
          )}

          {data && (
            <p
              className={`text-xs rounded px-2 py-1 ${
                level === 'schlecht'
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                  : level === 'mittel'
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                  : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              }`}
            >
              {hinweis}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

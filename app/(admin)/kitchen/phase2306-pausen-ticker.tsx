'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Coffee } from 'lucide-react';

type PausenAmpel = 'gruen' | 'gelb' | 'rot';

type FahrerPausenInfo = {
  fahrer_id: string;
  fahrer_name: string;
  letzte_pause_vor_min: number | null;
  ampel: PausenAmpel;
  alert: boolean;
};

type ApiData = {
  fahrer: FahrerPausenInfo[];
  alert_count: number;
};

function formatMin(min: number | null): string {
  if (min === null) return 'Noch keine Pause';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} Min`;
  return `${h}h ${m}m`;
}

export function KitchenPhase2306PausenTicker({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-pausen?location_id=${locationId}`);
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
    () => (data?.fahrer ?? []).filter((f) => f.alert),
    [data],
  );

  const hinweis = useMemo(() => {
    if (!data) return '';
    if (data.alert_count === 0) return 'Alle Fahrer pausieren regelmäßig — kein Handlungsbedarf.';
    if (data.alert_count === 1) return '1 Fahrer ohne ausreichende Pause — Dispatcher informieren.';
    return `${data.alert_count} Fahrer >4h ohne Pause — Dispatcher sollte aktiv eingreifen.`;
  }, [data]);

  if (!locationId) return null;

  const level: PausenAmpel =
    !data || data.alert_count === 0 ? 'gruen' : data.alert_count <= 1 ? 'gelb' : 'rot';

  const borderFarbe =
    level === 'gruen'
      ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30'
      : level === 'gelb'
      ? 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30'
      : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30';

  const iconFarbe =
    level === 'gruen' ? 'text-green-500' : level === 'gelb' ? 'text-orange-500' : 'text-red-500';

  const titelFarbe =
    level === 'gruen'
      ? 'text-green-900 dark:text-green-200'
      : level === 'gelb'
      ? 'text-orange-900 dark:text-orange-200'
      : 'text-red-900 dark:text-red-200';

  const hinweisFarbe =
    level === 'gruen'
      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
      : level === 'gelb'
      ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';

  return (
    <div className={`rounded-xl border p-4 mb-3 ${borderFarbe}`}>
      <button
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Coffee className={`w-4 h-4 ${iconFarbe}`} />
          <span className={`font-semibold text-sm ${titelFarbe}`}>Pausen-Ticker</span>
          {data && (
            <span className={`text-xs font-bold ${iconFarbe}`}>
              {data.alert_count > 0 ? `${data.alert_count} ohne Pause` : 'Alle ok'}
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
                <strong>{alertFahrer.length} Fahrer</strong> &gt;4h ohne Pause:{' '}
                {alertFahrer
                  .map((f) => `${f.fahrer_name} (${formatMin(f.letzte_pause_vor_min)})`)
                  .join(', ')}
              </span>
            </div>
          )}

          {data && (
            <p className={`text-xs rounded px-2 py-1 ${hinweisFarbe}`}>{hinweis}</p>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Navigation } from 'lucide-react';

type DistanzAmpel = 'gruen' | 'gelb' | 'rot';

type FahrerDistanzInfo = {
  fahrer_id: string;
  fahrer_name: string;
  km_heute: number;
  km_h_schnitt: number;
  ampel: DistanzAmpel;
  alert: boolean;
};

type ApiData = {
  fahrer: FahrerDistanzInfo[];
  team_avg_km: number;
  alert_count: number;
};

export function KitchenPhase2311DistanzTicker({ locationId }: { locationId?: string | null }) {
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
    const id = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const alertFahrer = useMemo(
    () => (data?.fahrer ?? []).filter((f) => f.alert),
    [data],
  );

  const hinweis = useMemo(() => {
    if (!data) return '';
    if (data.alert_count === 0) return `Team-Ø ${data.team_avg_km} km — Distanz-Lage unauffällig.`;
    if (data.alert_count === 1) return '1 Fahrer mit Distanz-Alert — Dispatcher informieren.';
    return `${data.alert_count} Fahrer mit Distanz-Anomalie — Dispatcher sollte prüfen.`;
  }, [data]);

  if (!locationId) return null;

  const level: DistanzAmpel =
    !data || data.alert_count === 0 ? 'gruen' : data.alert_count <= 1 ? 'gelb' : 'rot';

  const borderFarbe =
    level === 'gruen'
      ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30'
      : level === 'gelb'
      ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30'
      : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30';

  const iconFarbe =
    level === 'gruen' ? 'text-blue-500' : level === 'gelb' ? 'text-yellow-500' : 'text-red-500';

  const titelFarbe =
    level === 'gruen'
      ? 'text-blue-900 dark:text-blue-200'
      : level === 'gelb'
      ? 'text-yellow-900 dark:text-yellow-200'
      : 'text-red-900 dark:text-red-200';

  const hinweisFarbe =
    level === 'gruen'
      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
      : level === 'gelb'
      ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';

  return (
    <div className={`rounded-xl border p-4 mb-3 ${borderFarbe}`}>
      <button
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Navigation className={`w-4 h-4 ${iconFarbe}`} />
          <span className={`font-semibold text-sm ${titelFarbe}`}>Distanz-Ticker</span>
          {data && (
            <span className={`text-xs font-bold ${iconFarbe}`}>
              {data.alert_count > 0 ? `${data.alert_count} Alerts` : `Ø ${data.team_avg_km} km`}
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
                <strong>{alertFahrer.length} Fahrer</strong> mit Distanz-Alert:{' '}
                {alertFahrer
                  .map((f) => `${f.fahrer_name} (${f.km_heute} km, ${f.km_h_schnitt} km/h)`)
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

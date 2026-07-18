'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Timer } from 'lucide-react';

type FahrerReaktionszeit = {
  driver_id: string;
  name: string;
  avg_min: number;
  auftraege: number;
  alert: boolean;
};

type ApiData = {
  fahrer: FahrerReaktionszeit[];
  team_avg_min: number;
  alert_count: number;
};

export function KitchenPhase2248ReaktionszeitTicker({ locationId }: { locationId?: string | null }) {
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
    const id = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const alertFahrer = useMemo(() => data?.fahrer.filter((f) => f.alert) ?? [], [data]);

  const hinweis = useMemo(() => {
    if (!data) return '';
    if (data.team_avg_min > 10) return 'Reaktionszeit kritisch — Dispatcher informieren!';
    if (data.team_avg_min > 6) return 'Reaktionszeit erhöht — Fahrer auf Erreichbarkeit prüfen.';
    return 'Reaktionszeit gut — keine Maßnahmen erforderlich.';
  }, [data]);

  if (!locationId) return null;

  const level = data ? (data.team_avg_min < 3 ? 'schnell' : data.team_avg_min < 6 ? 'mittel' : 'langsam') : 'mittel';
  const borderFarbe = level === 'schnell'
    ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30'
    : level === 'mittel'
    ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30'
    : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30';
  const iconFarbe = level === 'schnell' ? 'text-green-500' : level === 'mittel' ? 'text-yellow-500' : 'text-red-500';
  const titelFarbe = level === 'schnell' ? 'text-green-900 dark:text-green-200' : level === 'mittel' ? 'text-yellow-900 dark:text-yellow-200' : 'text-red-900 dark:text-red-200';
  const scoreFarbe = level === 'schnell' ? 'text-green-600 dark:text-green-400' : level === 'mittel' ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400';

  return (
    <div className={`rounded-xl border ${borderFarbe} p-4 mb-3`}>
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className={`w-4 h-4 ${iconFarbe}`} />
          <span className={`font-semibold ${titelFarbe}`}>Reaktionszeit-Ticker</span>
          {data && data.alert_count > 0 && (
            <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {data.alert_count} Alert
            </span>
          )}
        </div>
        {open ? <ChevronUp className={`w-4 h-4 ${iconFarbe}`} /> : <ChevronDown className={`w-4 h-4 ${iconFarbe}`} />}
      </button>

      {open && data && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between rounded-lg bg-white dark:bg-gray-800 px-3 py-2 text-sm">
            <span className="text-gray-600 dark:text-gray-400">Team-Ø Reaktionszeit</span>
            <span className={`font-bold ${scoreFarbe}`}>{data.team_avg_min.toFixed(1)} Min.</span>
          </div>

          {data.alert_count > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{hinweis}</span>
            </div>
          )}

          {data.alert_count === 0 && (
            <p className="text-xs text-center px-1 py-1">
              <span className={scoreFarbe}>💡 {hinweis}</span>
            </p>
          )}

          {alertFahrer.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-gray-500 dark:text-gray-400 px-1">Fahrer mit langer Reaktionszeit:</p>
              {alertFahrer.map((f) => (
                <div key={f.driver_id} className="flex items-center justify-between rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-1.5 text-sm">
                  <span className="dark:text-white">{f.name}</span>
                  <span className="text-red-500 text-xs font-semibold">{f.avg_min.toFixed(1)} Min. · {f.auftraege} Auftr.</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {open && !data && (
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500 text-center">Lade Reaktionszeit-Daten…</p>
      )}
    </div>
  );
}

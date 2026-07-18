'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Star } from 'lucide-react';

type FahrerBewertung = {
  fahrer_id: string;
  fahrer_name: string;
  bewertung_avg: number;
  ampel: 'gruen' | 'gelb' | 'rot';
};

type ApiData = {
  fahrer: FahrerBewertung[];
  team_durchschnitt: number;
  alert_count: number;
};

export function KitchenPhase2258BewertungsTicker({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-kundenbewertung?location_id=${locationId}`);
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

  const alertFahrer = useMemo(() => data?.fahrer.filter((f) => f.ampel === 'rot') ?? [], [data]);

  const hinweis = useMemo(() => {
    if (!data) return '';
    if (data.team_durchschnitt < 3.5) return 'Kundenbewertung kritisch — Dispatcher sofort informieren!';
    if (data.team_durchschnitt < 4.0) return 'Bewertung unter Ziel — Dispatcher auf Problemfälle hinweisen.';
    return 'Kundenbewertung gut — kein Handlungsbedarf.';
  }, [data]);

  if (!locationId) return null;

  const level = data
    ? data.team_durchschnitt >= 4.5 ? 'gut' : data.team_durchschnitt >= 4.0 ? 'mittel' : 'schlecht'
    : 'mittel';

  const borderFarbe =
    level === 'gut'
      ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30'
      : level === 'mittel'
      ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30'
      : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30';

  const iconFarbe =
    level === 'gut' ? 'text-green-500' : level === 'mittel' ? 'text-yellow-500' : 'text-red-500';

  const titelFarbe =
    level === 'gut'
      ? 'text-green-900 dark:text-green-200'
      : level === 'mittel'
      ? 'text-yellow-900 dark:text-yellow-200'
      : 'text-red-900 dark:text-red-200';

  const scoreFarbe =
    level === 'gut'
      ? 'text-green-600 dark:text-green-400'
      : level === 'mittel'
      ? 'text-yellow-600 dark:text-yellow-400'
      : 'text-red-600 dark:text-red-400';

  return (
    <div className={`rounded-xl border p-4 mb-3 ${borderFarbe}`}>
      <button
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Star className={`w-4 h-4 ${iconFarbe}`} />
          <span className={`font-semibold text-sm ${titelFarbe}`}>Bewertungs-Ticker</span>
          {data && (
            <span className={`text-xs font-bold ${scoreFarbe}`}>
              ⭐ {data.team_durchschnitt.toFixed(1)}
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
                <strong>{alertFahrer.length} Fahrer</strong> unter 4.0 Sterne:{' '}
                {alertFahrer.map((f) => f.fahrer_name).join(', ')}
              </span>
            </div>
          )}

          {data && (
            <p
              className={`text-xs rounded px-2 py-1 ${
                level === 'schlecht'
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                  : level === 'mittel'
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
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

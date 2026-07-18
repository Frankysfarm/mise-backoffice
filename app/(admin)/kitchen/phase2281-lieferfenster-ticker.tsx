'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Clock } from 'lucide-react';

type FahrerLieferfenster = {
  fahrer_id: string;
  fahrer_name: string;
  quote_pct: number;
  lieferungen_heute: number;
  ampel: 'gruen' | 'gelb' | 'rot';
};

type ApiData = {
  fahrer: FahrerLieferfenster[];
  team_quote: number;
  alert_count: number;
};

export function KitchenPhase2281LieferfensterTicker({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-lieferfenster?location_id=${locationId}`);
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
    if (data.team_quote < 70) return 'Lieferfenster kritisch — Dispatcher sofort informieren!';
    if (data.team_quote < 80) return 'Quote unter Ziel — Küchen-Timing und Routenwahl optimieren.';
    return 'Lieferfenster-Quote gut — kein Handlungsbedarf.';
  }, [data]);

  if (!locationId) return null;

  const level = data
    ? data.team_quote >= 95 ? 'gut' : data.team_quote >= 80 ? 'mittel' : 'schlecht'
    : 'mittel';

  const borderFarbe =
    level === 'gut'
      ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30'
      : level === 'mittel'
      ? 'border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/30'
      : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30';

  const iconFarbe =
    level === 'gut' ? 'text-green-500' : level === 'mittel' ? 'text-cyan-500' : 'text-red-500';

  const titelFarbe =
    level === 'gut'
      ? 'text-green-900 dark:text-green-200'
      : level === 'mittel'
      ? 'text-cyan-900 dark:text-cyan-200'
      : 'text-red-900 dark:text-red-200';

  const scoreFarbe =
    level === 'gut'
      ? 'text-green-600 dark:text-green-400'
      : level === 'mittel'
      ? 'text-cyan-600 dark:text-cyan-400'
      : 'text-red-600 dark:text-red-400';

  return (
    <div className={`rounded-xl border p-4 mb-3 ${borderFarbe}`}>
      <button
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Clock className={`w-4 h-4 ${iconFarbe}`} />
          <span className={`font-semibold text-sm ${titelFarbe}`}>Lieferfenster-Ticker</span>
          {data && (
            <span className={`text-xs font-bold ${scoreFarbe}`}>
              {data.team_quote.toFixed(1)}% im Fenster
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
                <strong>{alertFahrer.length} Fahrer</strong> unter 80%:{' '}
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
                  ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300'
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

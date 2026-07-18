'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Gauge } from 'lucide-react';

type FahrerEffizienz = {
  fahrer_id: string;
  fahrer_name: string;
  touren_heute: number;
  touren_pro_std: number;
  ampel: 'gruen' | 'gelb' | 'rot';
};

type ApiData = {
  fahrer: FahrerEffizienz[];
  team_avg_touren_pro_std: number;
  alert_count: number;
};

export function KitchenPhase2273EffizienzTicker({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-tour-effizienz?location_id=${locationId}`);
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
    if (data.team_avg_touren_pro_std < 1) return 'Tour-Effizienz kritisch — Dispatcher sofort informieren!';
    if (data.team_avg_touren_pro_std < 1.5) return 'Effizienz unter Ziel — Dispatcher auf Engpässe hinweisen.';
    if (data.team_avg_touren_pro_std < 2) return 'Effizienz ausreichend — Optimierungspotenzial vorhanden.';
    return 'Tour-Effizienz gut — kein Handlungsbedarf.';
  }, [data]);

  if (!locationId) return null;

  const level = data
    ? data.team_avg_touren_pro_std >= 2 ? 'gut' : data.team_avg_touren_pro_std >= 1.5 ? 'mittel' : 'schlecht'
    : 'mittel';

  const borderFarbe =
    level === 'gut'
      ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30'
      : level === 'mittel'
      ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30'
      : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30';

  const iconFarbe = level === 'gut' ? 'text-green-500' : level === 'mittel' ? 'text-yellow-500' : 'text-red-500';
  const titelFarbe =
    level === 'gut' ? 'text-green-900 dark:text-green-200' : level === 'mittel' ? 'text-yellow-900 dark:text-yellow-200' : 'text-red-900 dark:text-red-200';
  const scoreFarbe =
    level === 'gut' ? 'text-green-600 dark:text-green-400' : level === 'mittel' ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400';

  return (
    <div className={`rounded-xl border p-4 mb-3 ${borderFarbe}`}>
      <button className="w-full flex items-center justify-between gap-2" onClick={() => setOpen((v) => !v)}>
        <div className="flex items-center gap-2">
          <Gauge className={`w-4 h-4 ${iconFarbe}`} />
          <span className={`font-semibold text-sm ${titelFarbe}`}>Effizienz-Ticker</span>
          {data && (
            <span className={`text-xs font-bold ${scoreFarbe}`}>
              Ø {data.team_avg_touren_pro_std.toFixed(2)}/Std
            </span>
          )}
        </div>
        {open ? <ChevronUp className={`w-4 h-4 ${iconFarbe}`} /> : <ChevronDown className={`w-4 h-4 ${iconFarbe}`} />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {data ? (
            <>
              {/* Alert-Banner */}
              {alertFahrer.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 p-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-red-700 dark:text-red-300">
                    <strong>{alertFahrer.length} Fahrer unter 1,5/Std — Dispatcher informieren:</strong>{' '}
                    {alertFahrer.map((f) => f.fahrer_name).join(', ')}
                  </div>
                </div>
              )}

              {/* Hinweis */}
              <p className="text-xs text-gray-600 dark:text-gray-400 italic">{hinweis}</p>

              {/* Fahrerliste */}
              <div className="space-y-1">
                {data.fahrer.map((f) => {
                  const barPct = Math.min(100, (f.touren_pro_std / 3) * 100);
                  const barColor =
                    f.ampel === 'gruen' ? 'bg-green-500' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-500';
                  return (
                    <div key={f.fahrer_id} className="flex items-center gap-2">
                      <span className="text-xs text-gray-700 dark:text-gray-300 w-24 truncate shrink-0">{f.fahrer_name}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barPct.toFixed(0)}%` }} />
                      </div>
                      <span className={`text-xs font-medium w-12 text-right shrink-0 ${f.ampel === 'gruen' ? 'text-green-600 dark:text-green-400' : f.ampel === 'gelb' ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                        {f.touren_pro_std.toFixed(2)}/Std
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">Lade Daten…</div>
          )}
        </div>
      )}
    </div>
  );
}

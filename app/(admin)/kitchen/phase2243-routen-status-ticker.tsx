'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Route } from 'lucide-react';

type FahrerRoutenScore = {
  fahrer_id: string;
  fahrer_name: string;
  routen_score: number;
  km_je_tour: number;
  level: 'hoch' | 'mittel' | 'niedrig';
  hinweis: string;
};

type ApiData = {
  fahrer: FahrerRoutenScore[];
  team_ø_score: number;
  team_ø_km_je_tour: number;
  alert: boolean;
};

export function KitchenPhase2243RoutenStatusTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-routen-score?location_id=${locationId}`);
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

  const niedrigFahrer = useMemo(() => data?.fahrer.filter((f) => f.level === 'niedrig') ?? [], [data]);

  const empfehlung = useMemo(() => {
    if (!data) return '';
    if (data.team_ø_score < 45) return 'Tourenplanung sofort überprüfen — Routen ineffizient!';
    if (data.team_ø_score < 70) return 'Touren-Optimierung empfohlen — Zonen prüfen.';
    return 'Routen-Effizienz gut — keine Maßnahmen erforderlich.';
  }, [data]);

  if (!locationId) return null;

  const level = data ? (data.team_ø_score >= 70 ? 'hoch' : data.team_ø_score >= 45 ? 'mittel' : 'niedrig') : 'mittel';
  const borderFarbe = level === 'hoch'
    ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30'
    : level === 'mittel'
    ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30'
    : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30';
  const iconFarbe = level === 'hoch' ? 'text-green-500' : level === 'mittel' ? 'text-yellow-500' : 'text-red-500';
  const titelFarbe = level === 'hoch' ? 'text-green-900 dark:text-green-200' : level === 'mittel' ? 'text-yellow-900 dark:text-yellow-200' : 'text-red-900 dark:text-red-200';
  const scoreFarbe = level === 'hoch' ? 'text-green-600 dark:text-green-400' : level === 'mittel' ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400';

  return (
    <div className={`rounded-xl border ${borderFarbe} p-4 mb-3`}>
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <Route className={`w-4 h-4 ${iconFarbe}`} />
          <span className={`font-semibold ${titelFarbe}`}>Routen-Status-Ticker</span>
          {data?.alert && (
            <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Routen-Alert
            </span>
          )}
        </div>
        {open ? <ChevronUp className={`w-4 h-4 ${iconFarbe}`} /> : <ChevronDown className={`w-4 h-4 ${iconFarbe}`} />}
      </button>

      {open && data && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between rounded-lg bg-white dark:bg-gray-800 px-3 py-2 text-sm">
            <span className="text-gray-600 dark:text-gray-400">Team Routen-Score Ø</span>
            <span className={`font-bold ${scoreFarbe}`}>
              {data.team_ø_score} — {data.team_ø_km_je_tour.toFixed(1)} km/Tour
            </span>
          </div>

          {data.alert && (
            <div className="flex items-center gap-2 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{empfehlung}</span>
            </div>
          )}

          {!data.alert && (
            <p className="text-xs text-center px-1 py-1" style={{ color: level === 'hoch' ? undefined : undefined }}>
              <span className={scoreFarbe}>💡 {empfehlung}</span>
            </p>
          )}

          {niedrigFahrer.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-gray-500 dark:text-gray-400 px-1">Fahrer mit ineffizienten Routen:</p>
              {niedrigFahrer.map((f) => (
                <div key={f.fahrer_id} className="flex items-center justify-between rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-1.5 text-sm">
                  <span className="dark:text-white">{f.fahrer_name}</span>
                  <span className="text-red-500 text-xs font-semibold">Score {f.routen_score} · {f.km_je_tour.toFixed(1)} km/Tour</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {open && !data && (
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500 text-center">Lade Routen-Daten…</p>
      )}
    </div>
  );
}

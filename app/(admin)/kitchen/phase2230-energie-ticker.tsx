'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Zap } from 'lucide-react';

type EnergieLevel = 'hoch' | 'mittel' | 'niedrig';

type FahrerEnergie = {
  fahrer_id: string;
  name: string;
  energie_score: number;
  energie_level: EnergieLevel;
};

type ApiData = {
  drivers: FahrerEnergie[];
  team_avg_energie: number;
  team_energie_level: EnergieLevel;
};

export function KitchenPhase2230EnergieTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-energie?location_id=${locationId}`);
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

  const niedrigFahrer = useMemo(
    () => (data?.drivers ?? []).filter((f) => f.energie_level === 'niedrig'),
    [data],
  );

  const teamLevel = useMemo(() => data?.team_energie_level ?? 'hoch', [data]);
  const teamAvg = useMemo(() => data?.team_avg_energie ?? 0, [data]);

  if (!locationId) return null;

  const borderFarbe = teamLevel === 'niedrig'
    ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30'
    : teamLevel === 'mittel'
    ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30'
    : 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30';

  const iconFarbe = teamLevel === 'niedrig' ? 'text-red-500' : teamLevel === 'mittel' ? 'text-yellow-500' : 'text-green-500';
  const titelFarbe = teamLevel === 'niedrig' ? 'text-red-900 dark:text-red-200' : teamLevel === 'mittel' ? 'text-yellow-900 dark:text-yellow-200' : 'text-green-900 dark:text-green-200';

  return (
    <div className={`rounded-xl border ${borderFarbe} p-4 mb-3`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Zap className={`w-4 h-4 ${iconFarbe}`} />
          <span className={`font-semibold ${titelFarbe}`}>Team-Energie-Ticker</span>
          {teamLevel === 'niedrig' && (
            <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Energie niedrig
            </span>
          )}
        </div>
        {open ? <ChevronUp className={`w-4 h-4 ${iconFarbe}`} /> : <ChevronDown className={`w-4 h-4 ${iconFarbe}`} />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between rounded-lg bg-white dark:bg-gray-800 px-3 py-2 text-sm">
            <span className="text-gray-600 dark:text-gray-400">Team-Ø Energie</span>
            <span className={`font-bold ${iconFarbe}`}>
              {teamAvg} Stopps/h —{' '}
              {teamLevel === 'hoch' ? 'Hoch ✅' : teamLevel === 'mittel' ? 'Mittel ⚠️' : 'Niedrig 🔴'}
            </span>
          </div>

          {teamLevel === 'niedrig' && (
            <div className="flex items-center gap-2 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Team-Energie niedrig — Küche: Tempo anpassen &amp; Pausen koordinieren!</span>
            </div>
          )}

          {niedrigFahrer.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-gray-500 dark:text-gray-400 px-1">Fahrer mit niedrigem Energie-Level:</p>
              {niedrigFahrer.map((f) => (
                <div key={f.fahrer_id} className="flex items-center justify-between rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-1.5 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                    <span className="dark:text-white">{f.name}</span>
                  </div>
                  <span className="text-red-600 dark:text-red-400 font-bold">{f.energie_score}/h</span>
                </div>
              ))}
              <p className="text-xs text-gray-500 dark:text-gray-400 px-1 pt-1">
                💡 Pause empfehlen oder Aufträge anders verteilen.
              </p>
            </div>
          )}

          {teamLevel !== 'niedrig' && niedrigFahrer.length === 0 && (
            <p className="text-xs text-green-600 dark:text-green-400 text-center py-1">
              ✅ Alle Fahrer aktiv und energiegeladen!
            </p>
          )}
        </div>
      )}
    </div>
  );
}

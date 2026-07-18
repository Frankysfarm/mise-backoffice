'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Activity } from 'lucide-react';

type FahrerBilanz = {
  fahrer_id: string;
  fahrer_name: string;
  einnahmen_eur: number;
  stopps_heute: number;
};

type ApiData = {
  fahrer: FahrerBilanz[];
  gesamt_stopps: number;
  aktive_fahrer: number;
};

export function KitchenPhase2235SchichtAuslastungsTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-schicht-bilanz?location_id=${locationId}`);
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

  const teamScore = useMemo(() => {
    if (!data?.fahrer?.length) return 0;
    const avgStopps = data.fahrer.reduce((s, f) => s + f.stopps_heute, 0) / data.fahrer.length;
    const avgEinnahmen = data.fahrer.reduce((s, f) => s + f.einnahmen_eur, 0) / data.fahrer.length;
    const scores = data.fahrer.map((f) => {
      const sR = avgStopps > 0 ? Math.min(2, f.stopps_heute / avgStopps) : 0;
      const eR = avgEinnahmen > 0 ? Math.min(2, f.einnahmen_eur / avgEinnahmen) : 0;
      return Math.round(((sR + eR) / 4) * 100);
    });
    return Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
  }, [data]);

  const unterausgelastet = useMemo(() => {
    if (!data?.fahrer?.length) return [];
    const avgStopps = data.fahrer.reduce((s, f) => s + f.stopps_heute, 0) / data.fahrer.length;
    const avgEinnahmen = data.fahrer.reduce((s, f) => s + f.einnahmen_eur, 0) / data.fahrer.length;
    return data.fahrer.filter((f) => {
      const sR = avgStopps > 0 ? Math.min(2, f.stopps_heute / avgStopps) : 0;
      const eR = avgEinnahmen > 0 ? Math.min(2, f.einnahmen_eur / avgEinnahmen) : 0;
      return Math.round(((sR + eR) / 4) * 100) < 45;
    });
  }, [data]);

  if (!locationId) return null;

  const borderFarbe = teamScore < 45
    ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30'
    : teamScore < 70
    ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30'
    : 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30';

  const iconFarbe = teamScore < 45 ? 'text-red-500' : teamScore < 70 ? 'text-yellow-500' : 'text-green-500';
  const titelFarbe = teamScore < 45 ? 'text-red-900 dark:text-red-200' : teamScore < 70 ? 'text-yellow-900 dark:text-yellow-200' : 'text-green-900 dark:text-green-200';
  const scoreFarbe = teamScore < 45 ? 'text-red-600 dark:text-red-400' : teamScore < 70 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400';

  return (
    <div className={`rounded-xl border ${borderFarbe} p-4 mb-3`}>
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className={`w-4 h-4 ${iconFarbe}`} />
          <span className={`font-semibold ${titelFarbe}`}>Schicht-Auslastungs-Ticker</span>
          {teamScore < 45 && (
            <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Unterauslastung
            </span>
          )}
        </div>
        {open ? <ChevronUp className={`w-4 h-4 ${iconFarbe}`} /> : <ChevronDown className={`w-4 h-4 ${iconFarbe}`} />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between rounded-lg bg-white dark:bg-gray-800 px-3 py-2 text-sm">
            <span className="text-gray-600 dark:text-gray-400">Team Schicht-Score Ø</span>
            <span className={`font-bold ${scoreFarbe}`}>
              {teamScore} % — {teamScore >= 70 ? 'Gut ✅' : teamScore >= 45 ? 'Mittel ⚠️' : 'Schwach 🔴'}
            </span>
          </div>

          {teamScore < 45 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Team unterausgelastet — Dispatcher informieren und Tourenplanung prüfen!</span>
            </div>
          )}

          {unterausgelastet.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-gray-500 dark:text-gray-400 px-1">Fahrer mit schwachem Score:</p>
              {unterausgelastet.map((f) => (
                <div key={f.fahrer_id} className="flex items-center justify-between rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-1.5 text-sm">
                  <span className="dark:text-white">{f.fahrer_name}</span>
                  <span className="text-gray-500 dark:text-gray-400 text-xs">{f.stopps_heute} Touren · {f.einnahmen_eur.toFixed(0)} €</span>
                </div>
              ))}
              <p className="text-xs text-gray-500 dark:text-gray-400 px-1 pt-1">
                💡 Neue Bestellungen priorisiert zuweisen.
              </p>
            </div>
          )}

          {teamScore >= 70 && unterausgelastet.length === 0 && (
            <p className="text-xs text-green-600 dark:text-green-400 text-center py-1">
              ✅ Team voll ausgelastet — starke Schicht!
            </p>
          )}
        </div>
      )}
    </div>
  );
}

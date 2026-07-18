'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, BarChart2 } from 'lucide-react';

type FahrerBilanz = {
  fahrer_id: string;
  fahrer_name: string;
  status: 'aktiv' | 'pause' | 'offline';
  einnahmen_eur: number;
  stopps_heute: number;
  bewertung_avg: number | null;
};

type ApiData = {
  fahrer: FahrerBilanz[];
  gesamt_stopps: number;
  aktive_fahrer: number;
};

function computeScore(f: FahrerBilanz, avgStopps: number, avgEinnahmen: number): number {
  const stoppsRatio = avgStopps > 0 ? Math.min(2, f.stopps_heute / avgStopps) : 0;
  const einnahmenRatio = avgEinnahmen > 0 ? Math.min(2, f.einnahmen_eur / avgEinnahmen) : 0;
  return Math.round(((stoppsRatio + einnahmenRatio) / 4) * 100);
}

function scoreFarbe(score: number): string {
  if (score >= 70) return 'text-green-600 dark:text-green-400';
  if (score >= 45) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function scoreBg(score: number): string {
  if (score >= 70) return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
  if (score >= 45) return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
  return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
}

const PODIUM_BADGE = ['🥇', '🥈', '🥉'];

export function DispatchPhase2236SchichtBilanzUebersicht({ locationId }: { locationId: string | null }) {
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
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const ranked = useMemo(() => {
    if (!data?.fahrer?.length) return [];
    const avgStopps = data.fahrer.reduce((s, f) => s + f.stopps_heute, 0) / data.fahrer.length;
    const avgEinnahmen = data.fahrer.reduce((s, f) => s + f.einnahmen_eur, 0) / data.fahrer.length;
    return [...data.fahrer]
      .map((f) => ({ ...f, score: computeScore(f, avgStopps, avgEinnahmen) }))
      .sort((a, b) => b.score - a.score);
  }, [data]);

  const schwachFahrer = useMemo(() => ranked.filter((f) => f.score < 45), [ranked]);

  if (!locationId || !data) return null;

  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4 mb-3">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-blue-500" />
          <span className="font-semibold text-blue-900 dark:text-blue-200">Schicht-Bilanz-Übersicht</span>
          {schwachFahrer.length > 0 && (
            <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {schwachFahrer.length} Schwach
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-blue-600" /> : <ChevronDown className="w-4 h-4 text-blue-600" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {schwachFahrer.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{schwachFahrer.length} Fahrer unter 45 % Schicht-Score — Überprüfung empfohlen.</span>
            </div>
          )}

          {ranked.slice(0, 3).length > 0 && (
            <div className="grid grid-cols-3 gap-1.5 mb-1">
              {ranked.slice(0, 3).map((f, i) => (
                <div key={f.fahrer_id} className="rounded-lg bg-white dark:bg-gray-800 border border-blue-100 dark:border-blue-900 px-2 py-1.5 text-center">
                  <div className="text-base">{PODIUM_BADGE[i]}</div>
                  <div className="text-xs font-semibold text-gray-800 dark:text-white truncate">{f.fahrer_name.split(' ')[0]}</div>
                  <div className={`text-sm font-black ${scoreFarbe(f.score)}`}>{f.score}%</div>
                </div>
              ))}
            </div>
          )}

          {ranked.map((f) => (
            <div key={f.fahrer_id} className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${scoreBg(f.score)}`}>
              <span className="text-sm font-medium flex-1 dark:text-white">{f.fahrer_name}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{f.stopps_heute} Touren · {f.einnahmen_eur.toFixed(0)} €</span>
              <span className={`text-sm font-bold ${scoreFarbe(f.score)}`}>{f.score}%</span>
            </div>
          ))}

          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            Schicht-Score aus Touren + Umsatz vs. Team-Ø. Grün ≥70 · Gelb ≥45 · Rot &lt;45
          </p>
        </div>
      )}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';

type FahrerBilanz = {
  fahrer_id: string;
  fahrer_name: string;
  einnahmen_eur: number;
  stopps_heute: number;
  bewertung_avg: number | null;
};

type ApiData = {
  fahrer: FahrerBilanz[];
};

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

function motivationsTipp(score: number): string {
  if (score >= 70) return 'Starke Schicht! Du bist im Top-Bereich — weiter so! 🏆';
  if (score >= 45) return 'Solide Leistung. Noch ein paar Touren und du knackst den Top-Score.';
  return 'Heute noch nicht ganz auf Betriebstemperatur — bleib dran, du schaffst mehr!';
}

function scoreFarbe(score: number): string {
  if (score >= 70) return 'text-green-600 dark:text-green-400';
  if (score >= 45) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function balkenFarbe(score: number): string {
  if (score >= 70) return 'bg-green-500';
  if (score >= 45) return 'bg-yellow-500';
  return 'bg-red-500';
}

export function FahrerPhase2237MeineSchichtBilanz({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(false);

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
    if (!isOnline) return;
    load();
    const id = setInterval(load, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [isOnline, load]);

  if (!isOnline || !locationId || !data) return null;

  const ich = data.fahrer.find((f) => f.fahrer_id === driverId) ?? null;
  const avgStopps = data.fahrer.length > 0 ? data.fahrer.reduce((s, f) => s + f.stopps_heute, 0) / data.fahrer.length : 1;
  const avgEinnahmen = data.fahrer.length > 0 ? data.fahrer.reduce((s, f) => s + f.einnahmen_eur, 0) / data.fahrer.length : 1;

  const meineStopps = ich?.stopps_heute ?? 0;
  const meineEinnahmen = ich?.einnahmen_eur ?? 0;
  const stoppsRatio = avgStopps > 0 ? Math.min(2, meineStopps / avgStopps) : 0;
  const einnahmenRatio = avgEinnahmen > 0 ? Math.min(2, meineEinnahmen / avgEinnahmen) : 0;
  const score = Math.round(((stoppsRatio + einnahmenRatio) / 4) * 100);

  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4 mb-3">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-500" />
          <span className="font-semibold text-blue-900 dark:text-blue-200">Meine Schicht-Bilanz</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-blue-600" /> : <ChevronDown className="w-4 h-4 text-blue-600" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="text-center">
            <div className={`text-4xl font-black ${scoreFarbe(score)}`}>{score}<span className="text-lg font-normal">%</span></div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Schicht-Score</div>
          </div>

          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div className={`${balkenFarbe(score)} h-2.5 rounded-full transition-all`} style={{ width: `${score}%` }} />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-2 text-center">
              <div className="text-gray-500 dark:text-gray-400">Touren heute</div>
              <div className="font-bold text-gray-800 dark:text-white text-base">{meineStopps}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-2 text-center">
              <div className="text-gray-500 dark:text-gray-400">Umsatz heute</div>
              <div className="font-bold text-gray-800 dark:text-white text-base">{meineEinnahmen.toFixed(0)} €</div>
            </div>
          </div>

          {ich?.bewertung_avg != null && (
            <div className="bg-white dark:bg-gray-800 rounded-lg px-3 py-2 text-sm flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Ø Bewertung</span>
              <span className="font-bold text-yellow-600 dark:text-yellow-400">★ {ich.bewertung_avg.toFixed(1)}</span>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
            <span>💡</span>
            <span>{motivationsTipp(score)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

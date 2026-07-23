'use client';

import { useState, useEffect, useCallback } from 'react';
import { RotateCcw, TrendingDown } from 'lucide-react';

interface FahrerRetourQuote {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  retour_quote_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_top: boolean;
}

interface ApiData {
  fahrer: FahrerRetourQuote[];
  team_avg: number;
  gesamt: number;
}

const COACHING: Record<string, string> = {
  gruen: 'Ausgezeichnet! Deine Retour-Quote ist sehr niedrig — weiter so!',
  gelb:  'Solide! Überprüfe bei Retouren ob Kommunikation mit Kunden verbessert werden kann.',
  rot:   'Deine Retour-Quote ist hoch. Bitte mit Dispatch die Ursachen besprechen.',
};

const AMPEL_COLORS: Record<string, string> = {
  gruen: 'text-emerald-600 dark:text-emerald-400',
  gelb:  'text-yellow-600 dark:text-yellow-400',
  rot:   'text-red-600 dark:text-red-400',
};

export function FahrerPhase3493MeineRetourQuote({
  driverId,
  isOnline,
}: {
  driverId: string;
  isOnline: boolean;
}) {
  const [data, setData] = useState<ApiData | null>(null);

  const load = useCallback(async () => {
    if (!isOnline) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-retour-quote?location_id=mock&driver_id=${driverId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch {
      setData(null);
    }
  }, [driverId, isOnline]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline) return null;

  const me = data?.fahrer?.[0];
  if (!me) return null;

  const teamAvg = data?.team_avg ?? 0;
  const gesamt = data?.gesamt ?? 1;
  const barPct = gesamt > 1 ? Math.round(((gesamt - me.rang) / (gesamt - 1)) * 100) : 100;

  return (
    <div className="border rounded-xl bg-white dark:bg-gray-900 shadow-sm mb-3 p-3">
      <div className="flex items-center gap-2 mb-3">
        <RotateCcw className="w-4 h-4 text-orange-500" />
        <span className="font-semibold text-sm">Meine Retour-Quote</span>
      </div>

      {/* Hauptwert */}
      <div className="text-center mb-3">
        <div className={`text-5xl font-black tabular-nums ${AMPEL_COLORS[me.ampel]}`}>
          {me.retour_quote_pct}%
        </div>
        <div className="text-xs text-gray-400 mt-0.5">Retour-Quote (letzte 30 Tage)</div>
        <div className={`text-3xl font-bold tabular-nums mt-1 ${AMPEL_COLORS[me.ampel]}`}>
          Rang #{me.rang}
        </div>
      </div>

      {/* Rang-Balken */}
      <div className="mb-3">
        <div className="flex justify-between text-[9px] text-gray-400 mb-1">
          <span>Höchste Quote</span>
          <span>Niedrigste Quote</span>
        </div>
        <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              me.ampel === 'gruen' ? 'bg-emerald-500' : me.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-500'
            }`}
            style={{ width: `${barPct}%` }}
          />
        </div>
      </div>

      {/* Meta */}
      <div className="flex justify-between text-xs text-gray-500 mb-3">
        <span>
          Delta:{' '}
          <span className={me.rank_delta < 0 ? 'text-emerald-600 font-bold' : me.rank_delta > 0 ? 'text-red-500 font-bold' : 'text-gray-400'}>
            {me.rank_delta < 0 ? `▲${Math.abs(me.rank_delta)}` : me.rank_delta > 0 ? `▼${me.rank_delta}` : '—'}
          </span>
        </span>
        <span>Team-Ø: <span className="font-semibold">{teamAvg}%</span></span>
        <span>Ziel: <span className="font-semibold text-emerald-600">≤5%</span></span>
      </div>

      {/* Coaching */}
      <div className={`flex items-start gap-1.5 rounded p-2 text-[11px] ${
        me.ampel === 'gruen' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
        : me.ampel === 'gelb' ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'
        : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
      }`}>
        <TrendingDown className="w-3 h-3 flex-shrink-0 mt-0.5" />
        {COACHING[me.ampel]}
      </div>
    </div>
  );
}

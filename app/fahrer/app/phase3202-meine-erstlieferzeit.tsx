'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, Minus, TrendingDown, TrendingUp } from 'lucide-react';

interface RankEntry {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  erstlieferzeit_min: number;
  rank_delta: number;
  ampel: string;
  alert_bottom: boolean;
}

interface ApiData {
  fahrer: RankEntry[];
  team_avg_min: number;
  gesamt: number;
}

const MOCK: ApiData = {
  fahrer: [{ fahrer_id: 'me', fahrer_name: 'Ich', rang: 2, erstlieferzeit_min: 12, rank_delta: -1, ampel: 'gruen', alert_bottom: false }],
  team_avg_min: 18,
  gesamt: 4,
};

function ampelCls(a: string) {
  if (a === 'rot')  return { text: 'text-red-600 dark:text-red-400',     bar: 'bg-red-500',   bg: 'bg-red-50 dark:bg-red-900/20'     };
  if (a === 'gelb') return { text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' };
  return                   { text: 'text-green-600 dark:text-green-400', bar: 'bg-green-500', bg: 'bg-green-50 dark:bg-green-900/20' };
}

function tip(ampel: string): string {
  if (ampel === 'rot')  return 'Deine erste Lieferung dauert länger als die meisten anderen Fahrer. Optimiere deine Startroute und bereite dich schneller auf den ersten Stopp vor.';
  if (ampel === 'gelb') return 'Du liegst im Mittelfeld bei der Erstlieferzeit. Kleine Optimierungen beim Tourstart können deinen Rang verbessern.';
  return 'Sehr gut! Du gehörst zu den schnellsten Fahrern bei der ersten Lieferung — weiter so!';
}

export function FahrerPhase3202MeineErstlieferzeit({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!isOnline || !locationId) { setData(MOCK); return; }
    const url = driverId
      ? `/api/delivery/admin/fahrer-erstlieferzeit-ranking?location_id=${locationId}&driver_id=${driverId}`
      : `/api/delivery/admin/fahrer-erstlieferzeit-ranking?location_id=${locationId}`;
    const load = () =>
      fetch(url)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [isOnline, locationId, driverId]);

  const me      = data?.fahrer?.[0] ?? null;
  const teamAvg = data?.team_avg_min ?? 0;
  const gesamt  = data?.gesamt ?? 4;
  const cls     = ampelCls(me?.ampel ?? 'gruen');

  // Rank 1 = shortest time = best → inverted bar (rank 1 = full width)
  const barW = me ? Math.round((1 - (me.rang - 1) / Math.max(gesamt - 1, 1)) * 100) : 0;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-blue-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Meine Erstlieferzeit</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {!isOnline && (
            <div className="text-xs text-gray-400 text-center py-2">Offline — Daten nicht verfügbar</div>
          )}

          {isOnline && me && (
            <>
              <div className="flex items-center justify-center gap-6">
                <div className="text-center">
                  <div className={`text-4xl font-black ${cls.text}`}>#{me.rang}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Rang heute</div>
                </div>
                <div className="text-center">
                  <div className={`text-4xl font-black ${cls.text}`}>{me.erstlieferzeit_min}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Min bis 1. Lieferung</div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>#1 Schnellste</span>
                  <span>#{gesamt} Langsamste</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                  <div className={`h-2.5 rounded-full transition-all ${cls.bar}`} style={{ width: `${Math.max(barW, 5)}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
                  <div className="text-gray-500 mb-0.5">Rang-Δ vs. Vortag</div>
                  <div className={`flex items-center justify-center gap-1 font-bold ${me.rank_delta < 0 ? 'text-green-600' : me.rank_delta > 0 ? 'text-red-500' : 'text-gray-500'}`}>
                    {me.rank_delta < 0 ? <TrendingUp size={12} /> : me.rank_delta > 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                    {me.rank_delta === 0 ? '±0' : me.rank_delta < 0 ? `${me.rank_delta}` : `+${me.rank_delta}`}
                  </div>
                </div>
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
                  <div className="text-gray-500 mb-0.5">Team-Ø</div>
                  <div className="font-bold text-blue-600 dark:text-blue-400">{teamAvg} Min</div>
                </div>
              </div>

              <div className={`rounded-lg p-3 text-xs ${cls.bg} ${cls.text}`}>
                {tip(me.ampel ?? 'gruen')}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

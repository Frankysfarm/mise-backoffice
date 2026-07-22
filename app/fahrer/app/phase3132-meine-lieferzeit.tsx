'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, Minus, TrendingDown, TrendingUp } from 'lucide-react';

interface RankEntry {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_min: number;
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
  fahrer: [{ fahrer_id: 'me', fahrer_name: 'Ich', rang: 2, avg_min: 15, rank_delta: -3, ampel: 'gruen', alert_bottom: false }],
  team_avg_min: 21,
  gesamt: 4,
};

function ampelCls(a: string) {
  if (a === 'rot')  return { text: 'text-red-600 dark:text-red-400',     bar: 'bg-red-500',   bg: 'bg-red-50 dark:bg-red-900/20'     };
  if (a === 'gelb') return { text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' };
  return                   { text: 'text-green-600 dark:text-green-400', bar: 'bg-green-500', bg: 'bg-green-50 dark:bg-green-900/20' };
}

function tip(ampel: string): string {
  if (ampel === 'rot')  return 'Deine Ø Lieferzeit liegt im unteren Viertel. Optimiere deine Route und spare Zeit bei der Übergabe, um schneller zu werden.';
  if (ampel === 'gelb') return 'Du liegst im Mittelfeld. Mit einer besseren Routenplanung und schnellen Übergaben kannst du in die Top 25% kommen.';
  return 'Stark! Du gehörst zu den schnellsten Fahrern heute — top Lieferzeit!';
}

export function FahrerPhase3132MeineLieferzeit({
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
      ? `/api/delivery/admin/fahrer-lieferzeit-ranking?location_id=${locationId}&driver_id=${driverId}`
      : `/api/delivery/admin/fahrer-lieferzeit-ranking?location_id=${locationId}`;
    const load = () =>
      fetch(url)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [isOnline, locationId, driverId]);

  if (!isOnline) return null;

  const entry    = data?.fahrer?.[0] ?? MOCK.fahrer[0];
  const teamAvg  = data?.team_avg_min ?? 0;
  const gesamt   = data?.gesamt ?? 4;
  const cls      = ampelCls(entry.ampel);
  // Inverted bar: shorter time = better = higher fill (Rang 1 fills 100%)
  const barWidth = Math.round(((gesamt - entry.rang) / Math.max(gesamt - 1, 1)) * 100);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-blue-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Meine Ø Lieferzeit</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-center gap-6">
            <div className="text-center">
              <div className={`text-4xl font-bold leading-none ${cls.text}`}>#{entry.rang}</div>
              <div className="text-xs text-gray-500 mt-1">von {gesamt}</div>
            </div>
            <div className="text-center">
              <div className={`text-4xl font-bold leading-none ${cls.text}`}>{entry.avg_min}</div>
              <div className="text-xs text-gray-500 mt-1">Ø Min je Stopp</div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Langsamster</span>
              <span>Schnellster (Rang 1)</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div className={`h-2 rounded-full transition-all ${cls.bar}`} style={{ width: `${Math.max(barWidth, 5)}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
              <div className="text-gray-500 dark:text-gray-400 font-medium mb-0.5">Δ vs. Vortag</div>
              <div className="flex items-center justify-center gap-1 font-bold">
                {entry.rank_delta < 0 ? (
                  <><TrendingUp size={13} className="text-green-500" /><span className="text-green-600 dark:text-green-400">{entry.rank_delta}m</span></>
                ) : entry.rank_delta > 0 ? (
                  <><TrendingDown size={13} className="text-red-400" /><span className="text-red-600 dark:text-red-400">+{entry.rank_delta}m</span></>
                ) : (
                  <><Minus size={13} className="text-gray-400" /><span className="text-gray-500">0m</span></>
                )}
              </div>
            </div>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-2">
              <div className="text-gray-500 dark:text-gray-400 font-medium mb-0.5">Team-Ø</div>
              <div className="font-bold text-blue-600 dark:text-blue-400">{teamAvg} Min</div>
            </div>
          </div>

          <div className={`rounded-lg border px-3 py-2 text-xs font-medium ${cls.bg} ${cls.text}`}>
            {tip(entry.ampel)}
          </div>
        </div>
      )}
    </div>
  );
}

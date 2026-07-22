'use client';
import { useEffect, useState } from 'react';
import { Activity, ChevronDown, ChevronUp, Minus, TrendingDown, TrendingUp } from 'lucide-react';

interface RankEntry {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  auslastung_pct: number;
  aktive_min: number;
  rank_delta: number;
  ampel: string;
}

interface ApiData {
  fahrer: RankEntry[];
  team_avg_pct: number;
  gesamt: number;
}

const MOCK: ApiData = {
  fahrer: [{ fahrer_id: 'me', fahrer_name: 'Ich', rang: 2, auslastung_pct: 81, aktive_min: 243, rank_delta: 1, ampel: 'gruen' }],
  team_avg_pct: 70,
  gesamt: 4,
};

function ampelCls(a: string) {
  if (a === 'rot')  return { text: 'text-red-600 dark:text-red-400',     bar: 'bg-red-500',   bg: 'bg-red-50 dark:bg-red-900/20'     };
  if (a === 'gelb') return { text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' };
  return                   { text: 'text-green-600 dark:text-green-400', bar: 'bg-green-500', bg: 'bg-green-50 dark:bg-green-900/20' };
}

function tip(ampel: string): string {
  if (ampel === 'rot')  return 'Deine Auslastung ist niedrig. Nutze Wartezeiten sinnvoll und bleibe verfügbar — mehr Fahrten sind in Reichweite!';
  if (ampel === 'gelb') return 'Deine Auslastung liegt im Mittelfeld. Bleib aktiv und akzeptiere Touren schnell, um in die Top 25% zu kommen.';
  return 'Stark! Deine Auslastung gehört zu den höchsten im Team — weiter so!';
}

function DeltaIcon({ delta }: { delta: number }) {
  if (delta < 0) return <TrendingUp   size={12} className="text-green-500" />;
  if (delta > 0) return <TrendingDown size={12} className="text-red-400"   />;
  return               <Minus         size={12} className="text-gray-400"  />;
}

export function FahrerPhase3212MeineAuslastung({
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
    if (!isOnline || !driverId || !locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-auslastung-ranking?location_id=${locationId}&driver_id=${driverId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline) return null;

  const me      = data?.fahrer?.[0] ?? MOCK.fahrer[0];
  const teamAvg = data?.team_avg_pct ?? MOCK.team_avg_pct;
  const gesamt  = data?.gesamt ?? MOCK.gesamt;
  const cls     = ampelCls(me.ampel);
  const barW    = gesamt > 1 ? Math.max(0, Math.round(((gesamt - me.rang) / (gesamt - 1)) * 100)) : 100;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-3 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-green-500 shrink-0" />
          <span className="font-semibold text-xs text-gray-800 dark:text-gray-100">Meine Auslastung</span>
          <span className={`text-xs font-bold ${cls.text}`}>{me.auslastung_pct}%</span>
        </div>
        {open ? <ChevronUp size={14} className="text-gray-500 shrink-0" /> : <ChevronDown size={14} className="text-gray-500 shrink-0" />}
      </button>

      {open && (
        <div className={`px-4 py-3 space-y-3 ${cls.bg}`}>
          <div className="flex items-end justify-between">
            <div>
              <span className={`text-4xl font-extrabold ${cls.text}`}>{me.rang}</span>
              <span className="text-xs text-gray-400 ml-1">/ {gesamt}</span>
            </div>
            <div className="text-right">
              <span className={`text-4xl font-extrabold ${cls.text}`}>{me.auslastung_pct}%</span>
              <div className="text-xs text-gray-400">{me.aktive_min} Min aktiv</div>
            </div>
          </div>

          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div className={`h-2 rounded-full transition-all ${cls.bar}`} style={{ width: `${Math.max(barW, me.auslastung_pct > 0 ? 4 : 0)}%` }} />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 p-2 text-center">
              <div className="text-gray-500 font-medium mb-0.5 flex items-center justify-center gap-1">
                Rang-Δ <DeltaIcon delta={me.rank_delta} />
              </div>
              <div className={`font-bold text-sm ${me.rank_delta < 0 ? 'text-green-600' : me.rank_delta > 0 ? 'text-red-500' : 'text-gray-600 dark:text-gray-300'}`}>
                {me.rank_delta === 0 ? '±0' : me.rank_delta < 0 ? `${me.rank_delta}` : `+${me.rank_delta}`}
              </div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 p-2 text-center">
              <div className="text-gray-500 font-medium mb-0.5">Team-Ø</div>
              <div className="font-bold text-sm text-gray-700 dark:text-gray-200">{teamAvg}%</div>
            </div>
          </div>

          <div className={`rounded-lg text-xs px-3 py-2 font-medium ${cls.bg} border ${me.ampel === 'rot' ? 'border-red-200 dark:border-red-800 text-red-700 dark:text-red-300' : me.ampel === 'gelb' ? 'border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300' : 'border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'}`}>
            {tip(me.ampel)}
          </div>
        </div>
      )}
    </div>
  );
}

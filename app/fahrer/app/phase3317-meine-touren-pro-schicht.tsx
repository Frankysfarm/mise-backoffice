'use client';
import { useEffect, useState } from 'react';
import { TrendingUp, AlertTriangle, ChevronDown, ChevronUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rate: number;
  touren: number;
  schichten: number;
  rang: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_rate: number;
  gesamt: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, rate: 8.4, touren: 42, schichten: 5, rank_delta:  1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, rate: 7.1, touren: 35, schichten: 5, rank_delta:  0, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, rate: 5.8, touren: 29, schichten: 5, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, rate: 3.9, touren: 19, schichten: 5, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_rate: 6.3,
  gesamt: 4,
};

function ampelCls(a: string) {
  if (a === 'rot')  return { text: 'text-red-700 dark:text-red-300',     bar: 'bg-red-500',   bg: 'bg-red-50 dark:bg-red-950'     };
  if (a === 'gelb') return { text: 'text-amber-700 dark:text-amber-300', bar: 'bg-amber-400', bg: 'bg-amber-50 dark:bg-amber-950' };
  return                   { text: 'text-green-700 dark:text-green-300', bar: 'bg-green-500', bg: 'bg-green-50 dark:bg-green-950' };
}

function coachingTipp(a: string): string {
  if (a === 'rot')  return 'Niedrige Touren-Rate! Versuche, deine Effizienz pro Schicht zu steigern — schnellere Ablieferungen und kurze Pausen helfen.';
  if (a === 'gelb') return 'Solide Leistung! Noch etwas mehr Fokus bringt dich in die Top-25% des Teams.';
  return 'Ausgezeichnet! Du gehörst zu den effizientesten Fahrern im Team — weiter so!';
}

export function FahrerPhase3317MeineTourenProSchicht({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!isOnline) return;
    let active = true;
    const load = async () => {
      if (!locationId) { setData(MOCK); return; }
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-touren-pro-schicht?location_id=${locationId}`);
        if (res.ok && active) setData(await res.json());
      } catch {
        if (active) setData(MOCK);
      }
    };
    load();
    const iv = setInterval(load, 30 * 60 * 1000);
    return () => { active = false; clearInterval(iv); };
  }, [locationId, isOnline]);

  if (!isOnline) return null;

  const d = data ?? MOCK;
  const me = d.fahrer.find(f => f.fahrer_id === driverId) ?? d.fahrer[0];
  if (!me) return null;

  const cls = ampelCls(me.ampel);
  const total = d.gesamt || d.fahrer.length;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-orange-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Meine Touren/Schicht</span>
          {me.alert_bottom && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 rounded-full px-2 py-0.5">
              <AlertTriangle size={10} /> Alert
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          <div className={`rounded-xl p-4 text-center ${cls.bg}`}>
            <div className={`text-5xl font-black ${cls.text}`}>
              {me.rate}<span className="text-2xl font-semibold"> T/S</span>
            </div>
            <div className={`text-3xl font-bold ${cls.text} mt-1`}>Rang #{me.rang}</div>
            <div className="text-xs text-gray-400 mt-1">{me.touren} Touren / {me.schichten} Schichten</div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Rang {me.rang}</span>
              <span>von {total} Fahrern</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all ${cls.bar}`}
                style={{ width: `${Math.max(((total - me.rang + 1) / total) * 100, 4)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
              <div className="text-gray-400 mb-0.5">Rang-Δ</div>
              <div className={`font-bold text-sm flex items-center justify-center gap-1 ${me.rank_delta > 0 ? 'text-green-600' : me.rank_delta < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                {me.rank_delta > 0
                  ? <><TrendingUp size={12} /> +{me.rank_delta}</>
                  : me.rank_delta < 0
                  ? <><TrendingDown size={12} /> {me.rank_delta}</>
                  : <><Minus size={12} /> 0</>}
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
              <div className="text-gray-400 mb-0.5">Team-Ø</div>
              <div className="font-bold text-sm text-gray-700 dark:text-gray-200">{d.team_avg_rate} T/S</div>
            </div>
          </div>

          <div className={`rounded-lg p-3 text-xs ${cls.bg} ${cls.text}`}>
            {coachingTipp(me.ampel)}
          </div>

          <div className="text-xs text-gray-400 text-center">Ø Touren pro Schicht · letzte 30 Tage</div>
        </div>
      )}
    </div>
  );
}

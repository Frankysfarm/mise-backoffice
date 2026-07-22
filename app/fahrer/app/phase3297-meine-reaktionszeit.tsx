'use client';
import { useEffect, useState } from 'react';
import { Timer, AlertTriangle, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  avg_sek: number;
  rang: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_sek: number;
  gesamt: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, avg_sek: 45,  rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, avg_sek: 62,  rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, avg_sek: 90,  rank_delta:  1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_sek: 148, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_sek: 86,
  gesamt: 4,
};

function toMin(sek: number): string {
  return (sek / 60).toFixed(1);
}

function ampelCls(a: string) {
  if (a === 'rot')  return { text: 'text-red-700 dark:text-red-300',     bar: 'bg-red-500',   bg: 'bg-red-50 dark:bg-red-950'     };
  if (a === 'gelb') return { text: 'text-amber-700 dark:text-amber-300', bar: 'bg-amber-400', bg: 'bg-amber-50 dark:bg-amber-950' };
  return                   { text: 'text-green-700 dark:text-green-300', bar: 'bg-green-500', bg: 'bg-green-50 dark:bg-green-950' };
}

function coachingTipp(a: string): string {
  if (a === 'rot')  return 'Reaktionszeit zu hoch! Überprüfe Handybenachrichtigungen und starte sofort nach Tourzuweisung.';
  if (a === 'gelb') return 'Gute Reaktionszeit! Versuche noch schneller zu starten — unter 5 Minuten ist das Ziel.';
  return 'Ausgezeichnete Reaktionszeit! Du antwortest sehr schnell auf neue Touren.';
}

export function FahrerPhase3297MeineReaktionszeit({
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
        const res = await fetch(`/api/delivery/admin/fahrer-reaktionszeit-ranking?location_id=${locationId}`);
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
          <Timer size={16} className="text-orange-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Meine Reaktionszeit</span>
          {(me.alert_bottom || me.ampel === 'rot') && (
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
              {toMin(me.avg_sek)}<span className="text-2xl font-semibold"> min</span>
            </div>
            <div className={`text-3xl font-bold ${cls.text} mt-1`}>Rang #{me.rang}</div>
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

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2 text-center">
              <div className="text-gray-500 font-medium flex items-center justify-center gap-1 mb-1">
                Rank-Δ
                {me.rank_delta < 0
                  ? <TrendingUp   size={10} className="text-green-500" />
                  : me.rank_delta > 0
                  ? <TrendingDown size={10} className="text-red-400"   />
                  : <Minus        size={10} className="text-gray-400"  />}
              </div>
              <div className={`font-bold text-sm ${me.rank_delta < 0 ? 'text-green-600' : me.rank_delta > 0 ? 'text-red-500' : 'text-gray-500'}`}>
                {me.rank_delta > 0 ? `+${me.rank_delta}` : me.rank_delta === 0 ? '—' : me.rank_delta}
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2 text-center">
              <div className="text-gray-500 font-medium mb-1">Team-Ø</div>
              <div className="font-bold text-sm text-blue-600 dark:text-blue-400">{toMin(d.team_avg_sek)} min</div>
            </div>
          </div>

          <div className={`rounded-lg p-3 text-xs font-medium ${cls.bg} ${cls.text}`}>
            {coachingTipp(me.ampel)}
          </div>
        </div>
      )}
    </div>
  );
}

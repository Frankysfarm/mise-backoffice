'use client';
import { useEffect, useState } from 'react';
import { Car, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  leerfahrten_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_leerfahrten_pct: number;
  gesamt: number;
}

const MOCK: ApiData = {
  fahrer: [{ fahrer_id: 'me', fahrer_name: 'Ich', rang: 2, leerfahrten_pct: 12, rank_delta: 1, ampel: 'gruen', alert_bottom: false }],
  team_avg_leerfahrten_pct: 19.25,
  gesamt: 4,
};

function ampelCls(a: string) {
  if (a === 'rot')  return { text: 'text-red-600 dark:text-red-400',    bg: 'bg-red-50 dark:bg-red-950',    bar: 'bg-red-500',    tip: 'Viele Leerfahrten! Routenplanung verbessern und aktiv Aufträge suchen.' };
  if (a === 'gelb') return { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950', bar: 'bg-amber-400',  tip: 'Mittlere Leerfahrten-Quote. Versuche gezielt Aufträge zu bündeln.' };
  return                   { text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950', bar: 'bg-orange-500', tip: 'Sehr gute Leerfahrten-Quote! Weiter so.' };
}

export function FahrerPhase3366MeineLeerfahrtenRanking({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [open, setOpen]  = useState(false);
  const [data, setData]  = useState<ApiData | null>(null);

  useEffect(() => {
    if (!isOnline) return;
    let active = true;
    const load = async () => {
      if (!locationId) { setData(MOCK); return; }
      try {
        const url = driverId
          ? `/api/delivery/admin/fahrer-leerfahrten-ranking?location_id=${locationId}&driver_id=${driverId}`
          : `/api/delivery/admin/fahrer-leerfahrten-ranking?location_id=${locationId}`;
        const res = await fetch(url);
        if (res.ok && active) setData(await res.json());
      } catch {
        if (active) setData(MOCK);
      }
    };
    load();
    const iv = setInterval(load, 30 * 60 * 1000);
    return () => { active = false; clearInterval(iv); };
  }, [driverId, locationId, isOnline]);

  if (!isOnline) return null;

  const d    = data ?? MOCK;
  const me   = d.fahrer.find(f => f.fahrer_id === driverId) ?? d.fahrer[0];
  const cls  = ampelCls(me?.ampel ?? 'gruen');
  const gesamt = d.gesamt;
  const barW = gesamt > 1 ? ((gesamt - (me?.rang ?? 1)) / (gesamt - 1)) * 100 : 100;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Car size={16} className="text-orange-600" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Meine Leerfahrten-Quote</span>
        </div>
        {open
          ? <span className="text-xs text-gray-400">▲</span>
          : <span className={`text-xs font-bold ${cls.text}`}>{me?.leerfahrten_pct ?? 0}% · Rang {me?.rang ?? '—'}</span>}
      </button>

      {open && me && (
        <div className="p-4 space-y-4">
          <div className="text-center space-y-1">
            <div className={`text-5xl font-black ${cls.text}`}>{me.leerfahrten_pct}%</div>
            <div className={`text-3xl font-bold ${cls.text}`}>Rang {me.rang} / {gesamt}</div>
          </div>

          <div>
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Rang {gesamt} (höchste Quote)</span>
              <span>Rang 1 (niedrigste Quote)</span>
            </div>
            <div className="h-3 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div className={`h-full rounded-full ${cls.bar} transition-all`} style={{ width: `${barW}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Rang-Änderung</div>
              <div className="flex items-center justify-center gap-1">
                {me.rank_delta < 0
                  ? <><TrendingUp size={16} className="text-green-500" /><span className="text-sm font-bold text-green-600">{Math.abs(me.rank_delta)} besser</span></>
                  : me.rank_delta > 0
                  ? <><TrendingDown size={16} className="text-red-400" /><span className="text-sm font-bold text-red-500">{me.rank_delta} schlechter</span></>
                  : <><Minus size={16} className="text-gray-400" /><span className="text-sm font-bold text-gray-500">unverändert</span></>}
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Team-Ø</div>
              <div className="text-sm font-bold text-gray-700 dark:text-gray-200">{d.team_avg_leerfahrten_pct}%</div>
              <div className="text-xs text-gray-400">Ziel &lt;10%</div>
            </div>
          </div>

          <div className={`rounded-lg p-3 text-xs ${cls.bg}`}>
            <p className={`font-medium ${cls.text}`}>{cls.tip}</p>
          </div>
        </div>
      )}
    </div>
  );
}

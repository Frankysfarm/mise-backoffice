'use client';
import { useEffect, useState } from 'react';
import { Coins, AlertTriangle, ChevronDown, ChevronUp, TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_tip_eur: number;
  tip_count: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_eur: number;
  gesamt: number;
}

const MOCK: ApiData = {
  fahrer: [{ fahrer_id: 'me', fahrer_name: 'Du', rang: 2, avg_tip_eur: 2.50, tip_count: 20, rank_delta: 1, ampel: 'gruen', alert_bottom: false }],
  team_avg_eur: 2.10,
  gesamt: 4,
};

function fmtEur(v: number): string {
  return `${v.toFixed(2)} €`;
}

function ampelColor(a: string) {
  if (a === 'rot')  return { text: 'text-red-600 dark:text-red-400',   bg: 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800',         bar: 'bg-red-500'   };
  if (a === 'gelb') return { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800', bar: 'bg-amber-400' };
  return                   { text: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800', bar: 'bg-green-500' };
}

function coaching(a: string): string {
  if (a === 'gruen') return 'Super! Dein Trinkgeld liegt im Top-Viertel. Weiter so!';
  if (a === 'gelb')  return 'Gute Leistung! Freundlichkeit und Pünktlichkeit steigern das Trinkgeld.';
  return                   'Fokus auf Kundenerlebnis! Lächeln und schnelle Lieferung steigern Trinkgelder.';
}

export function FahrerPhase3252MeinTrinkgeld({
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
      try {
        const params = new URLSearchParams();
        if (locationId) params.set('location_id', locationId);
        if (driverId)   params.set('driver_id', driverId);
        const res = await fetch(`/api/delivery/admin/fahrer-trinkgeld-ranking?${params}`);
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

  const d = data ?? MOCK;
  const me = d.fahrer[0];
  if (!me) return null;

  const col = ampelColor(me.ampel);
  const barWidth = d.gesamt > 1 ? Math.max(((d.gesamt - me.rang) / (d.gesamt - 1)) * 100, 4) : 100;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Coins size={16} className="text-yellow-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Mein Trinkgeld</span>
          {me.alert_bottom && (
            <span className="ml-1 inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 rounded-full px-2 py-0.5">
              <AlertTriangle size={10} /> Niedrig
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          <div className="text-center">
            <div className={`text-5xl font-black ${col.text}`}>{fmtEur(me.avg_tip_eur)}</div>
            <div className="text-sm text-gray-500 mt-1">Ø Trinkgeld ({me.tip_count} Lieferungen)</div>
            <div className={`text-3xl font-bold mt-1 ${col.text}`}>Rang #{me.rang}</div>
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-1 flex justify-between">
              <span>Letzter</span><span>Bester</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${col.bar}`}
                style={{ width: `${barWidth}%` }}
              />
            </div>
            <div className="text-xs text-gray-400 text-center mt-1">Rang {me.rang} von {d.gesamt}</div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
              <div className="text-gray-500 font-medium mb-0.5">Rang-Δ</div>
              <div className="font-bold flex items-center justify-center gap-1">
                {me.rank_delta < 0
                  ? <><TrendingUp size={14} className="text-green-500" /><span className="text-green-600">{me.rank_delta}</span></>
                  : me.rank_delta > 0
                  ? <><TrendingDown size={14} className="text-red-400" /><span className="text-red-500">+{me.rank_delta}</span></>
                  : <><Minus size={14} className="text-gray-400" /><span className="text-gray-500">±0</span></>}
              </div>
            </div>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-2">
              <div className="text-gray-500 font-medium mb-0.5">Team-Ø</div>
              <div className="font-bold text-blue-600 dark:text-blue-400">{fmtEur(d.team_avg_eur)}</div>
            </div>
          </div>

          <div className={`rounded-lg border p-3 text-xs ${col.bg} ${col.text}`}>
            💡 {coaching(me.ampel)}
          </div>
        </div>
      )}
    </div>
  );
}

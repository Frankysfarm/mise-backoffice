'use client';
import { useEffect, useState } from 'react';
import { XCircle, AlertTriangle, ChevronDown, ChevronUp, TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  quote_pct: number;
  rang: number;
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiData {
  fahrer: FahrerRow[];
  team_durchschnitt: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'me', fahrer_name: 'Du', quote_pct: 6.3, rang: 2, trend_delta: 0.8, ampel: 'gelb' },
  ],
  team_durchschnitt: 7.9,
};

function ampelColor(a: string) {
  if (a === 'rot')  return { text: 'text-red-600 dark:text-red-400',    bg: 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800',         bar: 'bg-red-500'   };
  if (a === 'gelb') return { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800', bar: 'bg-amber-400' };
  return                   { text: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800', bar: 'bg-green-500' };
}

function coaching(a: string): string {
  if (a === 'gruen') return 'Ausgezeichnet! Deine Storno-Quote ist sehr niedrig — du lieferst zuverlässig. Weiter so!';
  if (a === 'gelb')  return 'Achte auf schwierige Adressen und kommuniziere bei Problemen früh mit dem Kunden, um Stornos zu vermeiden.';
  return                   'Deine Storno-Quote ist zu hoch. Überprüfe Adressen sorgfältig und kontaktiere Kunden bei Unsicherheiten direkt.';
}

export function FahrerPhase3287MeineStornoQuote({
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
      if (!locationId) { if (active) setData(MOCK); return; }
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-storno-quote?location_id=${locationId}`);
        if (res.ok && active) {
          const json: ApiData = await res.json();
          if (driverId) {
            const me = json.fahrer.find(f => f.fahrer_id === driverId);
            if (me) {
              setData({ fahrer: [me], team_durchschnitt: json.team_durchschnitt });
            } else {
              setData(MOCK);
            }
          } else {
            setData(json);
          }
        }
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
  const totalFahrer = d.fahrer.length > 1 ? d.fahrer.length : 4;
  const barWidth = totalFahrer > 1 ? Math.max(((totalFahrer - me.rang) / (totalFahrer - 1)) * 100, 4) : 100;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <XCircle size={16} className="text-red-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Meine Storno-Quote</span>
          {me.ampel === 'rot' && (
            <span className="ml-1 inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 rounded-full px-2 py-0.5">
              <AlertTriangle size={10} /> Hoch
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          <div className="text-center">
            <div className={`text-5xl font-black ${col.text}`}>{me.quote_pct.toFixed(1)}%</div>
            <div className="text-sm text-gray-500">Storno-Quote heute</div>
            <div className={`text-3xl font-bold mt-1 ${col.text}`}>Rang #{me.rang}</div>
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-1 flex justify-between">
              <span>Höchste Quote</span><span>Niedrigste Quote</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
              <div className={`h-3 rounded-full transition-all ${col.bar}`} style={{ width: `${barWidth}%` }} />
            </div>
            <div className="text-xs text-gray-400 text-center mt-1">Rang {me.rang} von {totalFahrer}</div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
              <div className="text-gray-500 font-medium mb-0.5">Trend</div>
              <div className="font-bold flex items-center justify-center gap-1">
                {me.trend_delta < 0
                  ? <><TrendingDown size={14} className="text-green-500" /><span className="text-green-600">{me.trend_delta.toFixed(1)}</span></>
                  : me.trend_delta > 0
                  ? <><TrendingUp size={14} className="text-red-400" /><span className="text-red-500">+{me.trend_delta.toFixed(1)}</span></>
                  : <><Minus size={14} className="text-gray-400" /><span className="text-gray-500">stabil</span></>}
              </div>
            </div>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-2">
              <div className="text-gray-500 font-medium mb-0.5">Team-Ø</div>
              <div className="font-bold text-blue-600 dark:text-blue-400">{d.team_durchschnitt.toFixed(1)}%</div>
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

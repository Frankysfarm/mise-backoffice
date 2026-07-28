'use client';

import { useEffect, useState } from 'react';
import { Clock, ChefHat, AlertTriangle, CheckCircle2, Zap } from 'lucide-react';

interface BestellungRow {
  id: string;
  bestellnummer: string;
  status: string;
  elapsed_sec: number;
  prep_soll_sec: number;
  items_count: number;
  prioritaet: 'kritisch' | 'hoch' | 'normal' | 'frueh';
}

interface KpiRow {
  key: string;
  label: string;
  wert: string;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiData {
  bestellungen: BestellungRow[];
  kpis: KpiRow[];
  schicht_score: number;
  alert_count: number;
}

const MOCK: ApiData = {
  schicht_score: 79,
  alert_count: 2,
  kpis: [
    { key: 'ontime', label: 'Pünktlich', wert: '81%', ampel: 'gelb' },
    { key: 'prep', label: 'Ø Prep', wert: '14 min', ampel: 'gruen' },
    { key: 'aktiv', label: 'Aktiv', wert: '5', ampel: 'gruen' },
    { key: 'queue', label: 'Warteschlange', wert: '3', ampel: 'gelb' },
  ],
  bestellungen: [
    { id: '1', bestellnummer: '#2041', status: 'in_zubereitung', elapsed_sec: 1240, prep_soll_sec: 900, items_count: 3, prioritaet: 'kritisch' },
    { id: '2', bestellnummer: '#2042', status: 'in_zubereitung', elapsed_sec: 540, prep_soll_sec: 900, items_count: 2, prioritaet: 'hoch' },
    { id: '3', bestellnummer: '#2043', status: 'in_zubereitung', elapsed_sec: 180, prep_soll_sec: 900, items_count: 4, prioritaet: 'normal' },
    { id: '4', bestellnummer: '#2044', status: 'bestaetigt', elapsed_sec: 0, prep_soll_sec: 900, items_count: 1, prioritaet: 'frueh' },
  ],
};

const PRIO_STYLE: Record<string, { border: string; dot: string; label: string }> = {
  kritisch: { border: 'border-red-300 dark:border-red-800', dot: 'bg-red-500', label: 'text-red-600 dark:text-red-400' },
  hoch:     { border: 'border-orange-300 dark:border-orange-800', dot: 'bg-orange-400', label: 'text-orange-600 dark:text-orange-400' },
  normal:   { border: 'border-yellow-300 dark:border-yellow-800', dot: 'bg-yellow-400', label: 'text-yellow-600 dark:text-yellow-400' },
  frueh:    { border: 'border-green-300 dark:border-green-800', dot: 'bg-green-500', label: 'text-green-600 dark:text-green-400' },
};

const AMPEL_DOT: Record<string, string> = {
  gruen: 'bg-emerald-500', gelb: 'bg-yellow-400', rot: 'bg-red-500',
};
const AMPEL_VAL: Record<string, string> = {
  gruen: 'text-emerald-700 dark:text-emerald-400',
  gelb:  'text-yellow-700 dark:text-yellow-400',
  rot:   'text-red-600 dark:text-red-400',
};

function fmtSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function KitchenPhase4651SmartTimingCountdownLiveV9({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const p = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/kitchen-smart-timing${p}`);
        if (!res.ok) throw new Error();
        const json: ApiData = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(MOCK);
      }
    }

    load();
    const poll = setInterval(load, 15_000);
    return () => { cancelled = true; clearInterval(poll); };
  }, [locationId]);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  if (!data) return <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 animate-pulse h-56" />;

  const scoreColor = data.schicht_score >= 85 ? 'text-emerald-600' : data.schicht_score >= 70 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-gray-900 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ChefHat className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Smart-Timing Countdown v9</h3>
        <span className={`ml-auto text-xl font-bold ${scoreColor}`}>{data.schicht_score}</span>
        <span className="text-xs text-gray-400">Score</span>
      </div>

      {/* Alert-Banner */}
      {data.alert_count > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
          <span className="text-xs text-red-700 dark:text-red-300">{data.alert_count} Bestellung{data.alert_count !== 1 ? 'en' : ''} überfällig</span>
        </div>
      )}

      {/* KPI-Grid */}
      <div className="grid grid-cols-4 gap-2">
        {data.kpis.map(k => (
          <div key={k.key} className="rounded-xl bg-gray-50 dark:bg-gray-800 p-2 text-center">
            <div className="flex justify-center mb-1">
              <span className={`w-2 h-2 rounded-full ${AMPEL_DOT[k.ampel]}`} />
            </div>
            <p className={`text-sm font-bold ${AMPEL_VAL[k.ampel]}`}>{k.wert}</p>
            <p className="text-xs text-gray-400 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Countdown-Kacheln */}
      <div className="space-y-2">
        {data.bestellungen.map(b => {
          const elapsed = b.elapsed_sec + (b.status === 'in_zubereitung' ? tick : 0);
          const remaining = Math.max(0, b.prep_soll_sec - elapsed);
          const pct = Math.min(100, (elapsed / b.prep_soll_sec) * 100);
          const style = PRIO_STYLE[b.prioritaet];

          return (
            <div key={b.id} className={`rounded-xl border ${style.border} bg-white dark:bg-gray-900 p-3`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2 h-2 rounded-full ${style.dot} shrink-0`} />
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{b.bestellnummer}</span>
                <span className="text-xs text-gray-400">{b.items_count} Artikel</span>
                {b.prioritaet === 'kritisch' && <Zap className="w-3.5 h-3.5 text-red-500 ml-auto" />}
                {b.status === 'bestaetigt' && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-auto" />}
                <span className={`text-sm font-mono font-bold ml-auto ${style.label}`}>
                  {b.status === 'in_zubereitung' ? (remaining > 0 ? fmtSec(remaining) : '–:––') : <Clock className="w-3.5 h-3.5 inline" />}
                </span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-1.5 rounded-full transition-all ${style.dot}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Timer, AlertTriangle, CheckCircle2, Zap, TrendingUp, Clock, Flame, Bell, BarChart2, ChefHat, RefreshCw } from 'lucide-react';

interface OrderCountdown {
  order_id: string;
  bestellnummer: string;
  kunde_name: string;
  status: 'in_zubereitung' | 'fertig' | 'wartend';
  geschaetzte_min: number;
  remaining_sec: number;
  fahrer_wartet: boolean;
  ampel: 'gruen' | 'gelb' | 'orange' | 'rot';
  prep_min_bisher: number;
  station: string;
  artikel_anzahl: number;
  batch_partner: string | null;
}

interface StationLoad {
  name: string;
  auslastung_pct: number;
  aktiv: number;
  wartend: number;
}

interface KpiData {
  bestellungen: OrderCountdown[];
  timing_score: number;
  on_time_pct: number;
  ueberfaellig: number;
  fahrer_wartet_anzahl: number;
  avg_prep_min: number;
  ziel_min: number;
  kritisch_anzahl: number;
  schicht_vergleich_pct: number;
  prognose_min: number;
  stationen: StationLoad[];
}

const MOCK: KpiData = {
  timing_score: 87,
  on_time_pct: 91,
  ueberfaellig: 1,
  fahrer_wartet_anzahl: 1,
  avg_prep_min: 14,
  ziel_min: 18,
  kritisch_anzahl: 1,
  schicht_vergleich_pct: 6,
  prognose_min: 13,
  stationen: [
    { name: 'Pizza',  auslastung_pct: 85, aktiv: 2, wartend: 1 },
    { name: 'Grill',  auslastung_pct: 60, aktiv: 1, wartend: 0 },
    { name: 'Pasta',  auslastung_pct: 40, aktiv: 1, wartend: 1 },
    { name: 'Salat',  auslastung_pct: 20, aktiv: 0, wartend: 1 },
  ],
  bestellungen: [
    { order_id: 'o1', bestellnummer: '0061', kunde_name: 'K. Schmidt',  status: 'in_zubereitung', geschaetzte_min: 18, remaining_sec: 720,  fahrer_wartet: false, ampel: 'gruen',  prep_min_bisher: 5,  station: 'Pizza', artikel_anzahl: 3, batch_partner: '#0062' },
    { order_id: 'o2', bestellnummer: '0062', kunde_name: 'A. Müller',   status: 'in_zubereitung', geschaetzte_min: 15, remaining_sec: 200,  fahrer_wartet: false, ampel: 'gelb',  prep_min_bisher: 12, station: 'Pizza', artikel_anzahl: 2, batch_partner: '#0061' },
    { order_id: 'o3', bestellnummer: '0063', kunde_name: 'B. Weber',    status: 'in_zubereitung', geschaetzte_min: 14, remaining_sec: 70,   fahrer_wartet: true,  ampel: 'orange', prep_min_bisher: 13, station: 'Grill', artikel_anzahl: 4, batch_partner: null },
    { order_id: 'o4', bestellnummer: '0060', kunde_name: 'T. Bauer',    status: 'fertig',          geschaetzte_min: 16, remaining_sec: -300, fahrer_wartet: true,  ampel: 'rot',   prep_min_bisher: 21, station: 'Grill', artikel_anzahl: 2, batch_partner: null },
    { order_id: 'o5', bestellnummer: '0064', kunde_name: 'S. Fischer',  status: 'wartend',         geschaetzte_min: 20, remaining_sec: 1200, fahrer_wartet: false, ampel: 'gruen',  prep_min_bisher: 0,  station: 'Pasta', artikel_anzahl: 3, batch_partner: '#0065' },
    { order_id: 'o6', bestellnummer: '0065', kunde_name: 'M. Wagner',   status: 'wartend',         geschaetzte_min: 22, remaining_sec: 1380, fahrer_wartet: false, ampel: 'gruen',  prep_min_bisher: 0,  station: 'Salat', artikel_anzahl: 1, batch_partner: '#0064' },
  ],
};

const AMPEL = {
  gruen:  { dot: 'bg-green-400',  bg: 'bg-green-50 dark:bg-green-950',   text: 'text-green-700 dark:text-green-300',  bar: 'bg-green-500',  label: '>5m',   border: 'border-green-200 dark:border-green-800' },
  gelb:   { dot: 'bg-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-950', text: 'text-yellow-700 dark:text-yellow-300', bar: 'bg-yellow-500', label: '2–5m',  border: 'border-yellow-200 dark:border-yellow-800' },
  orange: { dot: 'bg-orange-400', bg: 'bg-orange-50 dark:bg-orange-950', text: 'text-orange-700 dark:text-orange-300', bar: 'bg-orange-500', label: '0–2m',  border: 'border-orange-200 dark:border-orange-800' },
  rot:    { dot: 'bg-red-500',    bg: 'bg-red-50 dark:bg-red-950',       text: 'text-red-700 dark:text-red-300',       bar: 'bg-red-500',    label: 'Übf.',  border: 'border-red-300 dark:border-red-700' },
};

function fmtSec(sec: number): string {
  if (sec <= 0) return `+${Math.ceil(Math.abs(sec) / 60)}m`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function stationColor(pct: number): string {
  if (pct >= 80) return 'bg-red-500';
  if (pct >= 60) return 'bg-orange-400';
  if (pct >= 40) return 'bg-yellow-400';
  return 'bg-green-400';
}

export function KitchenPhase4410SmartTimingCountdownV6() {
  const [data, setData] = useState<KpiData>(MOCK);
  const [tick, setTick] = useState(0);
  const [silenced, setSilenced] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery/kitchen/queue', { cache: 'no-store' });
      if (!res.ok) throw new Error('fetch failed');
      const json = await res.json();
      if (json && json.timing_score !== undefined) {
        setData(json);
        setLastRefresh(new Date());
      }
    } catch {
      // use mock
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const interval = setInterval(fetchData, 12_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const tick = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(tick);
  }, []);

  const kritisch = data.bestellungen.filter(o => o.ampel === 'rot' || o.ampel === 'orange');
  const batches = data.bestellungen.filter(o => o.batch_partner);
  const scoreColor = data.timing_score >= 85 ? 'text-green-600' : data.timing_score >= 70 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 bg-indigo-600 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-white" />
          <span className="text-sm font-semibold text-white">Smart-Timing V6</span>
          <span className="text-xs text-indigo-200">Echtzeit-Countdown</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSilenced(s => !s)}
            className={`p-1 rounded ${silenced ? 'bg-indigo-800 text-indigo-300' : 'bg-indigo-500 text-white'}`}
            title={silenced ? 'Alarm aktiv' : 'Alarm stumm'}
          >
            <Bell className="w-3.5 h-3.5" />
          </button>
          <button onClick={fetchData} className="p-1 rounded bg-indigo-500 text-white" title="Jetzt aktualisieren">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Kritisch-Alert */}
      {!silenced && kritisch.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-950 border-b border-red-200 dark:border-red-800">
          <Flame className="w-4 h-4 text-red-600 animate-pulse" />
          <span className="text-xs font-semibold text-red-700 dark:text-red-300">
            {kritisch.length} kritisch{kritisch.length > 1 ? 'e' : 'e'} Bestellung{kritisch.length > 1 ? 'en' : ''} — sofort handeln!
          </span>
        </div>
      )}

      {/* KPI-Header */}
      <div className="grid grid-cols-4 gap-px bg-stone-100 dark:bg-stone-800">
        {[
          { label: 'Score', val: `${data.timing_score}`, color: scoreColor, sub: `${data.schicht_vergleich_pct > 0 ? '+' : ''}${data.schicht_vergleich_pct}% vs. Schicht` },
          { label: 'On-Time', val: `${data.on_time_pct}%`, color: data.on_time_pct >= 90 ? 'text-green-600' : 'text-yellow-600', sub: `Ziel: 90%` },
          { label: 'Ø Prep', val: `${data.avg_prep_min}m`, color: data.avg_prep_min <= data.ziel_min ? 'text-green-600' : 'text-orange-600', sub: `Ziel: ${data.ziel_min}m` },
          { label: 'Prognose', val: `${data.prognose_min}m`, color: 'text-indigo-600', sub: 'Nächste Bestellung' },
        ].map(k => (
          <div key={k.label} className="px-3 py-2 bg-white dark:bg-stone-900 text-center">
            <div className={`text-lg font-bold ${k.color}`}>{k.val}</div>
            <div className="text-[10px] text-stone-500 dark:text-stone-400">{k.label}</div>
            <div className="text-[9px] text-stone-400 dark:text-stone-500 mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Stationen-Heatmap */}
      <div className="px-4 py-2 border-b border-stone-100 dark:border-stone-700">
        <div className="flex items-center gap-1.5 mb-1.5">
          <BarChart2 className="w-3.5 h-3.5 text-stone-500" />
          <span className="text-[11px] font-semibold text-stone-600 dark:text-stone-300">Stationen-Auslastung</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {data.stationen.map(s => (
            <div key={s.name} className="flex flex-col gap-0.5">
              <div className="flex justify-between text-[10px]">
                <span className="font-medium text-stone-600 dark:text-stone-300">{s.name}</span>
                <span className="text-stone-400">{s.auslastung_pct}%</span>
              </div>
              <div className="h-1.5 bg-stone-100 dark:bg-stone-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${stationColor(s.auslastung_pct)} transition-all`} style={{ width: `${s.auslastung_pct}%` }} />
              </div>
              <div className="text-[9px] text-stone-400">{s.aktiv} aktiv · {s.wartend} wartend</div>
            </div>
          ))}
        </div>
      </div>

      {/* Batch-Hinweis */}
      {batches.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-indigo-50 dark:bg-indigo-950 border-b border-indigo-100 dark:border-indigo-800">
          <Zap className="w-3.5 h-3.5 text-indigo-500" />
          <span className="text-[11px] text-indigo-700 dark:text-indigo-300">
            {batches.length / 2 | 0} Batch-Paar{batches.length > 2 ? 'e' : ''} aktiv — gemeinsam abschließen
          </span>
        </div>
      )}

      {/* Bestellungs-Countdown-Liste */}
      <div className="divide-y divide-stone-100 dark:divide-stone-800">
        {data.bestellungen.map(order => {
          const a = AMPEL[order.ampel];
          const remaining = order.remaining_sec - tick;
          const totalSec = order.geschaetzte_min * 60;
          const elapsed = totalSec - order.remaining_sec;
          const progressPct = Math.min(100, Math.max(0, (elapsed / totalSec) * 100));
          return (
            <div key={order.order_id} className={`px-4 py-2.5 ${a.bg} ${a.border} border-l-4`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-stone-800 dark:text-stone-100">#{order.bestellnummer}</span>
                    <span className="text-xs text-stone-500 dark:text-stone-400 truncate">{order.kunde_name}</span>
                    <span className="text-[10px] bg-stone-100 dark:bg-stone-700 px-1.5 py-0.5 rounded text-stone-500 dark:text-stone-400">{order.station}</span>
                    {order.batch_partner && (
                      <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900 px-1.5 py-0.5 rounded text-indigo-600 dark:text-indigo-300">
                        Batch {order.batch_partner}
                      </span>
                    )}
                    {order.fahrer_wartet && (
                      <span className="text-[10px] bg-red-100 dark:bg-red-900 px-1.5 py-0.5 rounded text-red-600 dark:text-red-300 font-semibold animate-pulse">
                        Fahrer wartet!
                      </span>
                    )}
                  </div>
                  <div className="mt-1 h-1 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${a.bar} transition-all duration-1000`} style={{ width: `${progressPct}%` }} />
                  </div>
                </div>
                <div className={`text-right shrink-0`}>
                  <div className={`text-base font-mono font-bold ${a.text}`}>
                    {order.status === 'fertig' ? <CheckCircle2 className="w-5 h-5 text-green-500 inline" /> : fmtSec(remaining)}
                  </div>
                  <div className="flex items-center gap-1 justify-end mt-0.5">
                    <span className={`w-2 h-2 rounded-full ${a.dot}`} />
                    <span className={`text-[10px] font-medium ${a.text}`}>{a.label}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-1 text-[10px] text-stone-400 dark:text-stone-500">
                <span><ChefHat className="w-3 h-3 inline mr-0.5" />{order.prep_min_bisher}m bisher</span>
                <span>{order.artikel_anzahl} Artikel</span>
                <span className={`px-1 py-0.5 rounded text-[9px] font-medium ${
                  order.status === 'fertig' ? 'bg-green-100 text-green-700' :
                  order.status === 'in_zubereitung' ? 'bg-blue-100 text-blue-700' :
                  'bg-stone-100 text-stone-500'
                }`}>
                  {order.status === 'fertig' ? 'Fertig' : order.status === 'in_zubereitung' ? 'In Zubereitung' : 'Wartend'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Farb-Legende + Status */}
      <div className="px-4 py-2 flex items-center justify-between bg-stone-50 dark:bg-stone-800 border-t border-stone-100 dark:border-stone-700">
        <div className="flex gap-3">
          {Object.entries(AMPEL).map(([key, val]) => (
            <div key={key} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${val.dot}`} />
              <span className="text-[10px] text-stone-500 dark:text-stone-400">{val.label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-stone-400 dark:text-stone-500">
          <TrendingUp className="w-3 h-3" />
          <span>{data.schicht_vergleich_pct > 0 ? '+' : ''}{data.schicht_vergleich_pct}% vs. gestern</span>
          <span className="ml-2 text-[9px]">↻ {lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
      </div>
    </div>
  );
}

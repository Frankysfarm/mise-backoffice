'use client';

import { useEffect, useRef, useState } from 'react';
import { ChefHat, AlertTriangle, TrendingUp, TrendingDown, Zap, Clock, Target, CheckCircle2, Flame } from 'lucide-react';

interface OrderCountdown {
  order_id: string;
  bestellnummer: string;
  kunde: string;
  prep_start: number;
  target_fertig_min: number;
  verbleibend_sek: number;
  komplexitaet: 'einfach' | 'mittel' | 'komplex';
  station: 'grill' | 'fritteuse' | 'kalt';
  batch_id: string | null;
  status: 'wartend' | 'kochend' | 'kritisch' | 'ueberfaellig' | 'fertig';
  fahrer_eta_min: number | null;
}

interface StationLast {
  name: string;
  auslastung_pct: number;
  aktive_orders: number;
}

interface ApiResponse {
  timing_score: number;
  score_delta: number;
  aktive_orders: number;
  kritische_orders: number;
  fertige_orders: number;
  puenktlichkeit_pct: number;
  orders: OrderCountdown[];
  stationen: StationLast[];
  ki_empfehlung: string | null;
  alert: string | null;
}

const AMPEL_9: Record<string, { bg: string; border: string; text: string; label: string }> = {
  fertig:      { bg: 'bg-green-900/40',   border: 'border-green-600/50',  text: 'text-green-300',  label: 'Fertig' },
  kochend:     { bg: 'bg-blue-900/40',    border: 'border-blue-600/50',   text: 'text-blue-300',   label: 'Kochend' },
  wartend:     { bg: 'bg-slate-800/60',   border: 'border-slate-700/40',  text: 'text-slate-400',  label: 'Wartet' },
  kritisch:    { bg: 'bg-amber-900/40',   border: 'border-amber-600/50',  text: 'text-amber-300',  label: 'Kritisch' },
  ueberfaellig:{ bg: 'bg-red-900/40',     border: 'border-red-600/50',    text: 'text-red-300',    label: 'Überfällig' },
};

const STATION_COLORS: Record<string, string> = {
  grill:     'bg-orange-500',
  fritteuse: 'bg-yellow-500',
  kalt:      'bg-blue-500',
};

const MOCK: ApiResponse = {
  timing_score: 86,
  score_delta: 3,
  aktive_orders: 6,
  kritische_orders: 2,
  fertige_orders: 14,
  puenktlichkeit_pct: 84,
  ki_empfehlung: 'Grill-Station läuft auf 90% — Batch #B3 vorziehen',
  alert: null,
  stationen: [
    { name: 'Grill', auslastung_pct: 90, aktive_orders: 3 },
    { name: 'Fritteuse', auslastung_pct: 65, aktive_orders: 2 },
    { name: 'Kalt', auslastung_pct: 40, aktive_orders: 1 },
  ],
  orders: [
    { order_id: 'o1', bestellnummer: '#1201', kunde: 'Herr Müller', prep_start: Date.now() - 480000, target_fertig_min: 12, verbleibend_sek: 240, komplexitaet: 'komplex', station: 'grill', batch_id: 'B3', status: 'kritisch', fahrer_eta_min: 4 },
    { order_id: 'o2', bestellnummer: '#1202', kunde: 'Frau Schmidt', prep_start: Date.now() - 360000, target_fertig_min: 10, verbleibend_sek: -120, komplexitaet: 'mittel', station: 'fritteuse', batch_id: 'B3', status: 'ueberfaellig', fahrer_eta_min: 2 },
    { order_id: 'o3', bestellnummer: '#1203', kunde: 'Familie Weber', prep_start: Date.now() - 180000, target_fertig_min: 15, verbleibend_sek: 720, komplexitaet: 'komplex', station: 'grill', batch_id: null, status: 'kochend', fahrer_eta_min: 10 },
    { order_id: 'o4', bestellnummer: '#1204', kunde: 'Herr Koch', prep_start: Date.now() - 60000, target_fertig_min: 8, verbleibend_sek: 420, komplexitaet: 'einfach', station: 'kalt', batch_id: null, status: 'kochend', fahrer_eta_min: 7 },
    { order_id: 'o5', bestellnummer: '#1205', kunde: 'Frau Braun', prep_start: Date.now(), target_fertig_min: 12, verbleibend_sek: 720, komplexitaet: 'mittel', station: 'fritteuse', batch_id: null, status: 'wartend', fahrer_eta_min: null },
    { order_id: 'o6', bestellnummer: '#1206', kunde: 'Herr Fischer', prep_start: Date.now(), target_fertig_min: 20, verbleibend_sek: 1200, komplexitaet: 'komplex', station: 'grill', batch_id: 'B4', status: 'wartend', fahrer_eta_min: null },
  ],
};

function fmtSek(s: number): string {
  const abs = Math.abs(Math.round(s));
  const m = Math.floor(abs / 60);
  const sec = abs % 60;
  const sign = s < 0 ? '-' : '';
  return `${sign}${m}:${String(sec).padStart(2, '0')}`;
}

export function KitchenPhase4948SmartTimingCountdownV27({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [tick, setTick] = useState(0);
  const counters = useRef<Record<string, number>>({});

  useEffect(() => {
    data.orders.forEach(o => {
      if (!(o.order_id in counters.current)) {
        counters.current[o.order_id] = o.verbleibend_sek;
      }
    });
  }, [data]);

  useEffect(() => {
    const id = setInterval(() => {
      Object.keys(counters.current).forEach(k => { counters.current[k] -= 1; });
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const url = locationId
          ? `/api/delivery/kitchen/smart-timing-countdown?v=27&location_id=${locationId}`
          : '/api/delivery/kitchen/smart-timing-countdown?v=27';
        const r = await fetch(url, { cache: 'no-store' });
        if (r.ok) {
          const d: ApiResponse = await r.json();
          counters.current = {};
          d.orders.forEach(o => { counters.current[o.order_id] = o.verbleibend_sek; });
          setData(d);
        }
      } catch {}
    }
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [locationId]);

  const sortedOrders = [...data.orders].sort((a, b) => {
    const priority: Record<string, number> = { ueberfaellig: 0, kritisch: 1, kochend: 2, wartend: 3, fertig: 4 };
    return (priority[a.status] ?? 5) - (priority[b.status] ?? 5);
  });

  return (
    <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-4 text-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChefHat className="w-5 h-5 text-indigo-400" />
          <span className="font-bold text-indigo-200">Smart Timing V27</span>
          <span className="text-xs text-slate-500">Countdown · Farbkodierung</span>
        </div>
        <div className="flex items-center gap-2">
          {data.score_delta > 0 ? <TrendingUp className="w-4 h-4 text-green-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
          <span className="text-2xl font-bold tabular-nums text-indigo-300">{data.timing_score}</span>
        </div>
      </div>

      {/* Alert */}
      {data.alert && (
        <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2 text-xs text-red-300 animate-pulse">
          <AlertTriangle className="w-3 h-3 shrink-0" />{data.alert}
        </div>
      )}

      {/* 5-KPI-Grid */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: 'Score', value: String(data.timing_score), color: data.timing_score >= 80 ? 'text-green-400' : data.timing_score >= 60 ? 'text-yellow-400' : 'text-red-400' },
          { label: 'Aktiv', value: String(data.aktive_orders), color: 'text-blue-400' },
          { label: 'Kritisch', value: String(data.kritische_orders), color: data.kritische_orders > 0 ? 'text-amber-400' : 'text-green-400' },
          { label: 'Fertig', value: String(data.fertige_orders), color: 'text-green-400' },
          { label: 'Pünktl', value: `${data.puenktlichkeit_pct}%`, color: data.puenktlichkeit_pct >= 80 ? 'text-green-400' : 'text-yellow-400' },
        ].map(k => (
          <div key={k.label} className="bg-slate-900/60 rounded-lg p-2 text-center border border-slate-800">
            <div className={`text-lg font-bold tabular-nums ${k.color}`}>{k.value}</div>
            <div className="text-xs text-slate-500">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Stationen */}
      <div className="space-y-1.5">
        <div className="text-xs text-slate-500 font-medium flex items-center gap-1"><Flame className="w-3 h-3" />Stationsauslastung</div>
        {data.stationen.map(s => (
          <div key={s.name} className="flex items-center gap-3">
            <span className="text-xs text-slate-400 w-16">{s.name}</span>
            <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${s.name === 'Grill' ? 'bg-orange-500' : s.name === 'Fritteuse' ? 'bg-yellow-500' : 'bg-blue-500'}`}
                style={{ width: `${s.auslastung_pct}%` }}
              />
            </div>
            <span className={`text-xs font-bold w-8 text-right tabular-nums ${s.auslastung_pct >= 85 ? 'text-red-400' : s.auslastung_pct >= 65 ? 'text-yellow-400' : 'text-green-400'}`}>
              {s.auslastung_pct}%
            </span>
            <span className="text-xs text-slate-600 w-12 text-right">{s.aktive_orders} akt.</span>
          </div>
        ))}
      </div>

      {/* KI-Empfehlung */}
      {data.ki_empfehlung && (
        <div className="flex items-start gap-2 bg-indigo-900/20 border border-indigo-700/40 rounded-lg px-3 py-2 text-xs text-indigo-300">
          <Zap className="w-3 h-3 mt-0.5 shrink-0 text-indigo-400" />
          <span>{data.ki_empfehlung}</span>
        </div>
      )}

      {/* Countdown-Kacheln */}
      <div className="space-y-2">
        <div className="text-xs text-slate-500 font-medium flex items-center gap-1"><Clock className="w-3 h-3" />Bestellungen</div>
        {sortedOrders.map(order => {
          const remaining = counters.current[order.order_id] ?? order.verbleibend_sek;
          const style = AMPEL_9[order.status] ?? AMPEL_9['wartend'];
          const pct = order.target_fertig_min > 0
            ? Math.min(100, Math.max(0, Math.round(((order.target_fertig_min * 60 - remaining) / (order.target_fertig_min * 60)) * 100)))
            : 0;
          return (
            <div key={order.order_id} className={`rounded-lg border p-3 ${style.bg} ${style.border}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-white">{order.bestellnummer}</span>
                  {order.batch_id && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-900/60 text-indigo-300">{order.batch_id}</span>
                  )}
                  <span className={`text-xs px-1.5 py-0.5 rounded border ${STATION_COLORS[order.station] ? '' : ''} bg-slate-800/60 text-slate-400`}>
                    {order.station}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {order.fahrer_eta_min !== null && (
                    <span className="text-xs text-blue-400 flex items-center gap-1">
                      <Target className="w-3 h-3" />{order.fahrer_eta_min}min
                    </span>
                  )}
                  <span className={`text-xl font-bold tabular-nums ${style.text}`}>
                    {order.status === 'fertig' ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : fmtSek(remaining)}
                  </span>
                </div>
              </div>
              <div className="h-1.5 bg-slate-800/60 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${order.status === 'ueberfaellig' ? 'bg-red-500 animate-pulse' : order.status === 'kritisch' ? 'bg-amber-500' : order.status === 'fertig' ? 'bg-green-500' : 'bg-blue-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-slate-500">{order.kunde} · {order.komplexitaet}</span>
                <span className={`text-xs font-medium ${style.text}`}>{style.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-xs text-slate-600 text-right">1s-Tick · 15s Polling</div>
    </div>
  );
}

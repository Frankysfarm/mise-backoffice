'use client';

import { useEffect, useRef, useState } from 'react';
import { ChefHat, Timer, Zap, AlertTriangle, CheckCircle2, Flame, TrendingUp, TrendingDown, Activity, Clock, BarChart2, Thermometer } from 'lucide-react';

interface OrderTiming {
  order_id: string;
  bestellnummer: string;
  status: string;
  restzeit_sek: number;
  kochzeit_soll_min: number;
  kochzeit_ist_min: number;
  batch_gruppe: string | null;
  batch_gesamt: number;
  batch_fertig: number;
  komplexitaet: 'hoch' | 'mittel' | 'gering';
  fahrer_eta_min: number | null;
  fahrer_nahe: boolean;
  ampel: 'gruen' | 'hellgruen' | 'gelb' | 'orange' | 'rot' | 'kritisch' | 'super_kritisch' | 'fertig' | 'wartet';
  prioritaet: number;
  station: string;
  effizienz_pct: number;
  ki_kochstart_empfehlung: string | null;
  dringlichkeit_score: number;
  kochzeit_trend: 'besser' | 'gleich' | 'schlechter';
  hitze_score: number;
}

interface StationKpi {
  station: string;
  auslastung_pct: number;
  aktive_orders: number;
  avg_restzeit_sek: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  hitze_level: 'kalt' | 'warm' | 'heiss' | 'kritisch';
  abgeschlossen_heute: number;
}

interface ApiResponse {
  orders: OrderTiming[];
  score: number;
  score_delta: number;
  aktiv: number;
  kritisch: number;
  fertig: number;
  puenktlichkeit_pct: number;
  durchsatz_pro_std: number;
  ki_empfehlung_gesamt: string | null;
  alert: string | null;
  stationen: StationKpi[];
  gesamt_hitze: number;
}

function ampelBg(a: string) {
  if (a === 'super_kritisch') return 'border-red-400 bg-red-900/40 animate-pulse ring-1 ring-red-400/40';
  if (a === 'kritisch') return 'border-red-600 bg-red-950/30 animate-pulse';
  if (a === 'rot') return 'border-red-700 bg-red-950/20';
  if (a === 'orange') return 'border-orange-600 bg-orange-950/20';
  if (a === 'gelb') return 'border-yellow-600 bg-yellow-950/20';
  if (a === 'hellgruen') return 'border-emerald-600 bg-emerald-950/20';
  if (a === 'gruen') return 'border-green-700 bg-green-950/20';
  if (a === 'wartet') return 'border-blue-700 bg-blue-950/15';
  return 'border-slate-700 bg-slate-900/20';
}

function ampelText(a: string) {
  if (a === 'super_kritisch') return 'text-red-200 font-extrabold';
  if (a === 'kritisch') return 'text-red-300 font-bold';
  if (a === 'rot') return 'text-red-400';
  if (a === 'orange') return 'text-orange-400';
  if (a === 'gelb') return 'text-yellow-400';
  if (a === 'hellgruen') return 'text-emerald-400';
  if (a === 'gruen') return 'text-green-400';
  if (a === 'fertig') return 'text-slate-300';
  return 'text-blue-400';
}

function hitzeBg(h: string) {
  if (h === 'kritisch') return 'bg-red-500';
  if (h === 'heiss') return 'bg-orange-500';
  if (h === 'warm') return 'bg-yellow-500';
  return 'bg-blue-400';
}

function fmt(sek: number) {
  if (sek <= 0) return '0:00';
  const m = Math.floor(sek / 60);
  const s = sek % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const MOCK: ApiResponse = {
  score: 84,
  score_delta: 2,
  aktiv: 6,
  kritisch: 2,
  fertig: 14,
  puenktlichkeit_pct: 78,
  durchsatz_pro_std: 11.4,
  ki_empfehlung_gesamt: 'Station Grill überlastet – Batch #3 priorisieren',
  alert: null,
  gesamt_hitze: 72,
  stationen: [
    { station: 'Grill', auslastung_pct: 92, aktive_orders: 4, avg_restzeit_sek: 210, ampel: 'rot', hitze_level: 'kritisch', abgeschlossen_heute: 38 },
    { station: 'Friture', auslastung_pct: 67, aktive_orders: 2, avg_restzeit_sek: 140, ampel: 'gelb', hitze_level: 'heiss', abgeschlossen_heute: 29 },
    { station: 'Kalt', auslastung_pct: 34, aktive_orders: 1, avg_restzeit_sek: 80, ampel: 'gruen', hitze_level: 'warm', abgeschlossen_heute: 21 },
  ],
  orders: [
    { order_id: 'o1', bestellnummer: '#1201', status: 'in_zubereitung', restzeit_sek: 85, kochzeit_soll_min: 8, kochzeit_ist_min: 6, batch_gruppe: 'B3', batch_gesamt: 3, batch_fertig: 1, komplexitaet: 'hoch', fahrer_eta_min: 4, fahrer_nahe: true, ampel: 'kritisch', prioritaet: 1, station: 'Grill', effizienz_pct: 75, ki_kochstart_empfehlung: 'Sofort starten', dringlichkeit_score: 95, kochzeit_trend: 'schlechter', hitze_score: 88 },
    { order_id: 'o2', bestellnummer: '#1202', status: 'in_zubereitung', restzeit_sek: 240, kochzeit_soll_min: 10, kochzeit_ist_min: 6, batch_gruppe: 'B3', batch_gesamt: 3, batch_fertig: 1, komplexitaet: 'mittel', fahrer_eta_min: 12, fahrer_nahe: false, ampel: 'gelb', prioritaet: 2, station: 'Friture', effizienz_pct: 88, ki_kochstart_empfehlung: null, dringlichkeit_score: 60, kochzeit_trend: 'gleich', hitze_score: 55 },
    { order_id: 'o3', bestellnummer: '#1203', status: 'in_zubereitung', restzeit_sek: 520, kochzeit_soll_min: 12, kochzeit_ist_min: 3, batch_gruppe: null, batch_gesamt: 1, batch_fertig: 0, komplexitaet: 'gering', fahrer_eta_min: null, fahrer_nahe: false, ampel: 'gruen', prioritaet: 3, station: 'Kalt', effizienz_pct: 95, ki_kochstart_empfehlung: null, dringlichkeit_score: 30, kochzeit_trend: 'besser', hitze_score: 20 },
    { order_id: 'o4', bestellnummer: '#1204', status: 'fertig', restzeit_sek: 0, kochzeit_soll_min: 9, kochzeit_ist_min: 8, batch_gruppe: 'B2', batch_gesamt: 2, batch_fertig: 2, komplexitaet: 'mittel', fahrer_eta_min: null, fahrer_nahe: false, ampel: 'fertig', prioritaet: 4, station: 'Grill', effizienz_pct: 91, ki_kochstart_empfehlung: null, dringlichkeit_score: 0, kochzeit_trend: 'besser', hitze_score: 0 },
  ],
};

export function KitchenPhase4936SmartTimingCountdownV26() {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [tick, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    tickRef.current = setInterval(() => setTick(t => t + 1), 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch('/api/delivery/kitchen/timing?include_hitze=true', { cache: 'no-store' });
        if (r.ok) setData(await r.json());
      } catch {}
    }
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  const sorted = [...data.orders].sort((a, b) => b.dringlichkeit_score - a.dringlichkeit_score);
  const aktiveOrders = sorted.filter(o => o.status !== 'fertig');

  return (
    <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-4 text-white font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChefHat className="w-5 h-5 text-indigo-400" />
          <span className="font-bold text-base text-indigo-200">Smart-Timing V26</span>
          <span className="text-xs text-slate-500 ml-1">Hitze-Cockpit</span>
        </div>
        <div className="flex items-center gap-2">
          <Thermometer className="w-4 h-4 text-orange-400" />
          <span className="text-sm font-bold text-orange-300">{data.gesamt_hitze}°</span>
          <span className="text-xs text-slate-500">Küchenhitze</span>
        </div>
      </div>

      {/* Alert */}
      {data.alert && (
        <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2 text-xs text-red-300 animate-pulse">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          {data.alert}
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: 'Score', value: data.score, suffix: '', delta: data.score_delta, color: data.score >= 80 ? 'text-green-400' : data.score >= 60 ? 'text-yellow-400' : 'text-red-400' },
          { label: 'Aktiv', value: data.aktiv, suffix: '', delta: null, color: 'text-blue-400' },
          { label: 'Kritisch', value: data.kritisch, suffix: '', delta: null, color: data.kritisch > 0 ? 'text-red-400' : 'text-slate-400' },
          { label: 'Fertig', value: data.fertig, suffix: '', delta: null, color: 'text-emerald-400' },
          { label: 'Pünktl', value: data.puenktlichkeit_pct, suffix: '%', delta: null, color: data.puenktlichkeit_pct >= 80 ? 'text-green-400' : 'text-yellow-400' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-slate-900/60 rounded-lg p-2 text-center border border-slate-800">
            <div className={`text-xl font-bold tabular-nums ${kpi.color}`}>{kpi.value}{kpi.suffix}</div>
            <div className="text-xs text-slate-500 mt-0.5">{kpi.label}</div>
            {kpi.delta !== null && (
              <div className={`text-xs font-medium mt-0.5 ${kpi.delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {kpi.delta >= 0 ? '+' : ''}{kpi.delta}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Station Hitze-Map */}
      <div>
        <div className="flex items-center gap-1 mb-2">
          <Activity className="w-3 h-3 text-slate-400" />
          <span className="text-xs text-slate-400 font-medium">Stationen Hitze-Auslastung</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {data.stationen.map(st => (
            <div key={st.station} className="bg-slate-900/60 rounded-lg p-2 border border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-300">{st.station}</span>
                <span className={`text-xs font-bold ${st.ampel === 'rot' ? 'text-red-400' : st.ampel === 'gelb' ? 'text-yellow-400' : 'text-green-400'}`}>
                  {st.auslastung_pct}%
                </span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-1">
                <div
                  className={`h-full rounded-full transition-all ${hitzeBg(st.hitze_level)}`}
                  style={{ width: `${st.auslastung_pct}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>{st.aktive_orders} aktiv</span>
                <span className={`font-medium ${st.hitze_level === 'kritisch' ? 'text-red-400' : st.hitze_level === 'heiss' ? 'text-orange-400' : st.hitze_level === 'warm' ? 'text-yellow-400' : 'text-blue-400'}`}>
                  {st.hitze_level}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* KI Empfehlung */}
      {data.ki_empfehlung_gesamt && (
        <div className="flex items-start gap-2 bg-indigo-950/40 border border-indigo-800/40 rounded-lg px-3 py-2">
          <Zap className="w-3 h-3 text-indigo-400 mt-0.5 shrink-0" />
          <span className="text-xs text-indigo-300">{data.ki_empfehlung_gesamt}</span>
        </div>
      )}

      {/* Order Countdown Cards */}
      <div className="space-y-2">
        <div className="flex items-center gap-1 mb-1">
          <Timer className="w-3 h-3 text-slate-400" />
          <span className="text-xs text-slate-400 font-medium">Bestellungen ({aktiveOrders.length} aktiv)</span>
        </div>
        {aktiveOrders.map(order => {
          const restSek = Math.max(0, order.restzeit_sek - tick);
          const pct = order.kochzeit_soll_min > 0
            ? Math.min(100, Math.round((1 - restSek / (order.kochzeit_soll_min * 60)) * 100))
            : 100;

          return (
            <div key={order.order_id} className={`rounded-lg border p-3 ${ampelBg(order.ampel)}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${ampelText(order.ampel)}`}>{order.bestellnummer}</span>
                  {order.batch_gruppe && (
                    <span className="text-xs bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">{order.batch_gruppe}</span>
                  )}
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${order.komplexitaet === 'hoch' ? 'bg-red-900/50 text-red-300' : order.komplexitaet === 'mittel' ? 'bg-yellow-900/50 text-yellow-300' : 'bg-green-900/50 text-green-300'}`}>
                    {order.komplexitaet}
                  </span>
                  {order.kochzeit_trend === 'schlechter' && <TrendingDown className="w-3 h-3 text-red-400" />}
                  {order.kochzeit_trend === 'besser' && <TrendingUp className="w-3 h-3 text-green-400" />}
                </div>
                <div className="flex items-center gap-2">
                  {order.fahrer_nahe && <Zap className="w-3.5 h-3.5 text-yellow-400" />}
                  <span className={`text-lg font-mono font-bold tabular-nums ${ampelText(order.ampel)}`}>{fmt(restSek)}</span>
                </div>
              </div>
              <div className="h-1.5 bg-slate-800/60 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all ${order.ampel === 'super_kritisch' || order.ampel === 'kritisch' ? 'bg-red-500' : order.ampel === 'rot' ? 'bg-red-600' : order.ampel === 'orange' ? 'bg-orange-500' : order.ampel === 'gelb' ? 'bg-yellow-500' : 'bg-green-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{order.station} · Eff {order.effizienz_pct}%</span>
                {order.batch_gruppe && <span>{order.batch_fertig}/{order.batch_gesamt} bereit</span>}
                {order.ki_kochstart_empfehlung && (
                  <span className="text-indigo-400">{order.ki_kochstart_empfehlung}</span>
                )}
                {order.fahrer_eta_min && <span className="text-slate-400">Fahrer ~{order.fahrer_eta_min} min</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-slate-600">
        <div className="flex items-center gap-1">
          <BarChart2 className="w-3 h-3" />
          <span>Durchsatz {data.durchsatz_pro_std.toFixed(1)}/h</span>
        </div>
        <span>Live · 15s Polling</span>
      </div>
    </div>
  );
}

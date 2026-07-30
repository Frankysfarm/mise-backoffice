'use client';

import { useEffect, useRef, useState } from 'react';
import { ChefHat, Clock, Flame, TrendingUp, TrendingDown, Zap, AlertTriangle, CheckCircle2, Timer, Activity } from 'lucide-react';

interface OrderTiming {
  order_id: string;
  bestellnummer: string;
  status: string;
  restzeit_sek: number;
  kochzeit_soll_min: number;
  kochzeit_ist_min: number;
  batch_gruppe: string | null;
  komplexitaet: 'hoch' | 'mittel' | 'gering';
  fahrer_eta_min: number | null;
  fahrer_nahe: boolean;
  ampel: 'gruen' | 'hellgruen' | 'gelb' | 'orange' | 'rot' | 'kritisch' | 'super_kritisch' | 'fertig' | 'wartet';
  prioritaet: number;
  ki_empfehlung: string | null;
  prep_fortschritt_pct: number;
}

interface KpiGrid {
  score: number;
  aktiv: number;
  kritisch: number;
  fertig_heute: number;
  puenktlichkeit_pct: number;
}

interface ApiResponse {
  orders: OrderTiming[];
  kpis: KpiGrid;
  alert: string | null;
  ki_gesamt: string | null;
}

const MOCK: ApiResponse = {
  orders: [
    { order_id: '1', bestellnummer: '#1042', status: 'in_zubereitung', restzeit_sek: 240, kochzeit_soll_min: 12, kochzeit_ist_min: 8, batch_gruppe: 'A', komplexitaet: 'hoch', fahrer_eta_min: 5, fahrer_nahe: true, ampel: 'orange', prioritaet: 95, ki_empfehlung: 'Fahrer in 5 Min — bitte fertigstellen!', prep_fortschritt_pct: 67 },
    { order_id: '2', bestellnummer: '#1043', status: 'in_zubereitung', restzeit_sek: 480, kochzeit_soll_min: 10, kochzeit_ist_min: 2, batch_gruppe: 'A', komplexitaet: 'mittel', fahrer_eta_min: 12, fahrer_nahe: false, ampel: 'gruen', prioritaet: 60, ki_empfehlung: null, prep_fortschritt_pct: 20 },
    { order_id: '3', bestellnummer: '#1044', status: 'in_zubereitung', restzeit_sek: 60, kochzeit_soll_min: 8, kochzeit_ist_min: 7, batch_gruppe: null, komplexitaet: 'gering', fahrer_eta_min: 2, fahrer_nahe: true, ampel: 'kritisch', prioritaet: 100, ki_empfehlung: 'JETZT fertigstellen!', prep_fortschritt_pct: 88 },
    { order_id: '4', bestellnummer: '#1041', status: 'fertig', restzeit_sek: 0, kochzeit_soll_min: 9, kochzeit_ist_min: 9, batch_gruppe: 'B', komplexitaet: 'mittel', fahrer_eta_min: 0, fahrer_nahe: true, ampel: 'fertig', prioritaet: 40, ki_empfehlung: null, prep_fortschritt_pct: 100 },
  ],
  kpis: { score: 82, aktiv: 3, kritisch: 1, fertig_heute: 34, puenktlichkeit_pct: 87 },
  alert: null,
  ki_gesamt: 'Batch A: beide Bestellungen gleichzeitig abschließen für Fahrereffizienz',
};

function fmtRestzeit(sek: number): string {
  if (sek <= 0) return '00:00';
  const m = Math.floor(sek / 60);
  const s = sek % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function ampelBorder(a: string) {
  if (a === 'super_kritisch') return 'border-red-400 bg-red-950/50 animate-pulse ring-1 ring-red-400/50';
  if (a === 'kritisch') return 'border-red-500 bg-red-950/40 animate-pulse';
  if (a === 'rot') return 'border-red-700 bg-red-950/25';
  if (a === 'orange') return 'border-orange-500 bg-orange-950/25';
  if (a === 'gelb') return 'border-yellow-500 bg-yellow-950/20';
  if (a === 'hellgruen') return 'border-emerald-500 bg-emerald-950/20';
  if (a === 'gruen') return 'border-green-600 bg-green-950/15';
  if (a === 'fertig') return 'border-slate-600 bg-slate-900/30 opacity-60';
  return 'border-blue-700 bg-blue-950/15';
}

function ampelText(a: string) {
  if (a === 'super_kritisch' || a === 'kritisch') return 'text-red-300 font-bold';
  if (a === 'rot') return 'text-red-400';
  if (a === 'orange') return 'text-orange-400';
  if (a === 'gelb') return 'text-yellow-400';
  if (a === 'hellgruen' || a === 'gruen') return 'text-green-400';
  if (a === 'fertig') return 'text-slate-400';
  return 'text-blue-400';
}

function ampelLabel(a: string) {
  if (a === 'super_kritisch') return '⚠ SUPER KRITISCH';
  if (a === 'kritisch') return '⚠ KRITISCH';
  if (a === 'rot') return 'Eilig';
  if (a === 'orange') return 'Dringend';
  if (a === 'gelb') return 'Normal';
  if (a === 'hellgruen' || a === 'gruen') return 'Gut';
  if (a === 'fertig') return 'Fertig';
  return 'Wartet';
}

function komplexitaetBadge(k: string) {
  if (k === 'hoch') return 'bg-red-900/60 text-red-300 border border-red-700/50';
  if (k === 'mittel') return 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/50';
  return 'bg-green-900/40 text-green-300 border border-green-700/40';
}

export function KitchenPhase5000SmartTimingCountdownV28({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [tick, setTick] = useState(0);
  const [localOrders, setLocalOrders] = useState<OrderTiming[]>([]);
  const tickRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  async function load() {
    if (!locationId) { setData(MOCK); setLocalOrders(MOCK.orders); return; }
    try {
      const res = await fetch(`/api/delivery/kitchen/timing?location_id=${locationId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLocalOrders(json.orders ?? []);
      } else {
        setData(MOCK); setLocalOrders(MOCK.orders);
      }
    } catch {
      setData(MOCK); setLocalOrders(MOCK.orders);
    }
  }

  useEffect(() => {
    load();
    tickRef.current = setInterval(() => {
      setTick(t => t + 1);
      setLocalOrders(prev => prev.map(o => ({
        ...o,
        restzeit_sek: Math.max(0, o.restzeit_sek - 1),
        prep_fortschritt_pct: o.ampel !== 'fertig' && o.kochzeit_soll_min > 0
          ? Math.min(100, 100 - Math.round((Math.max(0, o.restzeit_sek - 1) / (o.kochzeit_soll_min * 60)) * 100))
          : o.prep_fortschritt_pct,
      })));
    }, 1000);
    pollRef.current = setInterval(load, 15_000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const sorted = [...localOrders].sort((a, b) => b.prioritaet - a.prioritaet);
  const aktive = sorted.filter(o => o.ampel !== 'fertig');
  const fertige = sorted.filter(o => o.ampel === 'fertig');

  return (
    <div className="rounded-xl border border-indigo-800/40 bg-slate-950/60 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChefHat className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-semibold text-slate-200">Smart Timing Countdown V28</span>
          <span className="text-xs text-slate-500">Echtzeit · 1-Sek-Tick</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Timer className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs text-slate-500 font-mono">{new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      {/* Alert */}
      {data?.alert && (
        <div className="flex items-center gap-2 rounded-lg border border-red-700/60 bg-red-950/30 px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-xs text-red-300">{data.alert}</span>
        </div>
      )}

      {/* KPI Grid */}
      {data && (
        <div className="grid grid-cols-5 gap-1.5">
          {[
            { label: 'Score', value: `${data.kpis.score}`, icon: <Activity className="w-3 h-3" />, color: data.kpis.score >= 85 ? 'text-green-400' : data.kpis.score >= 70 ? 'text-yellow-400' : 'text-red-400' },
            { label: 'Aktiv', value: `${data.kpis.aktiv}`, icon: <Flame className="w-3 h-3" />, color: 'text-orange-400' },
            { label: 'Kritisch', value: `${data.kpis.kritisch}`, icon: <AlertTriangle className="w-3 h-3" />, color: data.kpis.kritisch > 0 ? 'text-red-400' : 'text-slate-500' },
            { label: 'Fertig', value: `${data.kpis.fertig_heute}`, icon: <CheckCircle2 className="w-3 h-3" />, color: 'text-emerald-400' },
            { label: 'Pünktl.', value: `${data.kpis.puenktlichkeit_pct}%`, icon: <Clock className="w-3 h-3" />, color: data.kpis.puenktlichkeit_pct >= 85 ? 'text-green-400' : 'text-yellow-400' },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-lg bg-slate-900/60 border border-slate-800/60 p-2 text-center">
              <div className={`flex items-center justify-center gap-1 mb-0.5 ${kpi.color}`}>{kpi.icon}</div>
              <div className={`text-base font-bold font-mono ${kpi.color}`}>{kpi.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{kpi.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* KI Empfehlung */}
      {data?.ki_gesamt && (
        <div className="flex items-start gap-2 rounded-lg border border-indigo-800/40 bg-indigo-950/20 px-3 py-2">
          <Zap className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
          <span className="text-xs text-indigo-300">{data.ki_gesamt}</span>
        </div>
      )}

      {/* Aktive Bestellungen */}
      <div className="space-y-2">
        {aktive.map(o => (
          <div key={o.order_id} className={`rounded-xl border p-3 ${ampelBorder(o.ampel)}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-bold text-slate-200 font-mono shrink-0">{o.bestellnummer}</span>
                {o.batch_gruppe && (
                  <span className="text-xs bg-slate-800/80 border border-slate-700/50 text-slate-400 rounded px-1.5 py-0.5">
                    Batch {o.batch_gruppe}
                  </span>
                )}
                <span className={`text-xs rounded px-1.5 py-0.5 ${komplexitaetBadge(o.komplexitaet)}`}>
                  {o.komplexitaet}
                </span>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span className={`text-2xl font-mono font-bold ${ampelText(o.ampel)}`}>
                  {fmtRestzeit(o.restzeit_sek)}
                </span>
                <span className={`text-xs ${ampelText(o.ampel)}`}>{ampelLabel(o.ampel)}</span>
              </div>
            </div>

            {/* Fortschrittsbalken */}
            <div className="mt-2">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Fortschritt</span>
                <span>{o.prep_fortschritt_pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    o.ampel === 'gruen' || o.ampel === 'hellgruen' ? 'bg-green-500' :
                    o.ampel === 'gelb' ? 'bg-yellow-500' :
                    o.ampel === 'orange' ? 'bg-orange-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${o.prep_fortschritt_pct}%` }}
                />
              </div>
            </div>

            {/* Fahrer-Info + KI */}
            <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
              {o.fahrer_eta_min !== null && (
                <div className={`flex items-center gap-1 text-xs ${o.fahrer_nahe ? 'text-amber-400' : 'text-slate-400'}`}>
                  {o.fahrer_nahe ? <Zap className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  <span>Fahrer in {o.fahrer_eta_min} Min</span>
                </div>
              )}
              {o.ki_empfehlung && (
                <div className="flex items-center gap-1 text-xs text-indigo-300">
                  <Zap className="w-3 h-3 shrink-0" />
                  <span>{o.ki_empfehlung}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Fertige Bestellungen (kompakt) */}
      {fertige.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {fertige.map(o => (
            <div key={o.order_id} className="flex items-center gap-1.5 rounded-lg border border-slate-700/40 bg-slate-900/40 px-2.5 py-1.5 opacity-60">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs font-mono text-slate-400">{o.bestellnummer}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

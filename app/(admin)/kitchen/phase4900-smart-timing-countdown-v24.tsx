'use client';

import { useEffect, useRef, useState } from 'react';
import { ChefHat, Timer, AlertTriangle, CheckCircle2, Flame, Zap, Activity, TrendingUp, TrendingDown, Clock } from 'lucide-react';

interface OrderTiming {
  order_id: string;
  bestellnummer: string;
  status: 'in_zubereitung' | 'fertig' | 'warte_fahrer';
  restzeit_sek: number;
  kochzeit_soll_min: number;
  kochzeit_ist_min: number;
  ampel: 'gruen' | 'hellgruen' | 'gelb' | 'orange' | 'rot' | 'kritisch' | 'fertig';
  station: 'grill' | 'friture' | 'kalt' | 'getraenke';
  batch_gruppe: string | null;
  komplexitaet: 1 | 2 | 3;
  fahrer_nahe: boolean;
  effizienz_pct: number;
  trend: 'besser' | 'gleich' | 'schlechter';
}

interface StationLoad {
  station: string;
  auslastung_pct: number;
  aktiv: number;
  avg_effizienz: number;
}

interface ApiResponse {
  orders: OrderTiming[];
  score: number;
  score_delta: number;
  aktiv: number;
  kritisch: number;
  fertig_heute: number;
  puenktlichkeit_pct: number;
  stationen: StationLoad[];
  alert: string | null;
  ki_empfehlung: string | null;
}

const MOCK: ApiResponse = {
  score: 82,
  score_delta: 3,
  aktiv: 5,
  kritisch: 1,
  fertig_heute: 34,
  puenktlichkeit_pct: 79,
  alert: null,
  ki_empfehlung: 'Grill-Station ist nahezu ausgelastet — Friture entlasten.',
  stationen: [
    { station: 'Grill', auslastung_pct: 92, aktiv: 3, avg_effizienz: 74 },
    { station: 'Friture', auslastung_pct: 55, aktiv: 2, avg_effizienz: 88 },
    { station: 'Kalt', auslastung_pct: 30, aktiv: 1, avg_effizienz: 95 },
  ],
  orders: [
    { order_id: 'o1', bestellnummer: '#1091', status: 'in_zubereitung', restzeit_sek: 42, kochzeit_soll_min: 12, kochzeit_ist_min: 14, ampel: 'kritisch', station: 'grill', batch_gruppe: 'B1', komplexitaet: 3, fahrer_nahe: true, effizienz_pct: 68, trend: 'schlechter' },
    { order_id: 'o2', bestellnummer: '#1092', status: 'in_zubereitung', restzeit_sek: 185, kochzeit_soll_min: 10, kochzeit_ist_min: 7, ampel: 'gelb', station: 'friture', batch_gruppe: 'B1', komplexitaet: 2, fahrer_nahe: false, effizienz_pct: 82, trend: 'besser' },
    { order_id: 'o3', bestellnummer: '#1093', status: 'in_zubereitung', restzeit_sek: 330, kochzeit_soll_min: 8, kochzeit_ist_min: 3, ampel: 'gruen', station: 'kalt', batch_gruppe: null, komplexitaet: 1, fahrer_nahe: false, effizienz_pct: 96, trend: 'gleich' },
    { order_id: 'o4', bestellnummer: '#1094', status: 'fertig', restzeit_sek: 0, kochzeit_soll_min: 12, kochzeit_ist_min: 11, ampel: 'fertig', station: 'grill', batch_gruppe: null, komplexitaet: 2, fahrer_nahe: true, effizienz_pct: 91, trend: 'besser' },
    { order_id: 'o5', bestellnummer: '#1095', status: 'in_zubereitung', restzeit_sek: 95, kochzeit_soll_min: 10, kochzeit_ist_min: 8, ampel: 'orange', station: 'friture', batch_gruppe: 'B2', komplexitaet: 2, fahrer_nahe: false, effizienz_pct: 77, trend: 'gleich' },
  ],
};

function fmt(sek: number) {
  if (sek <= 0) return '00:00';
  const m = Math.floor(sek / 60);
  const s = sek % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function ampelBg(a: string) {
  if (a === 'kritisch') return 'border-red-500 bg-red-900/40 animate-pulse';
  if (a === 'rot') return 'border-red-700 bg-red-950/30';
  if (a === 'orange') return 'border-orange-600 bg-orange-950/30';
  if (a === 'gelb') return 'border-yellow-600 bg-yellow-950/25';
  if (a === 'hellgruen') return 'border-emerald-500 bg-emerald-950/20';
  if (a === 'gruen') return 'border-green-600 bg-green-950/25';
  if (a === 'fertig') return 'border-slate-600 bg-slate-800/40';
  return 'border-slate-700 bg-slate-900/20';
}

function ampelText(a: string) {
  if (a === 'kritisch') return 'text-red-300 font-bold';
  if (a === 'rot') return 'text-red-400';
  if (a === 'orange') return 'text-orange-400';
  if (a === 'gelb') return 'text-yellow-400';
  if (a === 'hellgruen') return 'text-emerald-400';
  if (a === 'gruen') return 'text-green-400';
  if (a === 'fertig') return 'text-slate-400';
  return 'text-slate-400';
}

function ampelLabel(a: string) {
  if (a === 'kritisch') return 'KRITISCH';
  if (a === 'rot') return 'Spät';
  if (a === 'orange') return 'Achtung';
  if (a === 'gelb') return 'Knapp';
  if (a === 'hellgruen') return 'OK';
  if (a === 'gruen') return 'Gut';
  if (a === 'fertig') return 'Fertig';
  return '—';
}

const STATION_COLOR: Record<string, string> = {
  grill: 'text-orange-400',
  friture: 'text-yellow-400',
  kalt: 'text-cyan-400',
  getraenke: 'text-blue-400',
};

export function KitchenPhase4900SmartTimingCountdownV24({ locationId }: { locationId?: string }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [tick, setTick] = useState(0);
  const tickRef = useRef(0);

  useEffect(() => {
    const iv = setInterval(() => {
      tickRef.current += 1;
      setTick(tickRef.current);
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!locationId) return;
    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/kitchen/queue?location_id=${locationId}`);
        if (r.ok) {
          const json = await r.json();
          if (json && Array.isArray(json.orders)) setData(json as ApiResponse);
        }
      } catch { /* Mock-Fallback */ }
    };
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const orders = data.orders.filter(o => o.ampel !== 'fertig');
  const fertig = data.orders.filter(o => o.ampel === 'fertig');
  const sorted = [...orders].sort((a, b) => a.restzeit_sek - b.restzeit_sek);

  const effPct = data.puenktlichkeit_pct;
  const scoreColor = data.score >= 85 ? 'text-green-400' : data.score >= 70 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="rounded-xl border border-indigo-800/40 bg-indigo-950/20 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChefHat className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-semibold text-indigo-300">Smart Timing V24</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-base font-bold ${scoreColor}`}>{data.score}</span>
          <span className={`text-xs ${data.score_delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {data.score_delta >= 0 ? '+' : ''}{data.score_delta}
          </span>
        </div>
      </div>

      {/* Alert */}
      {data.alert && (
        <div className="flex items-center gap-2 rounded bg-red-900/30 border border-red-700/40 px-2 py-1">
          <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
          <span className="text-xs text-red-300">{data.alert}</span>
        </div>
      )}

      {/* KI-Empfehlung */}
      {data.ki_empfehlung && (
        <div className="flex items-center gap-2 rounded bg-indigo-900/20 border border-indigo-700/30 px-2 py-1">
          <Zap className="w-3 h-3 text-indigo-400 shrink-0" />
          <span className="text-xs text-indigo-300">{data.ki_empfehlung}</span>
        </div>
      )}

      {/* KPI-Strip */}
      <div className="grid grid-cols-4 gap-1">
        {[
          { label: 'Aktiv', val: data.aktiv, color: 'text-blue-400' },
          { label: 'Kritisch', val: data.kritisch, color: 'text-red-400' },
          { label: 'Fertig', val: data.fertig_heute, color: 'text-green-400' },
          { label: 'Pünktl.', val: `${effPct}%`, color: effPct >= 80 ? 'text-green-400' : effPct >= 60 ? 'text-yellow-400' : 'text-red-400' },
        ].map(k => (
          <div key={k.label} className="rounded bg-slate-900/40 border border-slate-700/30 p-1.5 text-center">
            <div className={`text-sm font-bold ${k.color}`}>{k.val}</div>
            <div className="text-[9px] text-slate-500 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Stationen */}
      <div className="grid grid-cols-3 gap-1">
        {data.stationen.map(st => {
          const loadColor = st.auslastung_pct >= 85 ? 'bg-red-500' : st.auslastung_pct >= 65 ? 'bg-yellow-500' : 'bg-green-500';
          return (
            <div key={st.station} className="rounded bg-slate-900/40 border border-slate-700/30 p-1.5">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] text-slate-400">{st.station}</span>
                <span className="text-[9px] text-slate-500">{st.auslastung_pct}%</span>
              </div>
              <div className="w-full h-1 rounded bg-slate-700/50">
                <div className={`h-1 rounded ${loadColor}`} style={{ width: `${st.auslastung_pct}%` }} />
              </div>
              <div className="text-[9px] text-slate-500 mt-1">Eff. {st.avg_effizienz}%</div>
            </div>
          );
        })}
      </div>

      {/* Order Countdown Cards */}
      <div className="space-y-1">
        {sorted.map(o => {
          const sek = Math.max(0, o.restzeit_sek - tick);
          const progPct = o.kochzeit_soll_min > 0
            ? Math.min(100, ((o.kochzeit_soll_min * 60 - sek) / (o.kochzeit_soll_min * 60)) * 100)
            : 0;
          const progColor = o.ampel === 'kritisch' ? 'bg-red-500' : o.ampel === 'orange' ? 'bg-orange-500' : o.ampel === 'gelb' ? 'bg-yellow-500' : 'bg-green-500';
          return (
            <div key={o.order_id} className={`rounded-lg border p-2 ${ampelBg(o.ampel)}`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-200">{o.bestellnummer}</span>
                  {o.batch_gruppe && (
                    <span className="text-[9px] px-1 rounded bg-indigo-900/50 text-indigo-300 border border-indigo-700/30">{o.batch_gruppe}</span>
                  )}
                  <span className={`text-[9px] ${STATION_COLOR[o.station] ?? 'text-slate-400'}`}>{o.station}</span>
                  {'★'.repeat(o.komplexitaet).padEnd(3, '☆').split('').map((c, i) => (
                    <span key={i} className="text-[8px] text-yellow-500">{c}</span>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  {o.fahrer_nahe && <Zap className="w-3 h-3 text-blue-400" />}
                  {o.trend === 'besser' && <TrendingUp className="w-3 h-3 text-green-400" />}
                  {o.trend === 'schlechter' && <TrendingDown className="w-3 h-3 text-red-400" />}
                  <span className={`text-[9px] font-medium ${ampelText(o.ampel)}`}>{ampelLabel(o.ampel)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-base font-mono font-bold tabular-nums ${ampelText(o.ampel)}`}>
                  {fmt(sek)}
                </span>
                <span className="text-[9px] text-slate-500">Eff. {o.effizienz_pct}%</span>
              </div>
              <div className="w-full h-1 rounded bg-slate-700/50">
                <div className={`h-1 rounded transition-all ${progColor}`} style={{ width: `${progPct}%` }} />
              </div>
            </div>
          );
        })}
        {fertig.length > 0 && (
          <div className="flex items-center gap-1.5 px-1">
            <CheckCircle2 className="w-3 h-3 text-slate-500" />
            <span className="text-[10px] text-slate-500">{fertig.length} fertig — wartet auf Fahrer</span>
          </div>
        )}
      </div>
    </div>
  );
}

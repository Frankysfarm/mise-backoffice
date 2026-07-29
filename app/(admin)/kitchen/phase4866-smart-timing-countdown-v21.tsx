'use client';

import { useEffect, useRef, useState } from 'react';
import { ChefHat, Timer, Zap, AlertTriangle, CheckCircle2, Flame, Users, TrendingUp, Bot, Gauge, Waves } from 'lucide-react';

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
  optimaler_kochstart_delta_sek: number;
  dringlichkeit_score: number;
}

interface StationKpi {
  station: string;
  auslastung_pct: number;
  aktive_orders: number;
  avg_restzeit_sek: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  batch_effizienz_pct: number;
}

interface WaveInfo {
  welle_nr: number;
  orders_count: number;
  start_in_min: number;
  batches: string[];
}

interface ApiResponse {
  orders: OrderTiming[];
  score: number;
  score_delta: number;
  aktiv: number;
  kritisch: number;
  fertig: number;
  puenktlichkeit_pct: number;
  effizienz_gesamt_pct: number;
  ki_empfehlung_gesamt: string | null;
  alert: string | null;
  stationen: StationKpi[];
  naechste_welle: WaveInfo | null;
  batch_gesamt_effizienz_pct: number;
}

function ampelBg(a: string) {
  if (a === 'gruen') return 'border-green-700 bg-green-950/30';
  if (a === 'hellgruen') return 'border-emerald-600 bg-emerald-950/25';
  if (a === 'gelb') return 'border-yellow-700 bg-yellow-950/30';
  if (a === 'orange') return 'border-orange-700 bg-orange-950/30';
  if (a === 'rot') return 'border-red-700 bg-red-950/30';
  if (a === 'kritisch') return 'border-red-500 bg-red-900/40 animate-pulse';
  if (a === 'super_kritisch') return 'border-red-400 bg-red-800/50 animate-pulse ring-1 ring-red-400/60';
  if (a === 'wartet') return 'border-blue-700 bg-blue-950/20';
  return 'border-slate-700 bg-slate-900/30';
}

function ampelText(a: string) {
  if (a === 'gruen') return 'text-green-400';
  if (a === 'hellgruen') return 'text-emerald-400';
  if (a === 'gelb') return 'text-yellow-400';
  if (a === 'orange') return 'text-orange-400';
  if (a === 'rot') return 'text-red-400';
  if (a === 'kritisch') return 'text-red-300 font-bold';
  if (a === 'super_kritisch') return 'text-red-200 font-extrabold';
  if (a === 'wartet') return 'text-blue-300';
  return 'text-slate-400';
}

function ampelLabel(a: string) {
  if (a === 'gruen') return 'OK';
  if (a === 'hellgruen') return 'Gut';
  if (a === 'gelb') return 'Achtung';
  if (a === 'orange') return 'Dringend';
  if (a === 'rot') return 'Spät';
  if (a === 'kritisch') return 'Kritisch';
  if (a === 'super_kritisch') return 'SOFORT';
  if (a === 'fertig') return 'Fertig';
  if (a === 'wartet') return 'Wartet';
  return '—';
}

function formatCountdown(sek: number): string {
  if (sek <= 0) return '00:00';
  const m = Math.floor(sek / 60);
  const s = sek % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function stationColor(a: string) {
  if (a === 'gruen') return 'bg-green-600';
  if (a === 'gelb') return 'bg-yellow-500';
  return 'bg-red-600';
}

function dringlichkeitBadge(score: number) {
  if (score >= 90) return { label: '🔥 SOFORT', cls: 'bg-red-900/70 text-red-200' };
  if (score >= 70) return { label: '⚡ Dringend', cls: 'bg-orange-900/60 text-orange-200' };
  if (score >= 40) return { label: '⏱ Normal', cls: 'bg-slate-800/60 text-slate-300' };
  return { label: '✅ Entspannt', cls: 'bg-green-900/40 text-green-300' };
}

const MOCK: ApiResponse = {
  score: 93,
  score_delta: +3,
  aktiv: 4,
  kritisch: 1,
  fertig: 8,
  puenktlichkeit_pct: 91,
  effizienz_gesamt_pct: 88,
  batch_gesamt_effizienz_pct: 84,
  ki_empfehlung_gesamt: 'Welle 2 in 8 Min — Batch B jetzt vorbereiten',
  alert: null,
  naechste_welle: { welle_nr: 2, orders_count: 5, start_in_min: 8, batches: ['B', 'C'] },
  stationen: [
    { station: 'Grill', auslastung_pct: 75, aktive_orders: 3, avg_restzeit_sek: 190, ampel: 'gelb', batch_effizienz_pct: 82 },
    { station: 'Friture', auslastung_pct: 40, aktive_orders: 1, avg_restzeit_sek: 90, ampel: 'gruen', batch_effizienz_pct: 94 },
    { station: 'Kalt', auslastung_pct: 90, aktive_orders: 2, avg_restzeit_sek: 55, ampel: 'rot', batch_effizienz_pct: 71 },
  ],
  orders: [
    {
      order_id: '1', bestellnummer: '#1070', status: 'in_zubereitung', restzeit_sek: 40,
      kochzeit_soll_min: 12, kochzeit_ist_min: 11.3, batch_gruppe: 'A', batch_gesamt: 3, batch_fertig: 2,
      komplexitaet: 'hoch', fahrer_eta_min: 1, fahrer_nahe: true,
      ampel: 'super_kritisch', prioritaet: 0, station: 'Grill', effizienz_pct: 80,
      ki_kochstart_empfehlung: 'SOFORT fertigstellen!', optimaler_kochstart_delta_sek: -50,
      dringlichkeit_score: 98,
    },
    {
      order_id: '2', bestellnummer: '#1071', status: 'in_zubereitung', restzeit_sek: 210,
      kochzeit_soll_min: 10, kochzeit_ist_min: 6.5, batch_gruppe: 'A', batch_gesamt: 3, batch_fertig: 2,
      komplexitaet: 'mittel', fahrer_eta_min: 6, fahrer_nahe: false,
      ampel: 'gelb', prioritaet: 1, station: 'Friture', effizienz_pct: 93,
      ki_kochstart_empfehlung: null, optimaler_kochstart_delta_sek: 20,
      dringlichkeit_score: 62,
    },
    {
      order_id: '3', bestellnummer: '#1072', status: 'in_zubereitung', restzeit_sek: 540,
      kochzeit_soll_min: 14, kochzeit_ist_min: 5.0, batch_gruppe: null, batch_gesamt: 1, batch_fertig: 0,
      komplexitaet: 'gering', fahrer_eta_min: 16, fahrer_nahe: false,
      ampel: 'gruen', prioritaet: 3, station: 'Kalt', effizienz_pct: 98,
      ki_kochstart_empfehlung: 'Noch 5 Min warten — optimale Synchronisation', optimaler_kochstart_delta_sek: 300,
      dringlichkeit_score: 22,
    },
    {
      order_id: '4', bestellnummer: '#1069', status: 'fertig', restzeit_sek: 0,
      kochzeit_soll_min: 11, kochzeit_ist_min: 10.9, batch_gruppe: 'A', batch_gesamt: 3, batch_fertig: 3,
      komplexitaet: 'mittel', fahrer_eta_min: null, fahrer_nahe: true,
      ampel: 'wartet', prioritaet: 10, station: 'Grill', effizienz_pct: 97,
      ki_kochstart_empfehlung: null, optimaler_kochstart_delta_sek: 0,
      dringlichkeit_score: 0,
    },
  ],
};

export function KitchenPhase4866SmartTimingCountdownV21({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [tick, setTick] = useState(0);
  const tickRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => { tickRef.current += 1; setTick(tickRef.current); }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!locationId) return;
    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/kitchen/smart-timing?location_id=${locationId}`);
        if (r.ok) { const j = await r.json(); if (!j.error) setData(j); }
      } catch { /* mock fallback */ }
    };
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [locationId]);

  const orders = [...data.orders].sort((a, b) => a.prioritaet - b.prioritaet);

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between bg-indigo-950/30">
        <div className="flex items-center gap-2">
          <ChefHat className="w-5 h-5 text-indigo-400" />
          <span className="text-sm font-semibold text-indigo-300">Smart-Timing Countdown V21</span>
          <span className="text-[10px] px-1.5 py-0.5 bg-indigo-800/50 text-indigo-300 rounded-full">Wellen-Erkennung</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">Score</span>
          <span className={`text-lg font-extrabold ${data.score >= 85 ? 'text-green-400' : data.score >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
            {data.score}
          </span>
          <span className={`text-xs font-semibold ${data.score_delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {data.score_delta >= 0 ? '+' : ''}{data.score_delta}
          </span>
        </div>
      </div>

      {/* KI-Empfehlung */}
      {data.ki_empfehlung_gesamt && (
        <div className="px-4 py-2 bg-indigo-950/40 border-b border-indigo-800/40 flex items-center gap-2">
          <Bot className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="text-xs text-indigo-200">{data.ki_empfehlung_gesamt}</span>
        </div>
      )}

      {/* Nächste Welle */}
      {data.naechste_welle && (
        <div className="px-4 py-2 bg-purple-950/30 border-b border-purple-800/30 flex items-center gap-2">
          <Waves className="w-4 h-4 text-purple-400 shrink-0" />
          <span className="text-xs text-purple-200">
            Welle {data.naechste_welle.welle_nr} in <strong>{data.naechste_welle.start_in_min} Min</strong> — {data.naechste_welle.orders_count} Bestellungen, Batches {data.naechste_welle.batches.join(', ')}
          </span>
        </div>
      )}

      {/* Alert */}
      {data.alert && (
        <div className="px-4 py-2 bg-red-950/40 border-b border-red-800/40 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-xs text-red-300">{data.alert}</span>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-5 divide-x divide-slate-700 border-b border-slate-700">
        {[
          { label: 'Aktiv', val: data.aktiv, icon: <Flame className="w-3 h-3" />, color: 'text-orange-400' },
          { label: 'Kritisch', val: data.kritisch, icon: <AlertTriangle className="w-3 h-3" />, color: 'text-red-400' },
          { label: 'Fertig', val: data.fertig, icon: <CheckCircle2 className="w-3 h-3" />, color: 'text-green-400' },
          { label: 'Pünktl.', val: `${data.puenktlichkeit_pct}%`, icon: <Timer className="w-3 h-3" />, color: 'text-blue-400' },
          { label: 'Batch-Eff.', val: `${data.batch_gesamt_effizienz_pct}%`, icon: <Gauge className="w-3 h-3" />, color: 'text-purple-400' },
        ].map(k => (
          <div key={k.label} className="flex flex-col items-center py-2 gap-0.5">
            <div className={`${k.color}`}>{k.icon}</div>
            <span className={`text-sm font-bold ${k.color}`}>{k.val}</span>
            <span className="text-[10px] text-slate-500">{k.label}</span>
          </div>
        ))}
      </div>

      {/* Stations with Batch Efficiency */}
      <div className="grid grid-cols-3 gap-2 px-4 py-3 border-b border-slate-700/60">
        {data.stationen.map(st => (
          <div key={st.station} className="bg-slate-800/50 rounded-lg px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-300">{st.station}</span>
              <span className={`text-xs font-bold ${st.ampel === 'gruen' ? 'text-green-400' : st.ampel === 'gelb' ? 'text-yellow-400' : 'text-red-400'}`}>
                {st.aktive_orders}×
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden mb-1">
              <div className={`h-full rounded-full transition-all ${stationColor(st.ampel)}`} style={{ width: `${st.auslastung_pct}%` }} />
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] text-slate-500">{st.auslastung_pct}%</span>
              <span className="text-[10px] text-purple-400">Batch {st.batch_effizienz_pct}%</span>
            </div>
          </div>
        ))}
      </div>

      {/* Order Cards with Urgency Score */}
      <div className="divide-y divide-slate-800/60">
        {orders.map(o => {
          const sek = Math.max(0, o.restzeit_sek - tick);
          const urgency = dringlichkeitBadge(o.dringlichkeit_score);
          return (
            <div key={o.order_id} className={`px-4 py-3 border-l-4 ${ampelBg(o.ampel)} border-l-current`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">{o.bestellnummer}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-800/60 ${ampelText(o.ampel)}`}>
                      {ampelLabel(o.ampel)}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${urgency.cls}`}>
                      {urgency.label}
                    </span>
                    {o.batch_gruppe && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700/60 text-slate-300">
                        Batch {o.batch_gruppe} {o.batch_fertig}/{o.batch_gesamt}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-500">{o.station}</span>
                    {o.fahrer_nahe && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-900/60 text-blue-300 flex items-center gap-1">
                        <Zap className="w-2.5 h-2.5" /> Fahrer da
                      </span>
                    )}
                  </div>
                  {o.status !== 'fertig' && (
                    <div className="mt-2 h-1 rounded-full bg-slate-700/60 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${ampelText(o.ampel).replace('text-', 'bg-').replace(' font-bold', '').replace(' font-extrabold', '')}`}
                        style={{ width: `${Math.min(100, (1 - sek / (o.kochzeit_soll_min * 60)) * 100)}%` }}
                      />
                    </div>
                  )}
                  {o.ki_kochstart_empfehlung && (
                    <div className="mt-1.5 flex items-center gap-1">
                      <Bot className="w-3 h-3 text-indigo-400 shrink-0" />
                      <span className="text-[10px] text-indigo-300">{o.ki_kochstart_empfehlung}</span>
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-xl font-mono font-bold tabular-nums ${ampelText(o.ampel)}`}>
                    {o.status === 'fertig' ? '✓' : formatCountdown(sek)}
                  </div>
                  {o.fahrer_eta_min !== null && (
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Fahrer {o.fahrer_eta_min} Min
                    </div>
                  )}
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Eff. {o.effizienz_pct}%
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-slate-700 flex items-center gap-2 bg-slate-800/30">
        <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
        <span className="text-xs text-slate-400">Gesamt-Effizienz <span className="text-purple-300 font-semibold">{data.effizienz_gesamt_pct}%</span></span>
        <Users className="w-3 h-3 text-slate-500 ml-auto" />
        <span className="text-[10px] text-slate-500">{locationId ?? 'Demo'}</span>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { ChefHat, Timer, Zap, AlertTriangle, CheckCircle2, Flame, Bot, Gauge, Waves, TrendingUp, Activity } from 'lucide-react';

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
}

interface StationKpi {
  station: string;
  auslastung_pct: number;
  aktive_orders: number;
  avg_restzeit_sek: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  batch_effizienz_pct: number;
  abgeschlossen_heute: number;
  stress_score: number;
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
  wellen_aktiv: boolean;
}

function ampelBg(a: string) {
  if (a === 'super_kritisch') return 'border-red-400 bg-red-800/50 animate-pulse ring-1 ring-red-400/60';
  if (a === 'kritisch') return 'border-red-500 bg-red-900/40 animate-pulse';
  if (a === 'rot') return 'border-red-700 bg-red-950/30';
  if (a === 'orange') return 'border-orange-700 bg-orange-950/30';
  if (a === 'gelb') return 'border-yellow-700 bg-yellow-950/30';
  if (a === 'hellgruen') return 'border-emerald-600 bg-emerald-950/25';
  if (a === 'gruen') return 'border-green-700 bg-green-950/30';
  if (a === 'wartet') return 'border-blue-700 bg-blue-950/20';
  return 'border-slate-700 bg-slate-900/30';
}

function ampelText(a: string) {
  if (a === 'super_kritisch') return 'text-red-200 font-extrabold';
  if (a === 'kritisch') return 'text-red-300 font-bold';
  if (a === 'rot') return 'text-red-400';
  if (a === 'orange') return 'text-orange-400';
  if (a === 'gelb') return 'text-yellow-400';
  if (a === 'hellgruen') return 'text-emerald-400';
  if (a === 'gruen') return 'text-green-400';
  if (a === 'wartet') return 'text-blue-300';
  return 'text-slate-400';
}

function ampelLabel(a: string) {
  if (a === 'super_kritisch') return 'SOFORT';
  if (a === 'kritisch') return 'Kritisch';
  if (a === 'rot') return 'Spät';
  if (a === 'orange') return 'Dringend';
  if (a === 'gelb') return 'Achtung';
  if (a === 'hellgruen') return 'Gut';
  if (a === 'gruen') return 'OK';
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

function stressColor(score: number) {
  if (score >= 80) return 'text-red-400';
  if (score >= 50) return 'text-yellow-400';
  return 'text-green-400';
}

function stressBar(score: number) {
  if (score >= 80) return 'bg-red-500';
  if (score >= 50) return 'bg-yellow-500';
  return 'bg-green-500';
}

function komplexitaetBadge(k: string) {
  if (k === 'hoch') return 'bg-red-900/50 text-red-300';
  if (k === 'mittel') return 'bg-orange-900/50 text-orange-300';
  return 'bg-slate-800/50 text-slate-400';
}

const MOCK: ApiResponse = {
  score: 93,
  score_delta: +2,
  aktiv: 5,
  kritisch: 2,
  fertig: 13,
  puenktlichkeit_pct: 90,
  durchsatz_pro_std: 15,
  ki_empfehlung_gesamt: 'Grill unter Stress — Verteilung auf Friture prüfen',
  alert: null,
  wellen_aktiv: true,
  stationen: [
    { station: 'Grill',   auslastung_pct: 88, aktive_orders: 4, avg_restzeit_sek: 200, ampel: 'rot',   batch_effizienz_pct: 76, abgeschlossen_heute: 45, stress_score: 87 },
    { station: 'Friture', auslastung_pct: 52, aktive_orders: 2, avg_restzeit_sek: 105, ampel: 'gelb',  batch_effizienz_pct: 91, abgeschlossen_heute: 33, stress_score: 48 },
    { station: 'Kalt',    auslastung_pct: 28, aktive_orders: 1, avg_restzeit_sek: 55,  ampel: 'gruen', batch_effizienz_pct: 98, abgeschlossen_heute: 19, stress_score: 22 },
  ],
  orders: [
    {
      order_id: '1', bestellnummer: '#1090', status: 'in_zubereitung', restzeit_sek: 28,
      kochzeit_soll_min: 12, kochzeit_ist_min: 11.7, batch_gruppe: 'A', batch_gesamt: 4, batch_fertig: 3,
      komplexitaet: 'hoch', fahrer_eta_min: 1, fahrer_nahe: true,
      ampel: 'super_kritisch', prioritaet: 0, station: 'Grill', effizienz_pct: 75,
      ki_kochstart_empfehlung: 'SOFORT fertigstellen — Fahrer wartet!', dringlichkeit_score: 99,
    },
    {
      order_id: '2', bestellnummer: '#1091', status: 'in_zubereitung', restzeit_sek: 195,
      kochzeit_soll_min: 10, kochzeit_ist_min: 6.8, batch_gruppe: 'A', batch_gesamt: 4, batch_fertig: 3,
      komplexitaet: 'mittel', fahrer_eta_min: 6, fahrer_nahe: false,
      ampel: 'orange', prioritaet: 1, station: 'Friture', effizienz_pct: 93,
      ki_kochstart_empfehlung: null, dringlichkeit_score: 72,
    },
    {
      order_id: '3', bestellnummer: '#1092', status: 'in_zubereitung', restzeit_sek: 440,
      kochzeit_soll_min: 14, kochzeit_ist_min: 6.8, batch_gruppe: null, batch_gesamt: 1, batch_fertig: 0,
      komplexitaet: 'gering', fahrer_eta_min: 20, fahrer_nahe: false,
      ampel: 'gruen', prioritaet: 3, station: 'Kalt', effizienz_pct: 99,
      ki_kochstart_empfehlung: 'Noch 5 Min warten — optimale Synchronisation', dringlichkeit_score: 15,
    },
    {
      order_id: '4', bestellnummer: '#1089', status: 'fertig', restzeit_sek: 0,
      kochzeit_soll_min: 11, kochzeit_ist_min: 11.0, batch_gruppe: 'A', batch_gesamt: 4, batch_fertig: 4,
      komplexitaet: 'mittel', fahrer_eta_min: null, fahrer_nahe: true,
      ampel: 'wartet', prioritaet: 10, station: 'Grill', effizienz_pct: 97,
      ki_kochstart_empfehlung: null, dringlichkeit_score: 0,
    },
  ],
};

export function KitchenPhase4885SmartTimingCountdownV23({ locationId }: { locationId: string | null }) {
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
  const bestStation = [...data.stationen].sort((a, b) => b.abgeschlossen_heute - a.abgeschlossen_heute)[0];
  const highestStress = [...data.stationen].sort((a, b) => b.stress_score - a.stress_score)[0];

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between bg-indigo-950/30">
        <div className="flex items-center gap-2">
          <ChefHat className="w-5 h-5 text-indigo-400" />
          <span className="text-sm font-semibold text-indigo-300">Smart-Timing Countdown V23</span>
          {data.wellen_aktiv && (
            <span className="text-[10px] px-1.5 py-0.5 bg-purple-800/50 text-purple-300 rounded-full flex items-center gap-1">
              <Waves className="w-2.5 h-2.5" /> Wellen aktiv
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Gauge className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-400">{data.durchsatz_pro_std}/h</span>
          <span className={`text-lg font-extrabold ml-2 ${data.score >= 85 ? 'text-green-400' : data.score >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
            {data.score}
          </span>
          <span className={`text-xs ${data.score_delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {data.score_delta >= 0 ? '+' : ''}{data.score_delta}
          </span>
        </div>
      </div>

      {/* KI + Alert */}
      {data.ki_empfehlung_gesamt && (
        <div className="px-4 py-2 bg-indigo-950/40 border-b border-indigo-800/40 flex items-center gap-2">
          <Bot className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="text-xs text-indigo-200">{data.ki_empfehlung_gesamt}</span>
        </div>
      )}
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
          { label: 'Tempo', val: `${data.durchsatz_pro_std}/h`, icon: <TrendingUp className="w-3 h-3" />, color: 'text-emerald-400' },
        ].map(k => (
          <div key={k.label} className="flex flex-col items-center py-2 gap-0.5">
            <div className={k.color}>{k.icon}</div>
            <span className={`text-sm font-bold ${k.color}`}>{k.val}</span>
            <span className="text-[10px] text-slate-500">{k.label}</span>
          </div>
        ))}
      </div>

      {/* Station Competition + Stress */}
      <div className="px-4 py-3 border-b border-slate-700/60">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-slate-300">Station-Wettbewerb + Stress-Score</span>
          {bestStation && (
            <span className="text-[10px] px-1.5 py-0.5 bg-yellow-900/50 text-yellow-300 rounded-full">
              🏆 {bestStation.station}
            </span>
          )}
          {highestStress && highestStress.stress_score >= 80 && (
            <span className="text-[10px] px-1.5 py-0.5 bg-red-900/50 text-red-300 rounded-full flex items-center gap-1">
              <Activity className="w-2.5 h-2.5" /> Stress: {highestStress.station}
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {data.stationen.map(st => {
            const isBest = st.station === bestStation?.station;
            return (
              <div key={st.station} className={`bg-slate-800/50 rounded-lg px-3 py-2 ${isBest ? 'ring-1 ring-yellow-500/50' : ''}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-300">{st.station}</span>
                  <span className="text-xs font-bold text-yellow-400">{st.abgeschlossen_heute}×</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden mb-1">
                  <div className={`h-full rounded-full ${stationColor(st.ampel)}`} style={{ width: `${st.auslastung_pct}%` }} />
                </div>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-slate-500">{st.auslastung_pct}% Last</span>
                  <span className="text-purple-400">Eff {st.batch_effizienz_pct}%</span>
                </div>
                {/* Stress-Score (new in V23) */}
                <div className="flex items-center gap-1">
                  <Activity className={`w-2.5 h-2.5 shrink-0 ${stressColor(st.stress_score)}`} />
                  <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${stressBar(st.stress_score)}`} style={{ width: `${st.stress_score}%` }} />
                  </div>
                  <span className={`text-[10px] ${stressColor(st.stress_score)}`}>{st.stress_score}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Order Cards */}
      <div className="divide-y divide-slate-800/60">
        {orders.map(o => {
          const sek = Math.max(0, o.restzeit_sek - tick);
          return (
            <div key={o.order_id} className={`px-4 py-3 border-l-4 ${ampelBg(o.ampel)}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                  <span className="text-sm font-bold text-white">{o.bestellnummer}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800/60 ${ampelText(o.ampel)}`}>
                    {ampelLabel(o.ampel)}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${komplexitaetBadge(o.komplexitaet)}`}>
                    {o.komplexitaet}
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
                  <span className={`text-lg font-mono font-bold tabular-nums shrink-0 ${ampelText(o.ampel)}`}>
                    {formatCountdown(sek)}
                  </span>
                )}
              </div>
              {o.ki_kochstart_empfehlung && (
                <div className="mt-1.5 text-[10px] text-indigo-300 flex items-center gap-1">
                  <Bot className="w-3 h-3 shrink-0" />
                  {o.ki_kochstart_empfehlung}
                </div>
              )}
              {o.status !== 'fertig' && (
                <div className="mt-1.5 h-1 bg-slate-800/60 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-none ${ampelText(o.ampel).includes('red') ? 'bg-red-500' : 'bg-indigo-500'}`}
                    style={{ width: `${Math.max(0, Math.min(100, 100 - (sek / (o.kochzeit_soll_min * 60)) * 100))}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 flex items-center justify-between bg-slate-800/20">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <Timer className="w-3 h-3" />
          <span>1-Sek-Tick · 15-Sek-Polling · Stress-Score</span>
        </div>
        <span className="text-[10px] text-slate-500">{locationId ?? 'Demo'}</span>
      </div>
    </div>
  );
}

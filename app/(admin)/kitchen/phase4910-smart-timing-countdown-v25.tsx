'use client';

import { useEffect, useRef, useState } from 'react';
import { ChefHat, Timer, Zap, AlertTriangle, CheckCircle2, Flame, Bot, TrendingUp, TrendingDown, Activity, Clock, BarChart2 } from 'lucide-react';

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
}

interface StationKpi {
  station: string;
  auslastung_pct: number;
  aktive_orders: number;
  avg_restzeit_sek: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  batch_effizienz_pct: number;
  abgeschlossen_heute: number;
  kochzeit_trend_min: number;
}

interface PriorityQueueItem {
  order_id: string;
  bestellnummer: string;
  prioritaet_score: number;
  grund: string;
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
  prioritaets_queue: PriorityQueueItem[];
  batch_sync_pct: number;
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

function ampelBarColor(a: string) {
  if (a === 'super_kritisch' || a === 'kritisch' || a === 'rot') return 'bg-red-500';
  if (a === 'orange') return 'bg-orange-500';
  if (a === 'gelb') return 'bg-yellow-500';
  return 'bg-indigo-500';
}

function formatCountdown(sek: number): string {
  if (sek <= 0) return '00:00';
  const m = Math.floor(sek / 60);
  const s = sek % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function stationAuslastungColor(pct: number) {
  if (pct >= 85) return 'bg-red-500';
  if (pct >= 65) return 'bg-yellow-500';
  return 'bg-green-500';
}

function trendIcon(trend: string) {
  if (trend === 'besser') return <TrendingDown className="w-3 h-3 text-green-400" />;
  if (trend === 'schlechter') return <TrendingUp className="w-3 h-3 text-red-400" />;
  return <Activity className="w-3 h-3 text-slate-400" />;
}

const MOCK: ApiResponse = {
  score: 88,
  score_delta: +3,
  aktiv: 6,
  kritisch: 2,
  fertig: 17,
  puenktlichkeit_pct: 87,
  durchsatz_pro_std: 18,
  ki_empfehlung_gesamt: 'Grill-Station überlastet — 2 Aufträge auf Friture verschieben',
  alert: null,
  batch_sync_pct: 91,
  stationen: [
    { station: 'Grill',   auslastung_pct: 91, aktive_orders: 5, avg_restzeit_sek: 185, ampel: 'rot',   batch_effizienz_pct: 74, abgeschlossen_heute: 48, kochzeit_trend_min: +1.2 },
    { station: 'Friture', auslastung_pct: 55, aktive_orders: 2, avg_restzeit_sek: 110, ampel: 'gelb',  batch_effizienz_pct: 89, abgeschlossen_heute: 36, kochzeit_trend_min: -0.5 },
    { station: 'Kalt',    auslastung_pct: 30, aktive_orders: 1, avg_restzeit_sek: 60,  ampel: 'gruen', batch_effizienz_pct: 97, abgeschlossen_heute: 22, kochzeit_trend_min: 0 },
  ],
  prioritaets_queue: [
    { order_id: '1', bestellnummer: '#1093', prioritaet_score: 99, grund: 'Fahrer wartet bereits 2 Min' },
    { order_id: '2', bestellnummer: '#1094', prioritaet_score: 82, grund: 'Batch-Gruppe fast komplett' },
    { order_id: '3', bestellnummer: '#1095', prioritaet_score: 61, grund: 'ETA überschritten +3 Min' },
  ],
  orders: [
    {
      order_id: '1', bestellnummer: '#1093', status: 'in_zubereitung', restzeit_sek: 45,
      kochzeit_soll_min: 12, kochzeit_ist_min: 11.2, batch_gruppe: 'B', batch_gesamt: 3, batch_fertig: 2,
      komplexitaet: 'hoch', fahrer_eta_min: 1, fahrer_nahe: true,
      ampel: 'super_kritisch', prioritaet: 0, station: 'Grill', effizienz_pct: 72,
      ki_kochstart_empfehlung: 'SOFORT: Fahrer wartet — alle anderen pausieren',
      dringlichkeit_score: 99, kochzeit_trend: 'schlechter',
    },
    {
      order_id: '2', bestellnummer: '#1094', status: 'in_zubereitung', restzeit_sek: 210,
      kochzeit_soll_min: 10, kochzeit_ist_min: 6.5, batch_gruppe: 'B', batch_gesamt: 3, batch_fertig: 2,
      komplexitaet: 'mittel', fahrer_eta_min: 8, fahrer_nahe: false,
      ampel: 'orange', prioritaet: 1, station: 'Friture', effizienz_pct: 91,
      ki_kochstart_empfehlung: null, dringlichkeit_score: 76, kochzeit_trend: 'besser',
    },
    {
      order_id: '3', bestellnummer: '#1095', status: 'in_zubereitung', restzeit_sek: 520,
      kochzeit_soll_min: 15, kochzeit_ist_min: 6.3, batch_gruppe: null, batch_gesamt: 1, batch_fertig: 0,
      komplexitaet: 'gering', fahrer_eta_min: 22, fahrer_nahe: false,
      ampel: 'gruen', prioritaet: 3, station: 'Kalt', effizienz_pct: 98,
      ki_kochstart_empfehlung: 'Noch 8 Min — perfekte Sync-Zeit',
      dringlichkeit_score: 18, kochzeit_trend: 'gleich',
    },
    {
      order_id: '4', bestellnummer: '#1092', status: 'fertig', restzeit_sek: 0,
      kochzeit_soll_min: 11, kochzeit_ist_min: 10.8, batch_gruppe: 'B', batch_gesamt: 3, batch_fertig: 3,
      komplexitaet: 'mittel', fahrer_eta_min: null, fahrer_nahe: true,
      ampel: 'wartet', prioritaet: 10, station: 'Grill', effizienz_pct: 98,
      ki_kochstart_empfehlung: null, dringlichkeit_score: 0, kochzeit_trend: 'besser',
    },
  ],
};

export function KitchenPhase4910SmartTimingCountdownV25({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [tick, setTick] = useState(0);
  const tickRef = useRef(0);
  const [showQueue, setShowQueue] = useState(false);

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
          <span className="text-sm font-semibold text-indigo-300">Smart-Timing Countdown V25</span>
          <span className="text-[10px] px-1.5 py-0.5 bg-indigo-900/50 text-indigo-300 rounded-full">
            Batch-Sync {data.batch_sync_pct}%
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-xl font-extrabold ${data.score >= 85 ? 'text-green-400' : data.score >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
            {data.score}
          </span>
          <span className={`text-xs ${data.score_delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {data.score_delta >= 0 ? '+' : ''}{data.score_delta}
          </span>
        </div>
      </div>

      {/* KI-Empfehlung */}
      {data.ki_empfehlung_gesamt && (
        <div className="px-4 py-2 bg-indigo-950/40 border-b border-indigo-800/30 flex items-center gap-2">
          <Bot className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="text-xs text-indigo-200">{data.ki_empfehlung_gesamt}</span>
        </div>
      )}

      {/* Alert */}
      {data.alert && (
        <div className="px-4 py-2 bg-red-950/40 border-b border-red-700/40 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-xs text-red-300">{data.alert}</span>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-5 divide-x divide-slate-700/70 border-b border-slate-700">
        {[
          { label: 'Aktiv', val: data.aktiv, color: 'text-orange-400', Icon: Flame },
          { label: 'Kritisch', val: data.kritisch, color: 'text-red-400', Icon: AlertTriangle },
          { label: 'Fertig', val: data.fertig, color: 'text-green-400', Icon: CheckCircle2 },
          { label: 'Pünktl.', val: `${data.puenktlichkeit_pct}%`, color: 'text-blue-400', Icon: Timer },
          { label: 'Tempo', val: `${data.durchsatz_pro_std}/h`, color: 'text-emerald-400', Icon: TrendingUp },
        ].map(k => (
          <div key={k.label} className="flex flex-col items-center py-2.5 gap-0.5">
            <k.Icon className={`w-3 h-3 ${k.color}`} />
            <span className={`text-sm font-bold ${k.color}`}>{k.val}</span>
            <span className="text-[10px] text-slate-500">{k.label}</span>
          </div>
        ))}
      </div>

      {/* Stationen mit Kochzeit-Trend */}
      <div className="px-4 py-3 border-b border-slate-700/50">
        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Stationen · Auslastung + Kochzeit-Trend
        </div>
        <div className="grid grid-cols-3 gap-2">
          {data.stationen.map(st => (
            <div key={st.station} className="bg-slate-800/50 rounded-xl px-3 py-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">{st.station}</span>
                <div className="flex items-center gap-1">
                  {trendIcon(st.kochzeit_trend_min > 0.5 ? 'schlechter' : st.kochzeit_trend_min < -0.3 ? 'besser' : 'gleich')}
                  <span className={`text-[10px] ${st.kochzeit_trend_min > 0.5 ? 'text-red-400' : st.kochzeit_trend_min < -0.3 ? 'text-green-400' : 'text-slate-400'}`}>
                    {st.kochzeit_trend_min > 0 ? '+' : ''}{st.kochzeit_trend_min.toFixed(1)}min
                  </span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${stationAuslastungColor(st.auslastung_pct)}`}
                  style={{ width: `${st.auslastung_pct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-500">{st.auslastung_pct}% Last</span>
                <span className="text-purple-400">Batch {st.batch_effizienz_pct}%</span>
              </div>
              <div className="text-[10px] text-yellow-400">{st.abgeschlossen_heute}× heute</div>
            </div>
          ))}
        </div>
      </div>

      {/* Prioritäts-Queue (aufklappbar) */}
      <div className="border-b border-slate-700/50">
        <button
          onClick={() => setShowQueue(p => !p)}
          className="w-full px-4 py-2 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <BarChart2 className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-xs font-semibold text-slate-300">Prioritäts-Queue</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-indigo-900/50 text-indigo-300 rounded-full">
              {data.prioritaets_queue.length}
            </span>
          </div>
          <span className="text-[10px] text-slate-500">{showQueue ? '▲' : '▼'}</span>
        </button>
        {showQueue && (
          <div className="px-4 pb-3 space-y-1.5">
            {data.prioritaets_queue.map((q, i) => (
              <div key={q.order_id} className="flex items-center gap-3 bg-slate-800/40 rounded-lg px-3 py-2">
                <span className={`text-sm font-bold w-5 text-center ${i === 0 ? 'text-red-400' : i === 1 ? 'text-orange-400' : 'text-yellow-400'}`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white">{q.bestellnummer}</div>
                  <div className="text-[10px] text-slate-400 truncate">{q.grund}</div>
                </div>
                <div className="h-5 w-12 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${q.prioritaet_score >= 90 ? 'bg-red-500' : q.prioritaet_score >= 70 ? 'bg-orange-500' : 'bg-yellow-500'}`}
                    style={{ width: `${q.prioritaet_score}%` }}
                  />
                </div>
                <span className={`text-xs font-bold tabular-nums ${q.prioritaet_score >= 90 ? 'text-red-400' : q.prioritaet_score >= 70 ? 'text-orange-400' : 'text-yellow-400'}`}>
                  {q.prioritaet_score}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Order-Countdown-Kacheln */}
      <div className="divide-y divide-slate-800/50">
        {orders.map(o => {
          const sek = Math.max(0, o.restzeit_sek - tick);
          const fortschritt = o.status === 'fertig' ? 100 : Math.min(100, 100 - (sek / (o.kochzeit_soll_min * 60)) * 100);
          return (
            <div key={o.order_id} className={`px-4 py-3 border-l-4 ${ampelBg(o.ampel)}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-bold text-white">{o.bestellnummer}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800/60 ${ampelText(o.ampel)}`}>
                      {ampelLabel(o.ampel)}
                    </span>
                    <span className="text-[10px] text-slate-500">{o.station}</span>
                    {o.batch_gruppe && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700/60 text-slate-300">
                        Batch {o.batch_gruppe} {o.batch_fertig}/{o.batch_gesamt}
                      </span>
                    )}
                    {o.fahrer_nahe && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-900/60 text-blue-300 flex items-center gap-1">
                        <Zap className="w-2.5 h-2.5" /> Fahrer da
                      </span>
                    )}
                    <div className="flex items-center gap-0.5">
                      {trendIcon(o.kochzeit_trend)}
                    </div>
                  </div>
                  {o.ki_kochstart_empfehlung && (
                    <div className="mt-1 text-[10px] text-indigo-300 flex items-center gap-1">
                      <Bot className="w-3 h-3 shrink-0" />
                      {o.ki_kochstart_empfehlung}
                    </div>
                  )}
                </div>
                {o.status !== 'fertig' ? (
                  <span className={`text-lg font-mono font-bold tabular-nums shrink-0 ${ampelText(o.ampel)}`}>
                    {formatCountdown(sek)}
                  </span>
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                )}
              </div>
              {o.status !== 'fertig' && (
                <div className="mt-2 h-1 bg-slate-800/60 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-none ${ampelBarColor(o.ampel)}`}
                    style={{ width: `${fortschritt}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 flex items-center justify-between bg-slate-800/20">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <Clock className="w-3 h-3" />
          <span>1-Sek-Tick · 15-Sek-Polling · Kochzeit-Trend · Prioritäts-Queue · Mock-Fallback</span>
        </div>
        <span className="text-[10px] text-slate-500">{locationId ?? 'Demo'}</span>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { ChefHat, Clock, Flame, TrendingUp, TrendingDown, Zap, AlertTriangle, CheckCircle2, Layers, Target } from 'lucide-react';

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
  station: 'grill' | 'friture' | 'kalt' | 'pasta';
  rentabilitaet: 'hoch' | 'mittel' | 'niedrig';
}

interface BatchInfo {
  gruppe: string;
  orders: string[];
  gesamt_pct: number;
  effizienz_score: number;
  fahrer_name: string | null;
}

interface KpiGrid {
  score: number;
  aktiv: number;
  kritisch: number;
  fertig_heute: number;
  puenktlichkeit_pct: number;
  batch_effizienz_pct: number;
}

interface ApiResponse {
  orders: OrderTiming[];
  batches: BatchInfo[];
  kpis: KpiGrid;
  alert: string | null;
  ki_gesamt: string | null;
}

const MOCK: ApiResponse = {
  orders: [
    {
      order_id: '1', bestellnummer: '#1042', status: 'in_zubereitung', restzeit_sek: 195,
      kochzeit_soll_min: 12, kochzeit_ist_min: 9, batch_gruppe: 'A', komplexitaet: 'hoch',
      fahrer_eta_min: 4, fahrer_nahe: true, ampel: 'orange', prioritaet: 95,
      ki_empfehlung: 'Batch A: Fahrer kommt in 4 Min!', prep_fortschritt_pct: 73,
      station: 'grill', rentabilitaet: 'hoch',
    },
    {
      order_id: '2', bestellnummer: '#1043', status: 'in_zubereitung', restzeit_sek: 420,
      kochzeit_soll_min: 10, kochzeit_ist_min: 3, batch_gruppe: 'A', komplexitaet: 'mittel',
      fahrer_eta_min: 4, fahrer_nahe: false, ampel: 'gelb', prioritaet: 70,
      ki_empfehlung: null, prep_fortschritt_pct: 30,
      station: 'friture', rentabilitaet: 'mittel',
    },
    {
      order_id: '3', bestellnummer: '#1044', status: 'in_zubereitung', restzeit_sek: 55,
      kochzeit_soll_min: 8, kochzeit_ist_min: 7, batch_gruppe: null, komplexitaet: 'gering',
      fahrer_eta_min: 1, fahrer_nahe: true, ampel: 'kritisch', prioritaet: 100,
      ki_empfehlung: 'SOFORT abschließen!', prep_fortschritt_pct: 91,
      station: 'kalt', rentabilitaet: 'niedrig',
    },
    {
      order_id: '4', bestellnummer: '#1041', status: 'fertig', restzeit_sek: 0,
      kochzeit_soll_min: 9, kochzeit_ist_min: 9, batch_gruppe: 'B', komplexitaet: 'mittel',
      fahrer_eta_min: 0, fahrer_nahe: true, ampel: 'fertig', prioritaet: 40,
      ki_empfehlung: null, prep_fortschritt_pct: 100,
      station: 'pasta', rentabilitaet: 'hoch',
    },
    {
      order_id: '5', bestellnummer: '#1045', status: 'in_zubereitung', restzeit_sek: 660,
      kochzeit_soll_min: 15, kochzeit_ist_min: 4, batch_gruppe: 'B', komplexitaet: 'hoch',
      fahrer_eta_min: 18, fahrer_nahe: false, ampel: 'gruen', prioritaet: 45,
      ki_empfehlung: null, prep_fortschritt_pct: 27,
      station: 'grill', rentabilitaet: 'hoch',
    },
  ],
  batches: [
    { gruppe: 'A', orders: ['#1042', '#1043'], gesamt_pct: 52, effizienz_score: 78, fahrer_name: 'Jonas M.' },
    { gruppe: 'B', orders: ['#1041', '#1045'], gesamt_pct: 64, effizienz_score: 85, fahrer_name: 'Sara K.' },
  ],
  kpis: { score: 84, aktiv: 4, kritisch: 1, fertig_heute: 37, puenktlichkeit_pct: 89, batch_effizienz_pct: 82 },
  alert: null,
  ki_gesamt: 'Batch A unter Zeitdruck — Priorität auf Station Grill+Friture legen',
};

function fmt(sek: number): string {
  if (sek <= 0) return '00:00';
  const m = Math.floor(sek / 60);
  const s = sek % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function ampelBg(a: string) {
  if (a === 'super_kritisch') return 'border-red-400 bg-red-950/60 animate-pulse ring-1 ring-red-400/60';
  if (a === 'kritisch') return 'border-red-500 bg-red-950/40 animate-pulse';
  if (a === 'rot') return 'border-red-600 bg-red-950/25';
  if (a === 'orange') return 'border-orange-500 bg-orange-950/25';
  if (a === 'gelb') return 'border-yellow-500 bg-yellow-950/20';
  if (a === 'hellgruen') return 'border-emerald-400 bg-emerald-950/20';
  if (a === 'gruen') return 'border-green-600 bg-green-950/15';
  if (a === 'fertig') return 'border-slate-600 bg-slate-900/30 opacity-55';
  return 'border-blue-700 bg-blue-950/15';
}

function ampelTxt(a: string) {
  if (a === 'super_kritisch' || a === 'kritisch') return 'text-red-300 font-bold';
  if (a === 'rot') return 'text-red-400';
  if (a === 'orange') return 'text-orange-400';
  if (a === 'gelb') return 'text-yellow-400';
  if (a === 'hellgruen' || a === 'gruen') return 'text-green-400';
  if (a === 'fertig') return 'text-slate-400';
  return 'text-blue-400';
}

function rentBadge(r: string) {
  if (r === 'hoch') return 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/40';
  if (r === 'mittel') return 'bg-yellow-900/40 text-yellow-300 border border-yellow-700/40';
  return 'bg-slate-800/60 text-slate-400 border border-slate-600/40';
}

function stationLabel(s: string) {
  if (s === 'grill') return '🔥 Grill';
  if (s === 'friture') return '🍟 Fritteuse';
  if (s === 'kalt') return '🥗 Kalt';
  return '🍝 Pasta';
}

function scoreColor(v: number) {
  if (v >= 85) return 'text-green-400';
  if (v >= 70) return 'text-yellow-400';
  return 'text-red-400';
}

export function KitchenPhase5005SmartTimingCountdownV29() {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<'orders' | 'batches'>('orders');
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    tickRef.current = setInterval(() => {
      setTick((t) => t + 1);
      setData((prev) => ({
        ...prev,
        orders: prev.orders.map((o) =>
          o.status !== 'fertig' && o.restzeit_sek > 0
            ? { ...o, restzeit_sek: Math.max(0, o.restzeit_sek - 1) }
            : o,
        ),
      }));
    }, 1000);

    const poll = async () => {
      try {
        const res = await fetch('/api/delivery/admin/smart-timing-countdown', { cache: 'no-store' });
        if (res.ok) setData(await res.json());
      } catch {
        // Mock bleibt
      }
    };
    poll();
    pollRef.current = setInterval(poll, 15_000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const kpis = data.kpis;
  const sorted = [...data.orders].sort((a, b) => b.prioritaet - a.prioritaet);

  return (
    <div className="rounded-xl border border-indigo-700/40 bg-gradient-to-b from-indigo-950/60 to-slate-900/80 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChefHat className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-semibold text-indigo-300">Smart-Timing V29</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-lg font-bold ${scoreColor(kpis.score)}`}>{kpis.score}</span>
          <span className="text-xs text-slate-500">Score</span>
        </div>
      </div>

      {/* Alert */}
      {data.alert && (
        <div className="flex items-center gap-2 rounded-lg border border-red-600/50 bg-red-950/40 px-2.5 py-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          <span className="text-xs text-red-300">{data.alert}</span>
        </div>
      )}

      {/* KI Gesamt */}
      {data.ki_gesamt && (
        <div className="flex items-start gap-2 rounded-lg border border-indigo-600/40 bg-indigo-950/40 px-2.5 py-1.5">
          <Zap className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
          <span className="text-xs text-indigo-200">{data.ki_gesamt}</span>
        </div>
      )}

      {/* KPI Grid 6er */}
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { label: 'Score', value: kpis.score, unit: '', color: scoreColor(kpis.score) },
          { label: 'Aktiv', value: kpis.aktiv, unit: '', color: 'text-blue-400' },
          { label: 'Kritisch', value: kpis.kritisch, unit: '', color: kpis.kritisch > 0 ? 'text-red-400' : 'text-green-400' },
          { label: 'Fertig', value: kpis.fertig_heute, unit: '', color: 'text-slate-300' },
          { label: 'Pünktl.', value: kpis.puenktlichkeit_pct, unit: '%', color: kpis.puenktlichkeit_pct >= 85 ? 'text-green-400' : 'text-yellow-400' },
          { label: 'Batch-Eff.', value: kpis.batch_effizienz_pct, unit: '%', color: kpis.batch_effizienz_pct >= 80 ? 'text-emerald-400' : 'text-yellow-400' },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-2 py-1.5 text-center">
            <div className={`text-base font-bold tabular-nums ${k.color}`}>{k.value}{k.unit}</div>
            <div className="text-[10px] text-slate-500">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tab Nav */}
      <div className="flex gap-1">
        {(['orders', 'batches'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md py-1 text-xs font-medium transition-colors ${
              tab === t ? 'bg-indigo-600 text-white' : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            {t === 'orders' ? `Bestellungen (${data.orders.filter(o => o.status !== 'fertig').length})` : `Batches (${data.batches.length})`}
          </button>
        ))}
      </div>

      {/* Orders Tab */}
      {tab === 'orders' && (
        <div className="space-y-2">
          {sorted.map((o) => (
            <div key={o.order_id} className={`rounded-lg border p-2.5 ${ampelBg(o.ampel)}`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-100">{o.bestellnummer}</span>
                  <span className="text-[10px] text-slate-400">{stationLabel(o.station)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${rentBadge(o.rentabilitaet)}`}>
                    {o.rentabilitaet === 'hoch' ? '↑ Hoch' : o.rentabilitaet === 'mittel' ? '~ Mittel' : '↓ Niedrig'}
                  </span>
                  {o.batch_gruppe && (
                    <span className="text-[10px] bg-violet-900/50 text-violet-300 border border-violet-700/40 px-1.5 py-0.5 rounded-full">
                      Batch {o.batch_gruppe}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between mb-1.5">
                <div className={`text-2xl font-mono font-bold tabular-nums ${ampelTxt(o.ampel)}`}>
                  {o.status === 'fertig' ? <CheckCircle2 className="w-6 h-6 text-slate-400 inline" /> : fmt(o.restzeit_sek)}
                </div>
                <div className="text-right">
                  {o.fahrer_nahe && (
                    <div className="flex items-center gap-1 text-amber-400">
                      <Zap className="w-3 h-3" />
                      <span className="text-[10px] font-semibold">Fahrer {o.fahrer_eta_min}min</span>
                    </div>
                  )}
                  <div className="text-[10px] text-slate-500">
                    {o.kochzeit_ist_min}/{o.kochzeit_soll_min} min
                  </div>
                </div>
              </div>

              {/* Fortschrittsbalken */}
              {o.status !== 'fertig' && (
                <div className="w-full h-1.5 bg-slate-700/60 rounded-full overflow-hidden mb-1.5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      o.ampel === 'kritisch' || o.ampel === 'super_kritisch' ? 'bg-red-500' :
                      o.ampel === 'orange' ? 'bg-orange-500' :
                      o.ampel === 'gelb' ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${o.prep_fortschritt_pct}%` }}
                  />
                </div>
              )}

              {o.ki_empfehlung && (
                <div className="flex items-start gap-1 mt-1">
                  <Flame className="w-3 h-3 text-orange-400 flex-shrink-0 mt-0.5" />
                  <span className="text-[10px] text-orange-300">{o.ki_empfehlung}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Batches Tab */}
      {tab === 'batches' && (
        <div className="space-y-2">
          {data.batches.map((b) => (
            <div key={b.gruppe} className="rounded-lg border border-violet-700/40 bg-violet-950/30 p-2.5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-violet-400" />
                  <span className="text-xs font-bold text-violet-200">Batch {b.gruppe}</span>
                  {b.fahrer_name && (
                    <span className="text-[10px] text-slate-400">→ {b.fahrer_name}</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Target className="w-3 h-3 text-violet-400" />
                  <span className="text-xs font-semibold text-violet-300">{b.effizienz_score}</span>
                </div>
              </div>
              <div className="flex gap-1 flex-wrap mb-2">
                {b.orders.map((nr) => (
                  <span key={nr} className="text-[10px] bg-slate-800/60 text-slate-300 border border-slate-600/40 px-1.5 py-0.5 rounded-md">
                    {nr}
                  </span>
                ))}
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                  <span>Gesamt-Fortschritt</span>
                  <span>{b.gesamt_pct}%</span>
                </div>
                <div className="w-full h-2 bg-slate-700/60 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      b.gesamt_pct >= 80 ? 'bg-green-500' : b.gesamt_pct >= 50 ? 'bg-yellow-500' : 'bg-orange-500'
                    }`}
                    style={{ width: `${b.gesamt_pct}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
          {data.batches.length === 0 && (
            <div className="text-center py-4 text-slate-500 text-xs">Keine aktiven Batches</div>
          )}
        </div>
      )}

      <div className="text-[9px] text-slate-600 text-right">
        Tick {tick} · 15s-Polling · Mock-Fallback
      </div>
    </div>
  );
}

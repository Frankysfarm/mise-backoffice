'use client';

import { useEffect, useRef, useState } from 'react';
import { ChefHat, Clock, Zap, AlertTriangle, CheckCircle2, Flame, TrendingUp, Target, Layers } from 'lucide-react';

interface StationCountdown {
  station: 'grill' | 'friture' | 'kalt' | 'pasta';
  label: string;
  emoji: string;
  orders: OrderRow[];
}

interface OrderRow {
  id: string;
  nr: string;
  restzeit_sek: number;
  kochzeit_soll_min: number;
  ampel: 'gruen' | 'gelb' | 'orange' | 'rot' | 'kritisch' | 'fertig';
  batch: string | null;
  fahrer_eta_min: number | null;
  prio: number;
  kommentar: string | null;
}

interface SchichtKpi {
  score: number;
  fertig_heute: number;
  puenktlichkeit_pct: number;
  akt_durchsatz_ph: number;
  kritisch_count: number;
  batch_eff_pct: number;
}

interface ApiData {
  stationen: StationCountdown[];
  kpis: SchichtKpi;
  naechstes_fertig: string | null;
  alert: string | null;
}

const MOCK: ApiData = {
  kpis: { score: 86, fertig_heute: 41, puenktlichkeit_pct: 91, akt_durchsatz_ph: 23, kritisch_count: 1, batch_eff_pct: 84 },
  naechstes_fertig: '#1044',
  alert: null,
  stationen: [
    {
      station: 'grill', label: 'Grill', emoji: '🔥',
      orders: [
        { id: '1', nr: '#1042', restzeit_sek: 210, kochzeit_soll_min: 12, ampel: 'orange', batch: 'A', fahrer_eta_min: 5, prio: 90, kommentar: 'Batch A — Eile!' },
        { id: '2', nr: '#1045', restzeit_sek: 540, kochzeit_soll_min: 15, ampel: 'gruen', batch: 'B', fahrer_eta_min: 18, prio: 45, kommentar: null },
      ],
    },
    {
      station: 'friture', label: 'Fritteuse', emoji: '🍟',
      orders: [
        { id: '3', nr: '#1043', restzeit_sek: 75, kochzeit_soll_min: 8, ampel: 'kritisch', batch: null, fahrer_eta_min: 1, prio: 100, kommentar: 'SOFORT!' },
      ],
    },
    {
      station: 'kalt', label: 'Kalt', emoji: '🥗',
      orders: [
        { id: '4', nr: '#1044', restzeit_sek: 20, kochzeit_soll_min: 5, ampel: 'kritisch', batch: 'A', fahrer_eta_min: 1, prio: 100, kommentar: null },
        { id: '5', nr: '#1046', restzeit_sek: 300, kochzeit_soll_min: 6, ampel: 'gelb', batch: null, fahrer_eta_min: 8, prio: 60, kommentar: null },
      ],
    },
    {
      station: 'pasta', label: 'Pasta', emoji: '🍝',
      orders: [
        { id: '6', nr: '#1041', restzeit_sek: 0, kochzeit_soll_min: 9, ampel: 'fertig', batch: 'B', fahrer_eta_min: 0, prio: 30, kommentar: null },
      ],
    },
  ],
};

function fmt(sek: number) {
  if (sek <= 0) return '00:00';
  const m = Math.floor(sek / 60);
  const s = sek % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function ampelBorder(a: string) {
  if (a === 'kritisch') return 'border-red-500 bg-red-950/50 animate-pulse ring-1 ring-red-500/40';
  if (a === 'rot') return 'border-red-600 bg-red-950/30';
  if (a === 'orange') return 'border-orange-500 bg-orange-950/25';
  if (a === 'gelb') return 'border-yellow-500 bg-yellow-950/20';
  if (a === 'gruen') return 'border-green-600 bg-green-950/15';
  if (a === 'fertig') return 'border-slate-700/40 bg-slate-800/30 opacity-50';
  return 'border-slate-700/40 bg-slate-800/20';
}

function ampelText(a: string) {
  if (a === 'kritisch' || a === 'rot') return 'text-red-300 font-bold';
  if (a === 'orange') return 'text-orange-300 font-semibold';
  if (a === 'gelb') return 'text-yellow-300';
  if (a === 'gruen') return 'text-green-400';
  if (a === 'fertig') return 'text-slate-500';
  return 'text-slate-300';
}

function scoreColor(v: number) {
  if (v >= 85) return 'text-green-400';
  if (v >= 70) return 'text-yellow-400';
  return 'text-red-400';
}

export function KitchenPhase5023SmartTimingFarbkodierungV30() {
  const [data, setData] = useState<ApiData>(MOCK);
  const [tick, setTick] = useState(0);
  const [activeStation, setActiveStation] = useState<string>('all');
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    tickRef.current = setInterval(() => {
      setTick((t) => t + 1);
      setData((prev) => ({
        ...prev,
        stationen: prev.stationen.map((st) => ({
          ...st,
          orders: st.orders.map((o) =>
            o.ampel !== 'fertig' && o.restzeit_sek > 0
              ? { ...o, restzeit_sek: Math.max(0, o.restzeit_sek - 1) }
              : o,
          ),
        })),
      }));
    }, 1000);

    const poll = async () => {
      try {
        const res = await fetch('/api/delivery/admin/smart-timing-farbkodierung', { cache: 'no-store' });
        if (res.ok) setData(await res.json());
      } catch { /* Mock bleibt */ }
    };
    poll();
    pollRef.current = setInterval(poll, 15_000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const allOrders = data.stationen.flatMap((st) => st.orders);
  const kritischCount = allOrders.filter((o) => o.ampel === 'kritisch' || o.ampel === 'rot').length;
  const stations = activeStation === 'all' ? data.stationen : data.stationen.filter((s) => s.station === activeStation);

  return (
    <div className="rounded-xl border border-indigo-700/40 bg-gradient-to-b from-slate-900/90 to-indigo-950/50 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChefHat className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-semibold text-indigo-300">Smart-Timing V30</span>
          {kritischCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 animate-pulse">
              <AlertTriangle className="w-3 h-3" /> {kritischCount} kritisch
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-lg font-bold tabular-nums ${scoreColor(data.kpis.score)}`}>{data.kpis.score}</span>
          <span className="text-[10px] text-slate-500">Score</span>
        </div>
      </div>

      {/* Alert */}
      {data.alert && (
        <div className="flex items-center gap-2 rounded-lg border border-red-600/50 bg-red-950/40 px-2.5 py-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          <span className="text-xs text-red-300">{data.alert}</span>
        </div>
      )}

      {/* Nächstes fertig */}
      {data.naechstes_fertig && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-700/40 bg-emerald-950/30 px-2.5 py-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <span className="text-xs text-emerald-300">
            Nächstes fertig: <span className="font-bold">{data.naechstes_fertig}</span>
          </span>
        </div>
      )}

      {/* KPI 6er Grid */}
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { label: 'Score', v: data.kpis.score, unit: '', color: scoreColor(data.kpis.score) },
          { label: 'Fertig', v: data.kpis.fertig_heute, unit: '', color: 'text-slate-300' },
          { label: 'Kritisch', v: data.kpis.kritisch_count, unit: '', color: data.kpis.kritisch_count > 0 ? 'text-red-400' : 'text-green-400' },
          { label: 'Pünktl.', v: data.kpis.puenktlichkeit_pct, unit: '%', color: data.kpis.puenktlichkeit_pct >= 85 ? 'text-green-400' : 'text-yellow-400' },
          { label: 'Durchsatz', v: data.kpis.akt_durchsatz_ph, unit: '/h', color: 'text-blue-400' },
          { label: 'Batch-Eff.', v: data.kpis.batch_eff_pct, unit: '%', color: data.kpis.batch_eff_pct >= 80 ? 'text-emerald-400' : 'text-yellow-400' },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-2 py-1.5 text-center">
            <div className={`text-sm font-bold tabular-nums ${k.color}`}>{k.v}{k.unit}</div>
            <div className="text-[10px] text-slate-500">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Station Filter */}
      <div className="flex gap-1 flex-wrap">
        {[{ key: 'all', label: 'Alle', emoji: '' }, ...data.stationen.map((s) => ({ key: s.station, label: s.label, emoji: s.emoji }))].map((opt) => (
          <button
            key={opt.key}
            onClick={() => setActiveStation(opt.key)}
            className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors ${
              activeStation === opt.key ? 'bg-indigo-600 text-white' : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            {opt.emoji} {opt.label}
          </button>
        ))}
      </div>

      {/* Stationsweise Anzeige */}
      <div className="space-y-3">
        {stations.map((st) => (
          <div key={st.station}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-sm">{st.emoji}</span>
              <span className="text-xs font-semibold text-slate-300">{st.label}</span>
              <span className="text-[10px] text-slate-500">({st.orders.length})</span>
            </div>
            <div className="space-y-1.5">
              {[...st.orders].sort((a, b) => b.prio - a.prio).map((o) => (
                <div key={o.id} className={`rounded-lg border p-2 ${ampelBorder(o.ampel)}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-100">{o.nr}</span>
                      {o.batch && (
                        <span className="text-[10px] bg-violet-900/50 text-violet-300 border border-violet-700/40 px-1 py-0.5 rounded">
                          Batch {o.batch}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {o.fahrer_eta_min !== null && o.fahrer_eta_min <= 5 && o.ampel !== 'fertig' && (
                        <div className="flex items-center gap-0.5 text-amber-400">
                          <Zap className="w-3 h-3" />
                          <span className="text-[10px] font-semibold">{o.fahrer_eta_min}min</span>
                        </div>
                      )}
                      <span className={`text-lg font-mono font-bold tabular-nums ${ampelText(o.ampel)}`}>
                        {o.ampel === 'fertig' ? <CheckCircle2 className="w-5 h-5 text-slate-500 inline" /> : fmt(o.restzeit_sek)}
                      </span>
                    </div>
                  </div>

                  {o.ampel !== 'fertig' && (
                    <div className="mt-1.5 w-full h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          o.ampel === 'kritisch' || o.ampel === 'rot' ? 'bg-red-500' :
                          o.ampel === 'orange' ? 'bg-orange-500' :
                          o.ampel === 'gelb' ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, 100 - (o.restzeit_sek / (o.kochzeit_soll_min * 60)) * 100))}%` }}
                      />
                    </div>
                  )}

                  {o.kommentar && (
                    <div className="flex items-center gap-1 mt-1">
                      <Flame className="w-3 h-3 text-orange-400 flex-shrink-0" />
                      <span className="text-[10px] text-orange-300">{o.kommentar}</span>
                    </div>
                  )}
                </div>
              ))}
              {st.orders.length === 0 && (
                <div className="text-center py-2 text-slate-600 text-[10px]">Keine aktiven Bestellungen</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-[9px] text-slate-600">
        <span className="flex items-center gap-1">
          <Target className="w-3 h-3" /> Stationsbasiert · 15s-Polling
        </span>
        <span>Tick {tick}</span>
      </div>
    </div>
  );
}

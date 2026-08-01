'use client';

import { useEffect, useRef, useState } from 'react';
import { Timer, Flame, Zap, ChefHat, AlertTriangle, CheckCircle2, Brain, TrendingUp, Target, Clock, Route } from 'lucide-react';

// Phase 5420 — Smart-Timing Countdown V52
// Neu: SLA-Ampel Küche→Fahrer Sync; Durchsatz-Prognose nächste 30 Min;
// Fahrer-Nähe-Indikator je aktiver Bestellung; Batch-Übergabe-Score;
// 8-KPI-Grid Aktiv/Kritisch/Überfällig/Fertig/Fahrer↑/Batch-Score/SLA/Velocity;
// 3-Tab Countdown/SLA/Prognose; Farbkodierung 6-stufig;
// 1s-Tick + 15s-Polling; Mock-Fallback

type OrderState = 'queued' | 'ok' | 'warn' | 'critical' | 'overdue' | 'done';
type Tab = 'countdown' | 'sla' | 'prognose';

interface KitchenOrder {
  id: string;
  bestellnummer: string;
  station: string;
  prep_started_at: string | null;
  prep_target_min: number;
  fahrer_eta_min: number | null;
  batch_id: string | null;
  status: 'in_progress' | 'ready' | 'queued';
  prio_score: number;
  sla_target_min: number;
  fahrer_naehe_km: number | null;
  batch_uebergabe_score: number;
}

interface SlaZone {
  label: string;
  count: number;
  avg_min: number;
  target_min: number;
  ok: boolean;
}

interface ApiResponse {
  orders: KitchenOrder[];
  velocity: number;
  kritisch_count: number;
  ueberfaellig_count: number;
  fertig_count: number;
  fahrer_unterwegs: number;
  batch_score: number;
  sla_quote_pct: number;
  prognose_30min: number;
  sla_zonen: SlaZone[];
  timestamp: string;
}

const MOCK: ApiResponse = {
  velocity: 31,
  kritisch_count: 2,
  ueberfaellig_count: 1,
  fertig_count: 11,
  fahrer_unterwegs: 3,
  batch_score: 87,
  sla_quote_pct: 92,
  prognose_30min: 14,
  timestamp: new Date().toISOString(),
  sla_zonen: [
    { label: 'Innenstadt',  count: 12, avg_min: 22, target_min: 25, ok: true  },
    { label: 'Nordviertel', count: 6,  avg_min: 28, target_min: 25, ok: false },
    { label: 'Westpark',    count: 4,  avg_min: 24, target_min: 30, ok: true  },
  ],
  orders: [
    { id: 'o1', bestellnummer: '#1301', station: 'Grill',   prep_started_at: new Date(Date.now() - 9  * 60_000).toISOString(), prep_target_min: 12, fahrer_eta_min: 4,  batch_id: 'B1', status: 'in_progress', prio_score: 88, sla_target_min: 25, fahrer_naehe_km: 0.8, batch_uebergabe_score: 91 },
    { id: 'o2', bestellnummer: '#1302', station: 'Friture', prep_started_at: new Date(Date.now() - 4  * 60_000).toISOString(), prep_target_min: 10, fahrer_eta_min: 9,  batch_id: 'B1', status: 'in_progress', prio_score: 55, sla_target_min: 25, fahrer_naehe_km: 2.1, batch_uebergabe_score: 78 },
    { id: 'o3', bestellnummer: '#1303', station: 'Kalt',    prep_started_at: null,                                              prep_target_min: 6,  fahrer_eta_min: 11, batch_id: 'B2', status: 'queued',      prio_score: 32, sla_target_min: 30, fahrer_naehe_km: null, batch_uebergabe_score: 65 },
    { id: 'o4', bestellnummer: '#1304', station: 'Pasta',   prep_started_at: new Date(Date.now() - 14 * 60_000).toISOString(), prep_target_min: 13, fahrer_eta_min: 2,  batch_id: 'B2', status: 'in_progress', prio_score: 95, sla_target_min: 25, fahrer_naehe_km: 0.3, batch_uebergabe_score: 96 },
    { id: 'o5', bestellnummer: '#1305', station: 'Ofen',    prep_started_at: null,                                              prep_target_min: 15, fahrer_eta_min: 14, batch_id: 'B3', status: 'queued',      prio_score: 27, sla_target_min: 30, fahrer_naehe_km: null, batch_uebergabe_score: 54 },
  ],
};

function getOrderState(o: KitchenOrder, nowMs: number): OrderState {
  if (o.status === 'ready') return 'done';
  if (!o.prep_started_at) return 'queued';
  const elapsedMin = (nowMs - new Date(o.prep_started_at).getTime()) / 60_000;
  const remaining = o.prep_target_min - elapsedMin;
  if (remaining < 0)     return 'overdue';
  if (remaining < 2)     return 'critical';
  if (remaining < 5)     return 'warn';
  return 'ok';
}

const STATE_COLORS: Record<OrderState, string> = {
  queued:   'border-zinc-200 bg-zinc-50 text-zinc-600',
  ok:       'border-emerald-300 bg-emerald-50 text-emerald-800',
  warn:     'border-amber-300 bg-amber-50 text-amber-800',
  critical: 'border-orange-400 bg-orange-50 text-orange-900',
  overdue:  'border-red-400 bg-red-50 text-red-900 animate-pulse',
  done:     'border-matcha-200 bg-matcha-50 text-matcha-700',
};

const STATE_LABELS: Record<OrderState, string> = {
  queued: 'Warteschlange', ok: 'OK', warn: 'Bald', critical: 'Kritisch', overdue: 'Überfällig', done: 'Fertig',
};

export function KitchenPhase5420SmartTimingCountdownV52() {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<Tab>('countdown');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setTick(t => t + 1), 1_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch('/api/delivery/kitchen?view=timing_v52');
        if (!r.ok) throw new Error('api');
        const j = await r.json();
        if (!cancelled) setData(j);
      } catch {
        // keep mock
      }
    };
    poll();
    const iv = setInterval(poll, 15_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const nowMs = Date.now() + tick * 0; // re-render on tick
  const now = Date.now();

  const activeOrders = data.orders.filter(o => o.status === 'in_progress' || o.status === 'queued');
  const sorted = [...activeOrders].sort((a, b) => b.prio_score - a.prio_score);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'countdown', label: 'Countdown' },
    { key: 'sla',       label: 'SLA-Ampel' },
    { key: 'prognose',  label: 'Prognose' },
  ];

  const kpis = [
    { label: 'Aktiv',       value: activeOrders.length,        color: 'text-indigo-600' },
    { label: 'Kritisch',    value: data.kritisch_count,        color: 'text-orange-500' },
    { label: 'Überfällig',  value: data.ueberfaellig_count,    color: 'text-red-500'    },
    { label: 'Fertig',      value: data.fertig_count,          color: 'text-emerald-600' },
    { label: 'Fahrer↑',     value: data.fahrer_unterwegs,      color: 'text-blue-500'   },
    { label: 'Batch-Score', value: `${data.batch_score}`,      color: 'text-violet-500' },
    { label: 'SLA %',       value: `${data.sla_quote_pct}%`,  color: data.sla_quote_pct >= 90 ? 'text-emerald-600' : 'text-amber-500' },
    { label: 'Velocity',    value: `${data.velocity}/h`,       color: 'text-teal-600'   },
  ];

  return (
    <div className="rounded-xl border border-indigo-200 bg-white p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-bold text-gray-800">Smart-Timing V52</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-bold">SLA-SYNC</span>
        </div>
        {data.ueberfaellig_count > 0 && (
          <span className="flex items-center gap-1 text-xs text-red-600 font-bold animate-pulse">
            <AlertTriangle className="h-3 w-3" />
            {data.ueberfaellig_count} überfällig
          </span>
        )}
      </div>

      {/* 8-KPI-Grid */}
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
        {kpis.map(k => (
          <div key={k.label} className="rounded-lg bg-gray-50 px-2 py-1.5 text-center">
            <div className={`text-base font-black tabular-nums ${k.color}`}>{k.value}</div>
            <div className="text-[9px] text-gray-500 leading-tight">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-100">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`pb-1 px-2 text-xs font-bold transition border-b-2 ${tab === t.key ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Countdown */}
      {tab === 'countdown' && (
        <div className="space-y-1.5">
          {sorted.map(o => {
            const state = getOrderState(o, now);
            const elapsed = o.prep_started_at ? (now - new Date(o.prep_started_at).getTime()) / 60_000 : 0;
            const remaining = o.prep_target_min - elapsed;
            const pct = Math.min(100, (elapsed / o.prep_target_min) * 100);

            return (
              <div key={o.id} className={`rounded-lg border px-3 py-2 space-y-1.5 ${STATE_COLORS[state]}`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black tabular-nums">{o.bestellnummer}</span>
                    <span className="text-[9px] px-1 py-0.5 rounded bg-white/60 font-bold">{o.station}</span>
                    {o.batch_id && <span className="text-[9px] px-1 rounded bg-indigo-100 text-indigo-700 font-bold">{o.batch_id}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {o.fahrer_naehe_km !== null && (
                      <span className="flex items-center gap-1 text-[10px] text-blue-600 font-bold">
                        <Route className="h-2.5 w-2.5" />
                        {o.fahrer_naehe_km.toFixed(1)} km
                      </span>
                    )}
                    {o.fahrer_eta_min !== null && (
                      <span className="flex items-center gap-1 text-[10px] font-bold">
                        <Zap className="h-2.5 w-2.5" />
                        F-ETA {o.fahrer_eta_min}m
                      </span>
                    )}
                    <span className={`text-xs font-black tabular-nums ${remaining < 0 ? 'text-red-600' : ''}`}>
                      {state === 'queued' ? `${o.prep_target_min}m` : remaining < 0 ? `+${Math.abs(remaining).toFixed(0)}m` : `${remaining.toFixed(0)}m`}
                    </span>
                  </div>
                </div>
                {o.status !== 'queued' && (
                  <div className="h-1.5 w-full rounded-full bg-white/50 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${state === 'overdue' ? 'bg-red-500' : state === 'critical' ? 'bg-orange-400' : state === 'warn' ? 'bg-amber-400' : 'bg-emerald-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
                <div className="flex items-center justify-between text-[9px] opacity-70">
                  <span>{STATE_LABELS[state]}</span>
                  <span>Prio {o.prio_score} · Übergabe {o.batch_uebergabe_score}</span>
                </div>
              </div>
            );
          })}
          {sorted.length === 0 && (
            <div className="py-4 text-center text-sm text-gray-400">Keine aktiven Bestellungen</div>
          )}
        </div>
      )}

      {/* Tab: SLA */}
      {tab === 'sla' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700">SLA-Quote gesamt</span>
            <span className={`text-sm font-black ${data.sla_quote_pct >= 90 ? 'text-emerald-600' : data.sla_quote_pct >= 75 ? 'text-amber-500' : 'text-red-500'}`}>
              {data.sla_quote_pct}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full ${data.sla_quote_pct >= 90 ? 'bg-emerald-400' : data.sla_quote_pct >= 75 ? 'bg-amber-400' : 'bg-red-400'}`}
              style={{ width: `${data.sla_quote_pct}%` }}
            />
          </div>
          <div className="space-y-1.5 mt-2">
            {data.sla_zonen.map(z => (
              <div key={z.label} className={`rounded-lg border px-3 py-2 flex items-center gap-3 ${z.ok ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                <span className={`text-base ${z.ok ? 'text-emerald-500' : 'text-red-400'}`}>{z.ok ? '✓' : '✗'}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-700">{z.label}</span>
                    <span className={`text-xs font-black tabular-nums ${z.ok ? 'text-emerald-700' : 'text-red-700'}`}>{z.avg_min}m / {z.target_min}m SLA</span>
                  </div>
                  <div className="text-[10px] text-gray-500">{z.count} Bestellungen</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Prognose */}
      {tab === 'prognose' && (
        <div className="space-y-3">
          <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-xs text-indigo-700 font-bold">Prognose +30 Min</div>
              <div className="text-2xl font-black text-indigo-600 tabular-nums">{data.prognose_30min}</div>
              <div className="text-[10px] text-indigo-500">erwartete Bestellungen</div>
            </div>
            <Brain className="h-8 w-8 text-indigo-300" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-teal-50 border border-teal-100 px-3 py-2 text-center">
              <div className="text-sm font-black text-teal-700 tabular-nums">{data.velocity}</div>
              <div className="text-[10px] text-teal-500">Bestellungen/h</div>
            </div>
            <div className="rounded-lg bg-violet-50 border border-violet-100 px-3 py-2 text-center">
              <div className="text-sm font-black text-violet-700 tabular-nums">{data.batch_score}</div>
              <div className="text-[10px] text-violet-500">Batch-Score</div>
            </div>
          </div>
          <div className="text-[10px] text-gray-400 text-center">
            Zuletzt aktualisiert: {new Date(data.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </div>
      )}
    </div>
  );
}

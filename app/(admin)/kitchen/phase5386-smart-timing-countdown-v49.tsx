'use client';

import { useEffect, useRef, useState } from 'react';
import { Timer, Flame, Zap, ChefHat, AlertTriangle, CheckCircle2, Clock, BarChart3, Brain, TrendingUp } from 'lucide-react';

// Phase 5382 — Smart-Timing Countdown V49
// Neu: KI-Kochstart-Priorisierung (AI-basierter optimaler Kochstart je Fahrer-ETA);
// Multi-Station-Batch-Sync-Ampel; Urgency-Score 0-100 farbkodiert;
// 6-KPI-Grid Aktiv/Kritisch/Überfällig/KI-Empfohlen/Fertig/Score;
// Farbkodierung 5-stufig ok/warn/critical/overdue/done;
// 1s-Tick + 15s-Polling; Mock-Fallback

type OrderState = 'ok' | 'warn' | 'critical' | 'overdue' | 'done';
type StationKey = 'grill' | 'friture' | 'kalt' | 'pasta' | 'ofen' | 'pizza';

interface KitchenOrder {
  id: string;
  bestellnummer: string;
  station: StationKey;
  prep_started_at: string | null;
  prep_target_min: number;
  fahrer_eta_min: number | null;
  batch_id: string | null;
  status: 'in_progress' | 'ready' | 'queued';
  priority: 'high' | 'normal';
  ki_start_empfehlung_min: number | null;
  urgency_score: number;
}

interface BatchSync {
  batch_id: string;
  orders_fertig: number;
  orders_gesamt: number;
  sync_status: 'ok' | 'warn' | 'critical';
}

interface ApiResponse {
  orders: KitchenOrder[];
  ki_score: number;
  velocity: number;
  kritisch_count: number;
  ueberfaellig_count: number;
  fertig_count: number;
  ki_empfohlen_count: number;
  batches: BatchSync[];
  timestamp: string;
}

const MOCK: ApiResponse = {
  ki_score: 88,
  velocity: 24,
  kritisch_count: 2,
  ueberfaellig_count: 1,
  fertig_count: 8,
  ki_empfohlen_count: 3,
  timestamp: new Date().toISOString(),
  batches: [
    { batch_id: 'B1', orders_fertig: 2, orders_gesamt: 3, sync_status: 'warn' },
    { batch_id: 'B2', orders_fertig: 1, orders_gesamt: 2, sync_status: 'ok' },
    { batch_id: 'B3', orders_fertig: 0, orders_gesamt: 2, sync_status: 'critical' },
  ],
  orders: [
    { id: 'o1', bestellnummer: '#1091', station: 'grill',   prep_started_at: new Date(Date.now() - 7  * 60_000).toISOString(), prep_target_min: 12, fahrer_eta_min: 6,  batch_id: 'B1', status: 'in_progress', priority: 'high',   ki_start_empfehlung_min: null, urgency_score: 82 },
    { id: 'o2', bestellnummer: '#1092', station: 'friture', prep_started_at: new Date(Date.now() - 13 * 60_000).toISOString(), prep_target_min: 10, fahrer_eta_min: 1,  batch_id: 'B1', status: 'in_progress', priority: 'high',   ki_start_empfehlung_min: null, urgency_score: 97 },
    { id: 'o3', bestellnummer: '#1093', station: 'kalt',    prep_started_at: null,                                              prep_target_min: 6,  fahrer_eta_min: 9,  batch_id: 'B3', status: 'queued',      priority: 'normal', ki_start_empfehlung_min: 3,    urgency_score: 41 },
    { id: 'o4', bestellnummer: '#1094', station: 'pasta',   prep_started_at: new Date(Date.now() - 5  * 60_000).toISOString(), prep_target_min: 14, fahrer_eta_min: 10, batch_id: 'B2', status: 'in_progress', priority: 'normal', ki_start_empfehlung_min: null, urgency_score: 55 },
    { id: 'o5', bestellnummer: '#1095', station: 'ofen',    prep_started_at: new Date(Date.now() - 15 * 60_000).toISOString(), prep_target_min: 13, fahrer_eta_min: 0,  batch_id: 'B1', status: 'in_progress', priority: 'high',   ki_start_empfehlung_min: null, urgency_score: 99 },
    { id: 'o6', bestellnummer: '#1096', station: 'grill',   prep_started_at: null,                                              prep_target_min: 8,  fahrer_eta_min: 5,  batch_id: 'B3', status: 'queued',      priority: 'high',   ki_start_empfehlung_min: 2,    urgency_score: 70 },
    { id: 'o7', bestellnummer: '#1090', station: 'pizza',   prep_started_at: new Date(Date.now() - 20 * 60_000).toISOString(), prep_target_min: 12, fahrer_eta_min: null, batch_id: 'B2', status: 'ready',    priority: 'normal', ki_start_empfehlung_min: null, urgency_score: 10 },
  ],
};

function calcState(order: KitchenOrder, nowMs: number): { state: OrderState; remainSec: number } {
  if (order.status === 'ready') return { state: 'done', remainSec: 0 };
  if (order.status === 'queued' || !order.prep_started_at) return { state: 'ok', remainSec: order.prep_target_min * 60 };
  const elapsed = (nowMs - new Date(order.prep_started_at).getTime()) / 1000;
  const remain = order.prep_target_min * 60 - elapsed;
  if (remain < 0)      return { state: 'overdue', remainSec: Math.abs(remain) };
  if (remain < 90)     return { state: 'critical', remainSec: remain };
  if (remain < 3 * 60) return { state: 'warn', remainSec: remain };
  return { state: 'ok', remainSec: remain };
}

function fmt(sec: number): string {
  const m = Math.floor(Math.abs(sec) / 60);
  const s = Math.floor(Math.abs(sec) % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const STATE_COLORS: Record<OrderState, string> = {
  ok:       'border-emerald-500 bg-emerald-950/30',
  warn:     'border-amber-400  bg-amber-950/30',
  critical: 'border-orange-500 bg-orange-950/40',
  overdue:  'border-red-500    bg-red-950/40',
  done:     'border-zinc-600   bg-zinc-900/40',
};

const TIMER_COLORS: Record<OrderState, string> = {
  ok:       'text-emerald-400',
  warn:     'text-amber-400',
  critical: 'text-orange-400 animate-pulse',
  overdue:  'text-red-400 animate-pulse',
  done:     'text-zinc-500',
};

const BADGE_COLORS: Record<OrderState, string> = {
  ok:       'bg-emerald-700 text-emerald-100',
  warn:     'bg-amber-700   text-amber-100',
  critical: 'bg-orange-700  text-orange-100',
  overdue:  'bg-red-700     text-red-100',
  done:     'bg-zinc-700    text-zinc-300',
};

const STATE_LABELS: Record<OrderState, string> = {
  ok:       'OK',
  warn:     'Bald',
  critical: 'Kritisch',
  overdue:  'ÜBERFÄLLIG',
  done:     'Fertig',
};

function urgencyColor(score: number): string {
  if (score >= 90) return 'text-red-400';
  if (score >= 70) return 'text-orange-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-emerald-400';
}

function syncColor(s: BatchSync['sync_status']): string {
  if (s === 'critical') return 'bg-red-500';
  if (s === 'warn')     return 'bg-amber-500';
  return 'bg-emerald-500';
}

export function KitchenPhase5386SmartTimingCountdownV49() {
  const [data, setData]     = useState<ApiResponse>(MOCK);
  const [nowMs, setNowMs]   = useState(Date.now());
  const [tab, setTab]       = useState<'countdown' | 'ki' | 'batches'>('countdown');
  const ivRef               = useRef<ReturnType<typeof setInterval> | null>(null);

  // 1s tick
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // 15s polling
  useEffect(() => {
    const poll = () => {
      fetch('/api/delivery/kitchen/timing?include_ki=1', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setData(d); })
        .catch(() => {});
    };
    poll();
    ivRef.current = setInterval(poll, 15_000);
    return () => { if (ivRef.current) clearInterval(ivRef.current); };
  }, []);

  const activeOrders = data.orders.filter(o => o.status !== 'ready');
  const sorted = [...activeOrders].sort((a, b) => b.urgency_score - a.urgency_score);
  const kiOrders = data.orders.filter(o => o.ki_start_empfehlung_min !== null);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 space-y-3 text-sm font-mono">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Smart-Timing V49</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-zinc-500">KI-Score</span>
          <span className={`text-sm font-bold ${data.ki_score >= 85 ? 'text-emerald-400' : data.ki_score >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
            {data.ki_score}
          </span>
          <Zap className="w-3 h-3 text-yellow-400" />
        </div>
      </div>

      {/* 6-KPI Grid */}
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { label: 'Aktiv',        value: data.orders.filter(o => o.status === 'in_progress').length, color: 'text-blue-300',    icon: <Timer className="w-3 h-3" /> },
          { label: 'Kritisch',     value: data.kritisch_count,    color: 'text-orange-400',   icon: <AlertTriangle className="w-3 h-3" /> },
          { label: 'Überfällig',   value: data.ueberfaellig_count, color: 'text-red-400',     icon: <Flame className="w-3 h-3" /> },
          { label: 'KI-Empfohlen', value: data.ki_empfohlen_count, color: 'text-indigo-400',  icon: <Brain className="w-3 h-3" /> },
          { label: 'Fertig',       value: data.fertig_count,       color: 'text-emerald-400',  icon: <CheckCircle2 className="w-3 h-3" /> },
          { label: 'Velocity',     value: `${data.velocity}/h`,    color: 'text-yellow-400',   icon: <TrendingUp className="w-3 h-3" /> },
        ].map(k => (
          <div key={k.label} className="rounded-lg bg-zinc-900 p-2 text-center">
            <div className={`flex items-center justify-center gap-1 ${k.color} mb-0.5`}>
              {k.icon}
              <span className="text-[10px] text-zinc-400">{k.label}</span>
            </div>
            <div className={`text-base font-bold ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tab Nav */}
      <div className="flex gap-1 bg-zinc-900 rounded-lg p-1">
        {(['countdown', 'ki', 'batches'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${tab === t ? 'bg-indigo-700 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            {t === 'countdown' ? 'Countdown' : t === 'ki' ? 'KI-Tipps' : 'Batches'}
          </button>
        ))}
      </div>

      {/* Tab: Countdown */}
      {tab === 'countdown' && (
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {sorted.map(order => {
            const { state, remainSec } = calcState(order, nowMs);
            return (
              <div key={order.id} className={`rounded-lg border p-2 ${STATE_COLORS[state]}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-300">{order.bestellnummer}</span>
                    <span className="text-[10px] text-zinc-500 uppercase">{order.station}</span>
                    {order.priority === 'high' && <Flame className="w-3 h-3 text-red-400" />}
                  </div>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${BADGE_COLORS[state]}`}>
                    {STATE_LABELS[state]}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <div className={`text-lg font-bold tabular-nums ${TIMER_COLORS[state]}`}>
                    {state === 'done' ? '✓ Fertig' : state === 'overdue' ? `+${fmt(remainSec)}` : fmt(remainSec)}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                    {order.fahrer_eta_min !== null && (
                      <span className="flex items-center gap-0.5">
                        <Zap className="w-3 h-3 text-yellow-400" />
                        {order.fahrer_eta_min}min
                      </span>
                    )}
                    <span className={`font-semibold ${urgencyColor(order.urgency_score)}`}>
                      U:{order.urgency_score}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          {sorted.length === 0 && (
            <div className="text-center text-zinc-500 text-xs py-6">Keine aktiven Bestellungen</div>
          )}
        </div>
      )}

      {/* Tab: KI-Tipps */}
      {tab === 'ki' && (
        <div className="space-y-2">
          {kiOrders.length === 0 ? (
            <div className="text-center text-zinc-500 text-xs py-6">Alle Bestellungen im optimalen Timing</div>
          ) : kiOrders.map(order => (
            <div key={order.id} className="rounded-lg border border-indigo-700 bg-indigo-950/30 p-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-xs font-bold text-zinc-200">{order.bestellnummer}</span>
                  <span className="text-[10px] text-zinc-500 uppercase">{order.station}</span>
                </div>
                <span className="text-[10px] bg-indigo-800 text-indigo-200 px-1.5 py-0.5 rounded">KI-Empfehlung</span>
              </div>
              <div className="mt-1.5 text-xs text-indigo-300">
                Optimaler Kochstart in{' '}
                <span className="font-bold text-indigo-200">{order.ki_start_empfehlung_min} min</span>
                {order.fahrer_eta_min !== null && (
                  <span className="text-zinc-500"> · Fahrer in {order.fahrer_eta_min} min</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Batches */}
      {tab === 'batches' && (
        <div className="space-y-2">
          {data.batches.map(b => {
            const pct = b.orders_gesamt > 0 ? Math.round((b.orders_fertig / b.orders_gesamt) * 100) : 0;
            return (
              <div key={b.batch_id} className="rounded-lg border border-zinc-700 bg-zinc-900 p-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-zinc-200">Batch {b.batch_id}</span>
                  <div className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${syncColor(b.sync_status)}`} />
                    <span className="text-[10px] text-zinc-400">{b.orders_fertig}/{b.orders_gesamt} fertig</span>
                  </div>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${syncColor(b.sync_status)}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-right text-[10px] text-zinc-500 mt-0.5">{pct}%</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="text-[9px] text-zinc-600 text-right">
        <ChefHat className="w-3 h-3 inline mr-1" />
        1s-Tick · 15s-Poll · {new Date(data.timestamp).toLocaleTimeString('de-DE')}
      </div>
    </div>
  );
}

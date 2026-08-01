'use client';

import { useEffect, useRef, useState } from 'react';
import { Timer, Flame, Zap, ChefHat, AlertTriangle, CheckCircle2, Brain, TrendingUp, Layers, Target } from 'lucide-react';

// Phase 5395 — Smart-Timing Countdown V50
// Neu: Live-Priorisierungs-Score je Bestellung (0-100); Stations-Überlast-Alert;
// Fahrer-Ankunfts-Prognose mit Ampel; Batch-Effizienz-Index;
// 7-KPI-Grid Aktiv/Kritisch/Überfällig/KI/Fertig/Effizienz/Score;
// Farbkodierung 6-stufig queued/ok/warn/critical/overdue/done;
// 3-Tab-Nav Countdown/KI-Prognose/Stationen; 1s-Tick + 15s-Polling; Mock-Fallback

type OrderState = 'queued' | 'ok' | 'warn' | 'critical' | 'overdue' | 'done';
type StationKey = 'grill' | 'friture' | 'kalt' | 'pasta' | 'ofen' | 'pizza';
type Tab = 'countdown' | 'ki' | 'stationen';

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
  prio_score: number;
  ki_start_empfehlung_min: number | null;
  fahrer_ankunft_ampel: 'gruen' | 'gelb' | 'rot';
}

interface StationStat {
  key: StationKey;
  label: string;
  aktiv: number;
  kapazitaet: number;
  ueberlast: boolean;
  effizienz_pct: number;
}

interface ApiResponse {
  orders: KitchenOrder[];
  effizienz_index: number;
  ki_score: number;
  velocity: number;
  kritisch_count: number;
  ueberfaellig_count: number;
  fertig_count: number;
  ki_empfohlen_count: number;
  stationen: StationStat[];
  timestamp: string;
}

const MOCK: ApiResponse = {
  ki_score: 91,
  velocity: 27,
  kritisch_count: 1,
  ueberfaellig_count: 0,
  fertig_count: 9,
  ki_empfohlen_count: 2,
  effizienz_index: 88,
  timestamp: new Date().toISOString(),
  stationen: [
    { key: 'grill',   label: 'Grill',   aktiv: 2, kapazitaet: 3, ueberlast: false, effizienz_pct: 92 },
    { key: 'friture', label: 'Friture', aktiv: 3, kapazitaet: 3, ueberlast: true,  effizienz_pct: 78 },
    { key: 'kalt',    label: 'Kalt',    aktiv: 1, kapazitaet: 4, ueberlast: false, effizienz_pct: 95 },
    { key: 'pasta',   label: 'Pasta',   aktiv: 2, kapazitaet: 3, ueberlast: false, effizienz_pct: 84 },
    { key: 'ofen',    label: 'Ofen',    aktiv: 1, kapazitaet: 2, ueberlast: false, effizienz_pct: 88 },
    { key: 'pizza',   label: 'Pizza',   aktiv: 2, kapazitaet: 2, ueberlast: true,  effizienz_pct: 71 },
  ],
  orders: [
    { id: 'o1', bestellnummer: '#1101', station: 'grill',   prep_started_at: new Date(Date.now() - 8  * 60_000).toISOString(), prep_target_min: 12, fahrer_eta_min: 5,  batch_id: 'B1', status: 'in_progress', priority: 'high',   prio_score: 90, ki_start_empfehlung_min: null, fahrer_ankunft_ampel: 'rot' },
    { id: 'o2', bestellnummer: '#1102', station: 'friture', prep_started_at: new Date(Date.now() - 5  * 60_000).toISOString(), prep_target_min: 10, fahrer_eta_min: 8,  batch_id: 'B1', status: 'in_progress', priority: 'normal', prio_score: 55, ki_start_empfehlung_min: null, fahrer_ankunft_ampel: 'gelb' },
    { id: 'o3', bestellnummer: '#1103', station: 'kalt',    prep_started_at: null,                                              prep_target_min: 6,  fahrer_eta_min: 10, batch_id: 'B2', status: 'queued',      priority: 'normal', prio_score: 35, ki_start_empfehlung_min: 4,    fahrer_ankunft_ampel: 'gruen' },
    { id: 'o4', bestellnummer: '#1104', station: 'pasta',   prep_started_at: new Date(Date.now() - 11 * 60_000).toISOString(), prep_target_min: 13, fahrer_eta_min: 3,  batch_id: 'B2', status: 'in_progress', priority: 'high',   prio_score: 78, ki_start_empfehlung_min: null, fahrer_ankunft_ampel: 'rot' },
    { id: 'o5', bestellnummer: '#1105', station: 'ofen',    prep_started_at: null,                                              prep_target_min: 15, fahrer_eta_min: 12, batch_id: 'B3', status: 'queued',      priority: 'normal', prio_score: 28, ki_start_empfehlung_min: 6,    fahrer_ankunft_ampel: 'gruen' },
    { id: 'o6', bestellnummer: '#1100', station: 'pizza',   prep_started_at: new Date(Date.now() - 20 * 60_000).toISOString(), prep_target_min: 12, fahrer_eta_min: null, batch_id: null, status: 'ready',     priority: 'normal', prio_score: 5,  ki_start_empfehlung_min: null, fahrer_ankunft_ampel: 'gruen' },
  ],
};

function calcState(order: KitchenOrder, nowMs: number): { state: OrderState; remainSec: number } {
  if (order.status === 'ready') return { state: 'done', remainSec: 0 };
  if (order.status === 'queued' || !order.prep_started_at) return { state: 'queued', remainSec: order.prep_target_min * 60 };
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
  queued:   'border-zinc-700 bg-zinc-900/50',
  ok:       'border-emerald-600 bg-emerald-950/30',
  warn:     'border-amber-500 bg-amber-950/30',
  critical: 'border-orange-500 bg-orange-950/40',
  overdue:  'border-red-500 bg-red-950/40',
  done:     'border-zinc-700 bg-zinc-900/30',
};

const TIMER_COLORS: Record<OrderState, string> = {
  queued:   'text-zinc-400',
  ok:       'text-emerald-400',
  warn:     'text-amber-400',
  critical: 'text-orange-400 animate-pulse',
  overdue:  'text-red-400 animate-pulse',
  done:     'text-zinc-500',
};

const STATE_LABELS: Record<OrderState, string> = {
  queued:   'Wartend',
  ok:       'OK',
  warn:     'Bald',
  critical: 'Kritisch',
  overdue:  'ÜBERFÄLLIG',
  done:     'Fertig',
};

const BADGE_COLORS: Record<OrderState, string> = {
  queued:   'bg-zinc-700 text-zinc-300',
  ok:       'bg-emerald-700 text-emerald-100',
  warn:     'bg-amber-700 text-amber-100',
  critical: 'bg-orange-700 text-orange-100',
  overdue:  'bg-red-700 text-red-100',
  done:     'bg-zinc-700 text-zinc-400',
};

function ankunftColor(ampel: KitchenOrder['fahrer_ankunft_ampel']): string {
  if (ampel === 'rot')   return 'text-red-400';
  if (ampel === 'gelb')  return 'text-amber-400';
  return 'text-emerald-400';
}

function stationBarColor(eff: number, ueberlast: boolean): string {
  if (ueberlast) return 'bg-red-500';
  if (eff >= 90) return 'bg-emerald-500';
  if (eff >= 75) return 'bg-amber-400';
  return 'bg-orange-500';
}

export function KitchenPhase5395SmartTimingCountdownV50() {
  const [data, setData]   = useState<ApiResponse>(MOCK);
  const [nowMs, setNowMs] = useState(Date.now());
  const [tab, setTab]     = useState<Tab>('countdown');
  const ivRef             = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const poll = () => {
      fetch('/api/delivery/kitchen/timing?include_ki=1&v=50', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setData(d); })
        .catch(() => {});
    };
    poll();
    ivRef.current = setInterval(poll, 15_000);
    return () => { if (ivRef.current) clearInterval(ivRef.current); };
  }, []);

  const activeOrders = data.orders.filter(o => o.status !== 'ready');
  const sorted = [...activeOrders].sort((a, b) => b.prio_score - a.prio_score);
  const kiOrders = data.orders.filter(o => o.ki_start_empfehlung_min !== null);
  const ueberlastStationen = data.stationen.filter(s => s.ueberlast);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 space-y-3 text-sm font-mono">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Smart-Timing V50</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500">Effizienz</span>
          <span className={`text-sm font-bold ${data.effizienz_index >= 85 ? 'text-emerald-400' : data.effizienz_index >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
            {data.effizienz_index}
          </span>
          <Target className="w-3 h-3 text-emerald-400" />
        </div>
      </div>

      {/* Überlast-Alert */}
      {ueberlastStationen.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-red-800 bg-red-950/30 px-2 py-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          <span className="text-[11px] text-red-300">
            Überlast: {ueberlastStationen.map(s => s.label).join(', ')}
          </span>
        </div>
      )}

      {/* 7-KPI Grid */}
      <div className="grid grid-cols-4 gap-1">
        {[
          { label: 'Aktiv',     value: data.orders.filter(o => o.status === 'in_progress').length, color: 'text-blue-300',    icon: <Timer className="w-3 h-3" /> },
          { label: 'Kritisch',  value: data.kritisch_count,     color: 'text-orange-400',  icon: <AlertTriangle className="w-3 h-3" /> },
          { label: 'Überfällig',value: data.ueberfaellig_count, color: 'text-red-400',     icon: <Flame className="w-3 h-3" /> },
          { label: 'Fertig',    value: data.fertig_count,        color: 'text-emerald-400', icon: <CheckCircle2 className="w-3 h-3" /> },
        ].map(k => (
          <div key={k.label} className="rounded-lg bg-zinc-900 p-1.5 text-center">
            <div className={`flex items-center justify-center gap-0.5 ${k.color} mb-0.5`}>
              {k.icon}
              <span className="text-[9px] text-zinc-500">{k.label}</span>
            </div>
            <div className={`text-sm font-bold ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1">
        {[
          { label: 'KI-Empf.',  value: data.ki_empfohlen_count, color: 'text-indigo-400', icon: <Brain className="w-3 h-3" /> },
          { label: 'Velocity',  value: `${data.velocity}/h`,     color: 'text-yellow-400', icon: <TrendingUp className="w-3 h-3" /> },
          { label: 'KI-Score',  value: data.ki_score,            color: 'text-indigo-300', icon: <Zap className="w-3 h-3" /> },
        ].map(k => (
          <div key={k.label} className="rounded-lg bg-zinc-900 p-1.5 text-center">
            <div className={`flex items-center justify-center gap-0.5 ${k.color} mb-0.5`}>
              {k.icon}
              <span className="text-[9px] text-zinc-500">{k.label}</span>
            </div>
            <div className={`text-sm font-bold ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tab Nav */}
      <div className="flex gap-1 bg-zinc-900 rounded-lg p-1">
        {(['countdown', 'ki', 'stationen'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${tab === t ? 'bg-indigo-700 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            {t === 'countdown' ? 'Countdown' : t === 'ki' ? 'KI-Prognose' : 'Stationen'}
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
                    {state === 'done' ? '✓ Fertig' : state === 'queued' ? `${fmt(remainSec)} geplant` : state === 'overdue' ? `+${fmt(remainSec)}` : fmt(remainSec)}
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    {order.fahrer_eta_min !== null && (
                      <span className={`flex items-center gap-0.5 ${ankunftColor(order.fahrer_ankunft_ampel)}`}>
                        <Zap className="w-3 h-3" />
                        {order.fahrer_eta_min}min
                      </span>
                    )}
                    <span className={`font-bold ${order.prio_score >= 80 ? 'text-red-400' : order.prio_score >= 60 ? 'text-amber-400' : 'text-zinc-500'}`}>
                      P:{order.prio_score}
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

      {/* Tab: KI-Prognose */}
      {tab === 'ki' && (
        <div className="space-y-2">
          {kiOrders.length === 0 ? (
            <div className="text-center text-zinc-500 text-xs py-6">Alle Bestellungen im optimalen Timing</div>
          ) : kiOrders.map(order => (
            <div key={order.id} className="rounded-lg border border-indigo-800 bg-indigo-950/30 p-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-xs font-bold text-zinc-200">{order.bestellnummer}</span>
                  <span className="text-[10px] text-zinc-500 uppercase">{order.station}</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${ankunftColor(order.fahrer_ankunft_ampel)} bg-zinc-900`}>
                  Fahrer {order.fahrer_eta_min}min
                </span>
              </div>
              <div className="mt-1.5 text-xs text-indigo-300">
                Optimaler Kochstart in{' '}
                <span className="font-bold text-indigo-200">{order.ki_start_empfehlung_min} min</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Stationen */}
      {tab === 'stationen' && (
        <div className="space-y-2">
          {data.stationen.map(s => (
            <div key={s.key} className={`rounded-lg border p-2 ${s.ueberlast ? 'border-red-800 bg-red-950/20' : 'border-zinc-800 bg-zinc-900'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-xs font-semibold text-zinc-200">{s.label}</span>
                  {s.ueberlast && <span className="text-[9px] bg-red-800 text-red-200 px-1 rounded">ÜBERLAST</span>}
                </div>
                <span className={`text-xs font-bold ${stationBarColor(s.effizienz_pct, s.ueberlast).replace('bg-', 'text-').replace('-500', '-400').replace('-400', '-400')}`}>
                  {s.aktiv}/{s.kapazitaet} · {s.effizienz_pct}%
                </span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${stationBarColor(s.effizienz_pct, s.ueberlast)}`}
                  style={{ width: `${s.effizienz_pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-[9px] text-zinc-600 text-right">
        <ChefHat className="w-3 h-3 inline mr-1" />
        1s-Tick · 15s-Poll · V50 · {new Date(data.timestamp).toLocaleTimeString('de-DE')}
      </div>
    </div>
  );
}

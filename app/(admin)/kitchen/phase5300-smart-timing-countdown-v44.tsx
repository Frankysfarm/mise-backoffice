'use client';

import { useEffect, useRef, useState } from 'react';
import { Timer, Flame, Zap, ChefHat, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown } from 'lucide-react';

type OrderState = 'ok' | 'warn' | 'critical' | 'overdue' | 'done';
type StationFilter = 'all' | 'grill' | 'friture' | 'kalt' | 'pasta' | 'ofen';

interface KitchenOrder {
  id: string;
  bestellnummer: string;
  station: StationFilter;
  prep_started_at: string | null;
  prep_target_min: number;
  fahrer_eta_min: number | null;
  batch_id: string | null;
  status: 'in_progress' | 'ready' | 'cancelled';
  items_count: number;
  priority: 'high' | 'normal';
}

interface ApiResponse {
  orders: KitchenOrder[];
  score: number;
  score_trend: 'up' | 'down' | 'neutral';
  velocity: number;
  timestamp: string;
}

const MOCK: ApiResponse = {
  score: 87,
  score_trend: 'up',
  velocity: 14,
  timestamp: new Date().toISOString(),
  orders: [
    { id: 'o1', bestellnummer: '#1041', station: 'grill',   prep_started_at: new Date(Date.now() - 4 * 60_000).toISOString(), prep_target_min: 12, fahrer_eta_min: 9,  batch_id: 'B1', status: 'in_progress', items_count: 3, priority: 'high' },
    { id: 'o2', bestellnummer: '#1042', station: 'friture', prep_started_at: new Date(Date.now() - 9 * 60_000).toISOString(), prep_target_min: 10, fahrer_eta_min: 2,  batch_id: 'B1', status: 'in_progress', items_count: 2, priority: 'high' },
    { id: 'o3', bestellnummer: '#1043', station: 'kalt',    prep_started_at: new Date(Date.now() - 2 * 60_000).toISOString(), prep_target_min: 8,  fahrer_eta_min: 15, batch_id: null, status: 'in_progress', items_count: 1, priority: 'normal' },
    { id: 'o4', bestellnummer: '#1044', station: 'pasta',   prep_started_at: new Date(Date.now() - 14 * 60_000).toISOString(), prep_target_min: 12, fahrer_eta_min: 5,  batch_id: 'B2', status: 'in_progress', items_count: 4, priority: 'normal' },
    { id: 'o5', bestellnummer: '#1045', station: 'ofen',    prep_started_at: null,                                             prep_target_min: 15, fahrer_eta_min: 20, batch_id: 'B2', status: 'in_progress', items_count: 2, priority: 'normal' },
    { id: 'o6', bestellnummer: '#1040', station: 'grill',   prep_started_at: new Date(Date.now() - 20 * 60_000).toISOString(), prep_target_min: 12, fahrer_eta_min: null, batch_id: null, status: 'ready',       items_count: 3, priority: 'normal' },
  ],
};

function calcState(order: KitchenOrder, nowMs: number): { state: OrderState; remainSec: number } {
  if (order.status === 'ready') return { state: 'done', remainSec: 0 };
  if (!order.prep_started_at) return { state: 'ok', remainSec: order.prep_target_min * 60 };
  const elapsedSec = (nowMs - new Date(order.prep_started_at).getTime()) / 1000;
  const remainSec = order.prep_target_min * 60 - elapsedSec;
  if (remainSec > 10 * 60) return { state: 'ok', remainSec };
  if (remainSec > 5 * 60)  return { state: 'warn', remainSec };
  if (remainSec > 0)       return { state: 'critical', remainSec };
  return { state: 'overdue', remainSec };
}

const STATE_COLORS: Record<OrderState, { bg: string; border: string; text: string; bar: string }> = {
  ok:       { bg: 'bg-green-950/30',  border: 'border-green-800/50',  text: 'text-green-400',  bar: 'bg-green-500' },
  warn:     { bg: 'bg-yellow-950/30', border: 'border-yellow-800/50', text: 'text-yellow-400', bar: 'bg-yellow-500' },
  critical: { bg: 'bg-red-950/30',    border: 'border-red-800/50',    text: 'text-red-400',    bar: 'bg-red-500' },
  overdue:  { bg: 'bg-red-950/50',    border: 'border-red-600/70',    text: 'text-red-300',    bar: 'bg-red-400' },
  done:     { bg: 'bg-gray-900/20',   border: 'border-gray-700/40',   text: 'text-green-500',  bar: 'bg-green-700' },
};

const STATION_LABELS: Record<StationFilter, string> = {
  all: 'Alle', grill: 'Grill', friture: 'Friture', kalt: 'Kalt', pasta: 'Pasta', ofen: 'Ofen',
};

function fmtSec(s: number): string {
  if (s <= 0) return 'ÜBER';
  const m = Math.floor(Math.abs(s) / 60);
  const sec = Math.floor(Math.abs(s) % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function KitchenPhase5300SmartTimingCountdownV44({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [now, setNow] = useState(Date.now());
  const [station, setStation] = useState<StationFilter>('all');
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    const params = locationId ? `?location_id=${locationId}` : '';
    const res = await fetch(`/api/delivery/admin/kitchen-countdown${params}`).catch(() => null);
    if (res?.ok) {
      const j = await res.json();
      setData(j?.orders ? j : MOCK);
    } else {
      setData(MOCK);
    }
  }

  useEffect(() => {
    load();
    const poll = setInterval(load, 15 * 1000);
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(poll); if (tickRef.current) clearInterval(tickRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data) return null;

  const filtered = data.orders.filter(o => station === 'all' || o.station === station);
  const states = filtered.map(o => ({ ...o, ...calcState(o, now) }));
  const active = states.filter(s => s.state !== 'done');
  const done = states.filter(s => s.state === 'done').length;
  const critical = states.filter(s => s.state === 'critical' || s.state === 'overdue').length;
  const overdue = states.filter(s => s.state === 'overdue').length;

  return (
    <div className="rounded-xl border border-indigo-800/60 bg-indigo-950/20 p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <Timer className="w-4 h-4 text-indigo-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Smart-Timing Countdown V44</span>
        <div className="ml-auto flex items-center gap-1">
          {data.score_trend === 'up' && <TrendingUp className="w-3 h-3 text-green-400" />}
          {data.score_trend === 'down' && <TrendingDown className="w-3 h-3 text-red-400" />}
          <span className="text-sm font-black text-indigo-300 tabular-nums">{data.score}</span>
          <span className="text-[10px] text-gray-500">Score</span>
        </div>
      </div>

      {overdue > 0 && (
        <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 animate-pulse" />
          <span className="text-xs text-red-300 font-semibold">{overdue} Bestellung{overdue > 1 ? 'en' : ''} überfällig!</span>
        </div>
      )}

      <div className="grid grid-cols-5 gap-1.5 mb-3">
        {([
          { label: 'Score', val: data.score, color: 'text-indigo-400' },
          { label: 'Aktiv', val: active.length, color: 'text-gray-200' },
          { label: 'Kritisch', val: critical, color: 'text-red-400' },
          { label: 'Fertig', val: done, color: 'text-green-400' },
          { label: 'Ges.', val: data.orders.length, color: 'text-gray-400' },
        ] as const).map(k => (
          <div key={k.label} className="rounded-lg bg-gray-800/50 px-1.5 py-2 text-center">
            <div className="text-[9px] text-gray-500">{k.label}</div>
            <div className={`text-base font-black tabular-nums ${k.color}`}>{k.val}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 mb-3 flex-wrap">
        {(Object.keys(STATION_LABELS) as StationFilter[]).map(s => (
          <button
            key={s}
            onClick={() => setStation(s)}
            className={`text-[10px] px-2 py-1 rounded-md font-semibold transition-colors ${
              station === s ? 'bg-indigo-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {STATION_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {states.map(o => {
          const c = STATE_COLORS[o.state];
          const elapsed = o.prep_started_at ? (now - new Date(o.prep_started_at).getTime()) / 1000 : 0;
          const prog = Math.min((elapsed / (o.prep_target_min * 60)) * 100, 100);
          return (
            <div key={o.id} className={`rounded-lg border ${c.bg} ${c.border} px-3 py-2`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1 min-w-0">
                  {o.priority === 'high' && <Flame className="w-3 h-3 text-orange-400 shrink-0" />}
                  <span className="text-[10px] font-semibold text-gray-300 truncate">{o.bestellnummer}</span>
                  {o.batch_id && <span className="text-[9px] text-indigo-400 bg-indigo-900/40 px-1 rounded font-mono shrink-0">{o.batch_id}</span>}
                </div>
                {o.state === 'done' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                ) : (
                  <span className={`text-sm font-black tabular-nums shrink-0 ${c.text}`}>{fmtSec(o.remainSec)}</span>
                )}
              </div>
              <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden mb-1">
                <div className={`h-full rounded-full transition-all ${c.bar}`} style={{ width: `${prog}%` }} />
              </div>
              <div className="flex items-center justify-between text-[9px] text-gray-500">
                <span className="capitalize">{o.station}</span>
                {o.fahrer_eta_min != null && (
                  <span className="flex items-center gap-0.5 text-indigo-400">
                    <Zap className="w-2.5 h-2.5" />Fahrer {o.fahrer_eta_min}m
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 text-[9px] text-gray-600 text-right">
        {data.velocity}/h · 1s-Tick · 15s-Poll
      </div>
    </div>
  );
}

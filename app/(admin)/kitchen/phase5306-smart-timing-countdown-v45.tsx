'use client';

import { useEffect, useRef, useState } from 'react';
import { Timer, Flame, Zap, ChefHat, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Clock } from 'lucide-react';

// Phase 5306 — Smart-Timing Countdown V45
// Neu: Dual-Countdown Küche+Fahrer nebeneinander; Batch-Effizienz-Score;
// Engpass-Frühwarner wenn Fahrer früher als Küche ETA; 1s-Tick + 15s-Polling; Mock-Fallback

type OrderState = 'ok' | 'warn' | 'critical' | 'overdue' | 'done' | 'fahrer_alert';
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
  fahrer_name: string | null;
}

interface ApiResponse {
  orders: KitchenOrder[];
  score: number;
  score_trend: 'up' | 'down' | 'neutral';
  velocity: number;
  batch_effizienz: number;
  timestamp: string;
}

const MOCK: ApiResponse = {
  score: 89,
  score_trend: 'up',
  velocity: 16,
  batch_effizienz: 82,
  timestamp: new Date().toISOString(),
  orders: [
    { id: 'o1', bestellnummer: '#1051', station: 'grill',   prep_started_at: new Date(Date.now() - 4 * 60_000).toISOString(),  prep_target_min: 12, fahrer_eta_min: 9,  batch_id: 'B1', status: 'in_progress', items_count: 3, priority: 'high',   fahrer_name: 'Tim B.' },
    { id: 'o2', bestellnummer: '#1052', station: 'friture', prep_started_at: new Date(Date.now() - 9 * 60_000).toISOString(),  prep_target_min: 10, fahrer_eta_min: 2,  batch_id: 'B1', status: 'in_progress', items_count: 2, priority: 'high',   fahrer_name: 'Tim B.' },
    { id: 'o3', bestellnummer: '#1053', station: 'kalt',    prep_started_at: new Date(Date.now() - 2 * 60_000).toISOString(),  prep_target_min: 8,  fahrer_eta_min: 15, batch_id: null, status: 'in_progress', items_count: 1, priority: 'normal', fahrer_name: 'Julia F.' },
    { id: 'o4', bestellnummer: '#1054', station: 'pasta',   prep_started_at: new Date(Date.now() - 14 * 60_000).toISOString(), prep_target_min: 12, fahrer_eta_min: 5,  batch_id: 'B2', status: 'in_progress', items_count: 4, priority: 'normal', fahrer_name: 'Kemal A.' },
    { id: 'o5', bestellnummer: '#1055', station: 'ofen',    prep_started_at: null,                                              prep_target_min: 15, fahrer_eta_min: 20, batch_id: 'B2', status: 'in_progress', items_count: 2, priority: 'normal', fahrer_name: 'Kemal A.' },
    { id: 'o6', bestellnummer: '#1050', station: 'grill',   prep_started_at: new Date(Date.now() - 20 * 60_000).toISOString(), prep_target_min: 12, fahrer_eta_min: null, batch_id: null, status: 'ready',     items_count: 3, priority: 'normal', fahrer_name: null },
  ],
};

function calcState(order: KitchenOrder, nowMs: number): { state: OrderState; remainSec: number; kitchenRemainSec: number } {
  if (order.status === 'ready') return { state: 'done', remainSec: 0, kitchenRemainSec: 0 };
  if (!order.prep_started_at) return { state: 'ok', remainSec: order.prep_target_min * 60, kitchenRemainSec: order.prep_target_min * 60 };
  const elapsedSec = (nowMs - new Date(order.prep_started_at).getTime()) / 1000;
  const kitchenRemainSec = order.prep_target_min * 60 - elapsedSec;
  const fahrerRemainSec = order.fahrer_eta_min !== null ? order.fahrer_eta_min * 60 : null;

  // Fahrer-Alert: Fahrer kommt früher als Küche fertig
  if (fahrerRemainSec !== null && fahrerRemainSec < kitchenRemainSec && kitchenRemainSec > 60) {
    return { state: 'fahrer_alert', remainSec: kitchenRemainSec, kitchenRemainSec };
  }
  if (kitchenRemainSec > 10 * 60) return { state: 'ok',       remainSec: kitchenRemainSec, kitchenRemainSec };
  if (kitchenRemainSec > 5 * 60)  return { state: 'warn',     remainSec: kitchenRemainSec, kitchenRemainSec };
  if (kitchenRemainSec > 0)       return { state: 'critical', remainSec: kitchenRemainSec, kitchenRemainSec };
  return { state: 'overdue', remainSec: kitchenRemainSec, kitchenRemainSec };
}

const STATE_COLORS: Record<OrderState, { bg: string; border: string; text: string; bar: string; label: string }> = {
  ok:           { bg: 'bg-green-950/30',  border: 'border-green-800/50',   text: 'text-green-400',  bar: 'bg-green-500',  label: 'OK'     },
  warn:         { bg: 'bg-yellow-950/30', border: 'border-yellow-800/50',  text: 'text-yellow-400', bar: 'bg-yellow-500', label: 'Bald'   },
  critical:     { bg: 'bg-red-950/30',    border: 'border-red-800/50',     text: 'text-red-400',    bar: 'bg-red-500',    label: 'Kritisch'},
  overdue:      { bg: 'bg-red-950/50',    border: 'border-red-600/70',     text: 'text-red-300',    bar: 'bg-red-400',    label: 'ÜBER'   },
  fahrer_alert: { bg: 'bg-blue-950/40',   border: 'border-blue-600/60',    text: 'text-blue-300',   bar: 'bg-blue-400',   label: 'Fahrer!' },
  done:         { bg: 'bg-gray-900/20',   border: 'border-gray-700/40',    text: 'text-green-500',  bar: 'bg-green-700',  label: 'Fertig' },
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

export function KitchenPhase5306SmartTimingCountdownV45({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [now, setNow] = useState(Date.now());
  const [station, setStation] = useState<StationFilter>('all');
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [error, setError] = useState(false);

  async function load() {
    const params = new URLSearchParams({ v: '45' });
    if (locationId) params.set('location_id', locationId);
    const res = await fetch(`/api/delivery/kitchen/timing?${params}`).catch(() => null);
    if (res?.ok) {
      const j = await res.json();
      setData(j);
      setError(false);
    } else {
      setData(MOCK);
      setError(true);
    }
  }

  useEffect(() => {
    load();
    tickRef.current = setInterval(() => setNow(Date.now()), 1_000);
    pollRef.current = setInterval(load, 15_000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const d = data ?? MOCK;

  const filtered = d.orders.filter(o =>
    station === 'all' || o.station === station
  ).sort((a, b) => {
    if (a.priority === 'high' && b.priority !== 'high') return -1;
    if (b.priority === 'high' && a.priority !== 'high') return 1;
    const sa = calcState(a, now);
    const sb = calcState(b, now);
    return sa.remainSec - sb.remainSec;
  });

  const active   = d.orders.filter(o => o.status === 'in_progress').length;
  const critical = d.orders.filter(o => { const s = calcState(o, now); return s.state === 'critical' || s.state === 'overdue'; }).length;
  const fahrAlerts = d.orders.filter(o => calcState(o, now).state === 'fahrer_alert').length;
  const ready    = d.orders.filter(o => o.status === 'ready').length;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 text-white text-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Timer size={15} className="text-indigo-400" />
          <span className="font-semibold">Smart-Timing V45</span>
          {error && <span className="text-xs text-yellow-500 border border-yellow-700 rounded px-1">Mock</span>}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-gray-400">Score <strong className="text-indigo-300">{d.score}</strong></span>
          {d.score_trend === 'up'   && <TrendingUp size={12} className="text-green-400" />}
          {d.score_trend === 'down' && <TrendingDown size={12} className="text-red-400" />}
          <span className="text-gray-400">Batch-Eff. <strong className="text-purple-300">{d.batch_effizienz}%</strong></span>
        </div>
      </div>

      {/* Fahrer-Alert-Banner */}
      {fahrAlerts > 0 && (
        <div className="mx-3 mt-3 flex items-center gap-2 rounded-lg border border-blue-700/60 bg-blue-950/40 px-3 py-2">
          <Zap size={13} className="text-blue-400 flex-shrink-0" />
          <span className="text-xs text-blue-300 font-medium">
            {fahrAlerts} Bestellung{fahrAlerts > 1 ? 'en' : ''}: Fahrer früher als Küche — sofort starten!
          </span>
        </div>
      )}

      {/* KPI-Grid */}
      <div className="grid grid-cols-4 gap-2 px-3 pt-3">
        {[
          { label: 'Aktiv',    value: active,      color: 'text-white'       },
          { label: 'Kritisch', value: critical,    color: critical > 0 ? 'text-red-400' : 'text-gray-500' },
          { label: 'Fahrer↑', value: fahrAlerts,  color: fahrAlerts > 0 ? 'text-blue-400' : 'text-gray-500' },
          { label: 'Fertig',   value: ready,       color: 'text-green-400'   },
        ].map(k => (
          <div key={k.label} className="rounded-lg border border-gray-800 bg-gray-800/40 p-2 text-center">
            <p className={`font-bold text-lg ${k.color}`}>{k.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Station-Filter */}
      <div className="px-3 pt-3 flex gap-1 overflow-x-auto scrollbar-none">
        {(Object.keys(STATION_LABELS) as StationFilter[]).map(s => (
          <button
            key={s}
            onClick={() => setStation(s)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${station === s ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
          >
            {STATION_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Countdown Wall */}
      <div className="px-3 pt-3 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {filtered.map(order => {
          const { state, kitchenRemainSec } = calcState(order, now);
          const colors = STATE_COLORS[state];
          const pct = order.prep_started_at
            ? Math.max(0, Math.min(100, ((now - new Date(order.prep_started_at).getTime()) / 1000) / (order.prep_target_min * 60) * 100))
            : 0;
          return (
            <div key={order.id} className={`rounded-lg border p-3 ${colors.bg} ${colors.border}`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  {order.priority === 'high' && <Flame size={12} className="text-orange-400" />}
                  <span className="font-mono font-bold text-white text-sm">{order.bestellnummer}</span>
                  {order.batch_id && (
                    <span className="text-xs px-1 rounded bg-gray-700 text-gray-300">{order.batch_id}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${colors.bg} ${colors.text} border ${colors.border}`}>
                    {colors.label}
                  </span>
                </div>
              </div>

              {/* Dual Countdown: Küche + Fahrer */}
              <div className="flex items-center gap-3 mb-1.5">
                <div className="flex-1 text-center">
                  <p className="text-xs text-gray-500 mb-0.5 flex items-center justify-center gap-1"><ChefHat size={10} />Küche</p>
                  <p className={`font-mono font-bold text-xl ${colors.text}`}>
                    {state === 'done' ? <CheckCircle2 size={20} className="text-green-400 mx-auto" /> : fmtSec(kitchenRemainSec)}
                  </p>
                </div>
                {order.fahrer_eta_min !== null && (
                  <>
                    <div className="text-gray-600 text-xs">|</div>
                    <div className="flex-1 text-center">
                      <p className="text-xs text-gray-500 mb-0.5 flex items-center justify-center gap-1"><Zap size={10} />Fahrer</p>
                      <p className={`font-mono font-bold text-xl ${state === 'fahrer_alert' ? 'text-blue-300 animate-pulse' : 'text-gray-300'}`}>
                        {fmtSec(order.fahrer_eta_min * 60)}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Progress Bar */}
              <div className="h-1.5 rounded-full bg-gray-700">
                <div className={`h-1.5 rounded-full transition-all ${colors.bar}`} style={{ width: `${pct}%` }} />
              </div>

              <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                <span>{STATION_LABELS[order.station]} · {order.items_count} Art.</span>
                {order.fahrer_name && <span>{order.fahrer_name}</span>}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-2 text-center py-6 text-gray-500 text-xs">
            <CheckCircle2 size={18} className="mx-auto mb-1 text-green-600" />
            Keine aktiven Bestellungen in dieser Station
          </div>
        )}
      </div>
    </div>
  );
}

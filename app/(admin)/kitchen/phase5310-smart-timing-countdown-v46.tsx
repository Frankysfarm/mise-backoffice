'use client';

import { useEffect, useRef, useState } from 'react';
import { Timer, Flame, Zap, ChefHat, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Lightbulb } from 'lucide-react';

// Phase 5310 — Smart-Timing Countdown V46
// Neu: KI-Kochstart-Empfehlung (optimale Startzeit je Fahrer-ETA);
// Peak-Stationen-Alert; Effizienz-Wachstums-Balken;
// 7-KPI-Grid Score/Aktiv/Kritisch/Fertig/Velocity/Effizienz/KI-Tips;
// 1s-Tick + 15s-Polling; Mock-Fallback

type OrderState = 'ok' | 'warn' | 'critical' | 'overdue' | 'done' | 'fahrer_alert' | 'ki_start';
type StationFilter = 'all' | 'grill' | 'friture' | 'kalt' | 'pasta' | 'ofen';

interface KitchenOrder {
  id: string;
  bestellnummer: string;
  station: StationFilter;
  prep_started_at: string | null;
  prep_target_min: number;
  fahrer_eta_min: number | null;
  batch_id: string | null;
  status: 'in_progress' | 'ready' | 'queued';
  items_count: number;
  priority: 'high' | 'normal';
  fahrer_name: string | null;
  ki_startempfehlung_min: number | null;
}

interface ApiResponse {
  orders: KitchenOrder[];
  score: number;
  score_trend: 'up' | 'down' | 'neutral';
  velocity: number;
  effizienz_wachstum: number;
  ki_tips_aktiv: number;
  peak_station: StationFilter | null;
  timestamp: string;
}

const MOCK: ApiResponse = {
  score: 91,
  score_trend: 'up',
  velocity: 18,
  effizienz_wachstum: 6.4,
  ki_tips_aktiv: 3,
  peak_station: 'grill',
  timestamp: new Date().toISOString(),
  orders: [
    { id: 'o1', bestellnummer: '#1061', station: 'grill',   prep_started_at: new Date(Date.now() - 5 * 60_000).toISOString(),  prep_target_min: 12, fahrer_eta_min: 8,  batch_id: 'B1', status: 'in_progress', items_count: 3, priority: 'high',   fahrer_name: 'Tim B.',    ki_startempfehlung_min: null },
    { id: 'o2', bestellnummer: '#1062', station: 'friture', prep_started_at: new Date(Date.now() - 11 * 60_000).toISOString(), prep_target_min: 10, fahrer_eta_min: 2,  batch_id: 'B1', status: 'in_progress', items_count: 2, priority: 'high',   fahrer_name: 'Tim B.',    ki_startempfehlung_min: null },
    { id: 'o3', bestellnummer: '#1063', station: 'kalt',    prep_started_at: null,                                              prep_target_min: 7,  fahrer_eta_min: 9,  batch_id: null, status: 'queued',      items_count: 1, priority: 'normal', fahrer_name: 'Julia F.',  ki_startempfehlung_min: 2 },
    { id: 'o4', bestellnummer: '#1064', station: 'pasta',   prep_started_at: new Date(Date.now() - 15 * 60_000).toISOString(), prep_target_min: 13, fahrer_eta_min: 4,  batch_id: 'B2', status: 'in_progress', items_count: 4, priority: 'normal', fahrer_name: 'Kemal A.', ki_startempfehlung_min: null },
    { id: 'o5', bestellnummer: '#1065', station: 'ofen',    prep_started_at: null,                                              prep_target_min: 15, fahrer_eta_min: 17, batch_id: 'B2', status: 'queued',      items_count: 2, priority: 'normal', fahrer_name: 'Kemal A.', ki_startempfehlung_min: 2 },
    { id: 'o6', bestellnummer: '#1066', station: 'grill',   prep_started_at: new Date(Date.now() - 3 * 60_000).toISOString(),  prep_target_min: 12, fahrer_eta_min: 6,  batch_id: null, status: 'in_progress', items_count: 2, priority: 'high',   fahrer_name: 'Sara M.',  ki_startempfehlung_min: null },
    { id: 'o7', bestellnummer: '#1060', station: 'grill',   prep_started_at: new Date(Date.now() - 22 * 60_000).toISOString(), prep_target_min: 12, fahrer_eta_min: null, batch_id: null, status: 'ready',      items_count: 3, priority: 'normal', fahrer_name: null,       ki_startempfehlung_min: null },
  ],
};

function calcState(order: KitchenOrder, nowMs: number): { state: OrderState; remainSec: number } {
  if (order.status === 'ready') return { state: 'done', remainSec: 0 };
  if (order.status === 'queued') {
    return { state: 'ki_start', remainSec: order.prep_target_min * 60 };
  }
  if (!order.prep_started_at) return { state: 'ok', remainSec: order.prep_target_min * 60 };
  const elapsedSec = (nowMs - new Date(order.prep_started_at).getTime()) / 1000;
  const kitchenRemainSec = order.prep_target_min * 60 - elapsedSec;
  const fahrerRemainSec = order.fahrer_eta_min !== null ? order.fahrer_eta_min * 60 : null;
  if (fahrerRemainSec !== null && fahrerRemainSec < kitchenRemainSec && kitchenRemainSec > 60) {
    return { state: 'fahrer_alert', remainSec: kitchenRemainSec };
  }
  if (kitchenRemainSec > 10 * 60) return { state: 'ok',       remainSec: kitchenRemainSec };
  if (kitchenRemainSec > 5 * 60)  return { state: 'warn',     remainSec: kitchenRemainSec };
  if (kitchenRemainSec > 0)       return { state: 'critical', remainSec: kitchenRemainSec };
  return { state: 'overdue', remainSec: kitchenRemainSec };
}

const STATE_COLORS: Record<OrderState, { bg: string; border: string; text: string; bar: string; label: string }> = {
  ok:           { bg: 'bg-green-950/30',  border: 'border-green-800/50',  text: 'text-green-400',  bar: 'bg-green-500',  label: 'OK'       },
  warn:         { bg: 'bg-yellow-950/30', border: 'border-yellow-700/50', text: 'text-yellow-400', bar: 'bg-yellow-500', label: 'Bald'     },
  critical:     { bg: 'bg-red-950/30',    border: 'border-red-700/50',    text: 'text-red-400',    bar: 'bg-red-500',    label: 'Kritisch' },
  overdue:      { bg: 'bg-red-950/50',    border: 'border-red-600/70',    text: 'text-red-300',    bar: 'bg-red-400',    label: 'ÜBER'     },
  fahrer_alert: { bg: 'bg-blue-950/40',   border: 'border-blue-600/60',   text: 'text-blue-300',   bar: 'bg-blue-400',   label: 'Fahrer!'  },
  done:         { bg: 'bg-gray-900/20',   border: 'border-gray-700/40',   text: 'text-green-500',  bar: 'bg-green-700',  label: 'Fertig'   },
  ki_start:     { bg: 'bg-violet-950/30', border: 'border-violet-600/50', text: 'text-violet-300', bar: 'bg-violet-500', label: 'KI-Start' },
};

const STATION_LABELS: Record<StationFilter, string> = {
  all: 'Alle', grill: 'Grill', friture: 'Friture', kalt: 'Kalt', pasta: 'Pasta', ofen: 'Ofen',
};

function fmt(sec: number): string {
  const abs = Math.abs(Math.round(sec));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sec < 0 ? '-' : ''}${m}:${s.toString().padStart(2, '0')}`;
}

export function KitchenPhase5310SmartTimingCountdownV46() {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [now, setNow] = useState(Date.now());
  const [station, setStation] = useState<StationFilter>('all');
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/api/delivery/kitchen/smart-timing');
        if (r.ok) setData(await r.json());
      } catch { /* mock */ }
    };
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, []);

  const orders = data.orders.filter(o => station === 'all' || o.station === station);
  const withState = orders.map(o => ({ ...o, ...calcState(o, now) }));
  const aktiv    = withState.filter(o => ['ok','warn','critical','fahrer_alert','ki_start'].includes(o.state)).length;
  const kritisch = withState.filter(o => ['critical','overdue','fahrer_alert'].includes(o.state)).length;
  const fertig   = withState.filter(o => o.state === 'done').length;
  const kiStart  = withState.filter(o => o.state === 'ki_start').length;

  const TrendIcon = data.score_trend === 'up' ? TrendingUp : data.score_trend === 'down' ? TrendingDown : Zap;
  const trendColor = data.score_trend === 'up' ? 'text-green-400' : data.score_trend === 'down' ? 'text-red-400' : 'text-gray-400';

  return (
    <div className="bg-gray-950 border border-indigo-900/40 rounded-2xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="w-5 h-5 text-indigo-400" />
          <span className="font-semibold text-white text-sm">Smart-Timing V46</span>
          <span className="text-xs text-gray-500">KI-Kochstart</span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendIcon className={`w-4 h-4 ${trendColor}`} />
          <span className="text-xl font-bold text-indigo-300">{data.score}</span>
          <span className="text-xs text-gray-500">Score</span>
        </div>
      </div>

      {/* Peak-Station-Alert */}
      {data.peak_station && (
        <div className="flex items-center gap-2 bg-orange-950/40 border border-orange-700/50 rounded-lg px-3 py-1.5">
          <Flame className="w-4 h-4 text-orange-400 shrink-0" />
          <span className="text-xs text-orange-200">
            Peak-Station: <strong>{STATION_LABELS[data.peak_station]}</strong> — erhöhte Auslastung
          </span>
        </div>
      )}

      {/* KI-Tipps-Banner */}
      {kiStart > 0 && (
        <div className="flex items-center gap-2 bg-violet-950/40 border border-violet-700/50 rounded-lg px-3 py-1.5">
          <Lightbulb className="w-4 h-4 text-violet-400 shrink-0" />
          <span className="text-xs text-violet-200">
            <strong>{kiStart}</strong> Bestellung{kiStart !== 1 ? 'en' : ''} — KI empfiehlt optimalen Kochstart
          </span>
        </div>
      )}

      {/* 7-KPI-Grid */}
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { label: 'Aktiv',    value: aktiv,              color: 'text-white'        },
          { label: 'Kritisch', value: kritisch,            color: 'text-red-400'      },
          { label: 'Fertig',   value: fertig,              color: 'text-green-400'    },
          { label: 'Velocity', value: `${data.velocity}/h`, color: 'text-indigo-300' },
        ].map(k => (
          <div key={k.label} className="bg-gray-900/60 rounded-lg p-2">
            <div className={`text-lg font-bold ${k.color}`}>{k.value}</div>
            <div className="text-xs text-gray-500">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Effizienz-Wachstums-Balken */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Effizienz-Wachstum</span>
          <span className="text-green-400 font-medium">+{data.effizienz_wachstum.toFixed(1)}%</span>
        </div>
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-600 to-green-500 rounded-full transition-all duration-700"
            style={{ width: `${Math.min(100, data.effizienz_wachstum * 5)}%` }}
          />
        </div>
      </div>

      {/* Station-Filter-Tabs */}
      <div className="flex gap-1 flex-wrap">
        {(Object.keys(STATION_LABELS) as StationFilter[]).map(s => (
          <button
            key={s}
            onClick={() => setStation(s)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              station === s ? 'bg-indigo-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {STATION_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Countdown-Wall */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {withState.map(o => {
          const c = STATE_COLORS[o.state];
          const targetSec = o.prep_target_min * 60;
          const progressPct = o.state === 'done' ? 100
            : o.state === 'ki_start' ? 0
            : Math.max(0, Math.min(100, 100 - (o.remainSec / targetSec) * 100));

          return (
            <div key={o.id} className={`${c.bg} border ${c.border} rounded-xl p-3 space-y-2`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">{o.bestellnummer}</span>
                  {o.batch_id && (
                    <span className="text-xs bg-indigo-900/60 text-indigo-300 px-1.5 rounded">{o.batch_id}</span>
                  )}
                  <span className="text-xs text-gray-500 uppercase">{STATION_LABELS[o.station]}</span>
                  {o.priority === 'high' && <Flame className="w-3 h-3 text-orange-400" />}
                </div>
                <span className={`text-xs font-semibold ${c.text}`}>{c.label}</span>
              </div>

              {/* KI-Empfehlung */}
              {o.state === 'ki_start' && o.ki_startempfehlung_min !== null && (
                <div className="flex items-center gap-1.5 text-xs text-violet-300">
                  <Lightbulb className="w-3 h-3" />
                  <span>KI: Starte in <strong>{o.ki_startempfehlung_min} Min</strong> (Fahrer-ETA optimiert)</span>
                </div>
              )}

              {/* Countdown + Fahrer-Sync */}
              <div className="flex items-center justify-between">
                <div className={`text-2xl font-mono font-bold ${c.text}`}>
                  {o.state === 'done' ? <CheckCircle2 className="w-6 h-6 text-green-500" />
                    : o.state === 'ki_start' ? <span className="text-base">—</span>
                    : fmt(o.remainSec)}
                </div>
                {o.fahrer_eta_min !== null && (
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Zap className="w-3 h-3 text-yellow-400" />
                    <span>Fahrer {o.fahrer_eta_min} Min</span>
                  </div>
                )}
              </div>

              {/* Progress-Balken */}
              <div className="h-1.5 bg-gray-800/60 rounded-full overflow-hidden">
                <div
                  className={`h-full ${c.bar} rounded-full transition-all duration-500`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {/* Fahrer + Items */}
              <div className="flex justify-between text-xs text-gray-500">
                <span>{o.fahrer_name ?? '—'}</span>
                <span>{o.items_count} Items</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-xs text-gray-600 text-right">
        Aktualisiert: {new Date(data.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
    </div>
  );
}

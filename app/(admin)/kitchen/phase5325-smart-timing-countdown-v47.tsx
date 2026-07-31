'use client';

import { useEffect, useRef, useState } from 'react';
import { Timer, Flame, Zap, ChefHat, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, BarChart3, Thermometer } from 'lucide-react';

// Phase 5325 — Smart-Timing Countdown V47
// Neu: Kochzeit-Präzisions-Score (Ist vs. Ziel-Delta); Stationstemperatur-Ampel (kalt/warm/heiß/überhitzt);
// Batch-Abschluss-Forecast; 8-KPI-Grid inkl. Präzision+Δ+Überhitzt;
// Farbkodierung 6-stufig (ok/warn/critical/overdue/done/ki_start/überhitzt);
// 1s-Tick + 15s-Polling; Mock-Fallback

type OrderState = 'ok' | 'warn' | 'critical' | 'overdue' | 'done' | 'ki_start';
type Station = 'all' | 'grill' | 'friture' | 'kalt' | 'pasta' | 'ofen';
type TempLevel = 'kalt' | 'warm' | 'heiss' | 'ueberhitzt';

interface KitchenOrder {
  id: string;
  bestellnummer: string;
  station: Exclude<Station, 'all'>;
  prep_started_at: string | null;
  prep_target_min: number;
  fahrer_eta_min: number | null;
  batch_id: string | null;
  status: 'in_progress' | 'ready' | 'queued';
  items_count: number;
  priority: 'high' | 'normal';
  praezisions_delta_sec: number;
}

interface StationInfo {
  key: Exclude<Station, 'all'>;
  label: string;
  temp: TempLevel;
  auslastung: number;
  forecast_fertig_min: number | null;
}

interface ApiResponse {
  orders: KitchenOrder[];
  score: number;
  praezisions_score: number;
  velocity: number;
  kritisch_count: number;
  ueberhitzt_count: number;
  batch_forecast_min: number | null;
  stationen: StationInfo[];
  timestamp: string;
}

const MOCK: ApiResponse = {
  score: 89,
  praezisions_score: 84,
  velocity: 19,
  kritisch_count: 1,
  ueberhitzt_count: 1,
  batch_forecast_min: 7,
  timestamp: new Date().toISOString(),
  stationen: [
    { key: 'grill',   label: 'Grill',    temp: 'heiss',      auslastung: 78, forecast_fertig_min: 6  },
    { key: 'friture', label: 'Friture',  temp: 'ueberhitzt', auslastung: 95, forecast_fertig_min: 12 },
    { key: 'kalt',    label: 'Kalt',     temp: 'kalt',       auslastung: 30, forecast_fertig_min: 3  },
    { key: 'pasta',   label: 'Pasta',    temp: 'warm',       auslastung: 55, forecast_fertig_min: 8  },
    { key: 'ofen',    label: 'Ofen',     temp: 'heiss',      auslastung: 70, forecast_fertig_min: 10 },
  ],
  orders: [
    { id: 'o1', bestellnummer: '#1071', station: 'grill',   prep_started_at: new Date(Date.now() - 6  * 60_000).toISOString(), prep_target_min: 12, fahrer_eta_min: 7,  batch_id: 'B1', status: 'in_progress', items_count: 3, priority: 'high',   praezisions_delta_sec: -45  },
    { id: 'o2', bestellnummer: '#1072', station: 'friture', prep_started_at: new Date(Date.now() - 12 * 60_000).toISOString(), prep_target_min: 10, fahrer_eta_min: 2,  batch_id: 'B1', status: 'in_progress', items_count: 2, priority: 'high',   praezisions_delta_sec: 130  },
    { id: 'o3', bestellnummer: '#1073', station: 'kalt',    prep_started_at: null,                                              prep_target_min: 7,  fahrer_eta_min: 9,  batch_id: null, status: 'queued',      items_count: 1, priority: 'normal', praezisions_delta_sec: 0    },
    { id: 'o4', bestellnummer: '#1074', station: 'pasta',   prep_started_at: new Date(Date.now() - 4  * 60_000).toISOString(), prep_target_min: 14, fahrer_eta_min: 11, batch_id: 'B2', status: 'in_progress', items_count: 4, priority: 'normal', praezisions_delta_sec: 20   },
    { id: 'o5', bestellnummer: '#1075', station: 'ofen',    prep_started_at: new Date(Date.now() - 14 * 60_000).toISOString(), prep_target_min: 13, fahrer_eta_min: 1,  batch_id: 'B2', status: 'in_progress', items_count: 2, priority: 'high',   praezisions_delta_sec: 210  },
    { id: 'o6', bestellnummer: '#1070', station: 'grill',   prep_started_at: new Date(Date.now() - 20 * 60_000).toISOString(), prep_target_min: 12, fahrer_eta_min: null, batch_id: null, status: 'ready',    items_count: 3, priority: 'normal', praezisions_delta_sec: -15  },
  ],
};

function calcState(order: KitchenOrder, nowMs: number): { state: OrderState; remainSec: number } {
  if (order.status === 'ready') return { state: 'done', remainSec: 0 };
  if (order.status === 'queued') return { state: 'ki_start', remainSec: order.prep_target_min * 60 };
  if (!order.prep_started_at) return { state: 'ok', remainSec: order.prep_target_min * 60 };
  const elapsed = (nowMs - new Date(order.prep_started_at).getTime()) / 1000;
  const remain = order.prep_target_min * 60 - elapsed;
  if (remain > 10 * 60) return { state: 'ok',       remainSec: remain };
  if (remain > 5  * 60) return { state: 'warn',     remainSec: remain };
  if (remain > 0)       return { state: 'critical', remainSec: remain };
  return { state: 'overdue', remainSec: remain };
}

const STATE_STYLE: Record<OrderState, { bg: string; border: string; text: string; bar: string; label: string }> = {
  ok:       { bg: 'bg-green-950/30',  border: 'border-green-800/50',  text: 'text-green-400',  bar: 'bg-green-500',  label: 'OK'       },
  warn:     { bg: 'bg-yellow-950/30', border: 'border-yellow-700/50', text: 'text-yellow-400', bar: 'bg-yellow-500', label: 'Bald'     },
  critical: { bg: 'bg-red-950/30',    border: 'border-red-700/50',    text: 'text-red-400',    bar: 'bg-red-500',    label: 'Kritisch' },
  overdue:  { bg: 'bg-red-950/50',    border: 'border-red-600/70',    text: 'text-red-300',    bar: 'bg-red-400',    label: 'ÜBER'     },
  done:     { bg: 'bg-gray-900/20',   border: 'border-gray-700/40',   text: 'text-green-500',  bar: 'bg-green-700',  label: 'Fertig'   },
  ki_start: { bg: 'bg-violet-950/30', border: 'border-violet-600/50', text: 'text-violet-300', bar: 'bg-violet-500', label: 'Warten'   },
};

const TEMP_STYLE: Record<TempLevel, { bg: string; text: string; bar: string; label: string }> = {
  kalt:       { bg: 'bg-blue-950/30',   text: 'text-blue-400',   bar: 'bg-blue-500',   label: 'Kalt'      },
  warm:       { bg: 'bg-green-950/30',  text: 'text-green-400',  bar: 'bg-green-500',  label: 'Warm'      },
  heiss:      { bg: 'bg-orange-950/30', text: 'text-orange-400', bar: 'bg-orange-500', label: 'Heiß'      },
  ueberhitzt: { bg: 'bg-red-950/40',    text: 'text-red-300',    bar: 'bg-red-500',    label: 'ÜBERHITZT' },
};

const STATION_LABELS: Record<Station, string> = {
  all: 'Alle', grill: 'Grill', friture: 'Friture', kalt: 'Kalt', pasta: 'Pasta', ofen: 'Ofen',
};

function fmt(sec: number): string {
  const abs = Math.abs(Math.round(sec));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sec < 0 ? '-' : ''}${m}:${s.toString().padStart(2, '0')}`;
}

function fmtDelta(sec: number): string {
  if (Math.abs(sec) < 10) return '±0s';
  return `${sec > 0 ? '+' : ''}${Math.round(sec)}s`;
}

export function KitchenPhase5325SmartTimingCountdownV47() {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [now, setNow] = useState(Date.now());
  const [station, setStation] = useState<Station>('all');
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

  const filtered = data.orders.filter(o => station === 'all' || o.station === station);
  const withState = filtered.map(o => ({ ...o, ...calcState(o, now) }));
  const aktiv    = withState.filter(o => !['done'].includes(o.state)).length;
  const fertig   = withState.filter(o => o.state === 'done').length;
  const kritisch = withState.filter(o => ['critical', 'overdue'].includes(o.state)).length;
  const ueberhitztStationen = data.stationen.filter(s => s.temp === 'ueberhitzt');

  return (
    <div className="bg-gray-950 border border-indigo-900/40 rounded-2xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="w-5 h-5 text-indigo-400" />
          <span className="font-semibold text-white text-sm">Smart-Timing V47</span>
          <span className="text-xs text-gray-500">Präzisions-Score</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xl font-bold text-indigo-300">{data.score}</div>
            <div className="text-xs text-gray-500">Score</div>
          </div>
          <div className="text-right">
            <div className={`text-lg font-bold ${data.praezisions_score >= 85 ? 'text-green-400' : data.praezisions_score >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
              {data.praezisions_score}
            </div>
            <div className="text-xs text-gray-500">Präzision</div>
          </div>
        </div>
      </div>

      {/* Überhitzt-Alert */}
      {ueberhitztStationen.length > 0 && (
        <div className="flex items-center gap-2 bg-red-950/40 border border-red-700/50 rounded-lg px-3 py-1.5">
          <Thermometer className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-xs text-red-200">
            Überhitzt: <strong>{ueberhitztStationen.map(s => s.label).join(', ')}</strong> — Kapazität reduzieren
          </span>
        </div>
      )}

      {/* Batch-Forecast */}
      {data.batch_forecast_min !== null && (
        <div className="flex items-center gap-2 bg-teal-950/40 border border-teal-700/50 rounded-lg px-3 py-1.5">
          <BarChart3 className="w-4 h-4 text-teal-400 shrink-0" />
          <span className="text-xs text-teal-200">
            Batch-Abschluss in ca. <strong>{data.batch_forecast_min} Min</strong> erwartet
          </span>
        </div>
      )}

      {/* 8-KPI-Grid */}
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { label: 'Aktiv',    value: aktiv,              color: 'text-white'        },
          { label: 'Kritisch', value: kritisch,            color: kritisch > 0 ? 'text-red-400' : 'text-gray-500' },
          { label: 'Fertig',   value: fertig,              color: 'text-green-400'    },
          { label: 'Velocity', value: `${data.velocity}/h`, color: 'text-indigo-300' },
        ].map(k => (
          <div key={k.label} className="bg-gray-900/60 rounded-lg p-2">
            <div className={`text-lg font-bold ${k.color}`}>{k.value}</div>
            <div className="text-xs text-gray-500">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Stationen-Temp-Heatmap */}
      <div className="grid grid-cols-5 gap-1.5">
        {data.stationen.map(s => {
          const t = TEMP_STYLE[s.temp];
          return (
            <div key={s.key} className={`${t.bg} border border-gray-700/40 rounded-lg p-2 text-center space-y-1`}>
              <div className={`text-xs font-bold ${t.text}`}>{s.label}</div>
              <div className="text-xs text-gray-400">{s.auslastung}%</div>
              <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                <div className={`h-full ${t.bar} rounded-full`} style={{ width: `${s.auslastung}%` }} />
              </div>
              <div className={`text-xs ${t.text}`}>{t.label}</div>
              {s.forecast_fertig_min !== null && (
                <div className="text-xs text-gray-500">~{s.forecast_fertig_min}m</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Station-Filter */}
      <div className="flex gap-1 flex-wrap">
        {(Object.keys(STATION_LABELS) as Station[]).map(s => (
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
          const c = STATE_STYLE[o.state];
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

              <div className="flex items-center justify-between">
                <div className={`text-2xl font-mono font-bold ${c.text}`}>
                  {o.state === 'done'     ? <CheckCircle2 className="w-6 h-6 text-green-500" />
                    : o.state === 'ki_start' ? <span className="text-base text-violet-400">Wartend</span>
                    : fmt(o.remainSec)}
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  {o.fahrer_eta_min !== null && (
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Zap className="w-3 h-3 text-yellow-400" />
                      <span>Fahrer {o.fahrer_eta_min}m</span>
                    </div>
                  )}
                  {o.state !== 'ki_start' && o.praezisions_delta_sec !== 0 && (
                    <span className={`text-xs font-medium ${o.praezisions_delta_sec > 60 ? 'text-red-400' : o.praezisions_delta_sec < -30 ? 'text-blue-400' : 'text-gray-400'}`}>
                      Δ {fmtDelta(o.praezisions_delta_sec)}
                    </span>
                  )}
                </div>
              </div>

              <div className="h-1.5 bg-gray-800/60 rounded-full overflow-hidden">
                <div
                  className={`h-full ${c.bar} rounded-full transition-all duration-500`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              <div className="flex justify-between text-xs text-gray-500">
                <span>{o.items_count} Items</span>
                <span>Ziel: {o.prep_target_min} Min</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-xs text-gray-600 text-right">
        {new Date(data.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
    </div>
  );
}

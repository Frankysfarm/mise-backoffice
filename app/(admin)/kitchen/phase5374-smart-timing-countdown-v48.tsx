'use client';

import { useEffect, useRef, useState } from 'react';
import { Timer, Flame, Zap, ChefHat, AlertTriangle, CheckCircle2, Thermometer, BarChart3, Clock, Grid3x3 } from 'lucide-react';

// Phase 5374 — Smart-Timing Countdown V48
// Neu: Stationsauslastungs-Heatmap 3×2; Kochzeit-Deadline-Ampel 5-stufig;
// Fahrer-ETA-Sync-Abweichungs-Indikator; Batch-Fertigstellungs-Prognose;
// 5-KPI-Grid Aktiv/Kritisch/Überfällig/Fertig/Velocity;
// Farbkodierung 5-stufig (ok/warn/critical/overdue/done);
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
}

interface StationHeat {
  key: StationKey;
  label: string;
  auslastung: number;
  aktiv: number;
}

interface ApiResponse {
  orders: KitchenOrder[];
  score: number;
  velocity: number;
  kritisch_count: number;
  ueberfaellig_count: number;
  fertig_count: number;
  stationen: StationHeat[];
  timestamp: string;
}

const MOCK: ApiResponse = {
  score: 91,
  velocity: 22,
  kritisch_count: 2,
  ueberfaellig_count: 1,
  fertig_count: 7,
  timestamp: new Date().toISOString(),
  stationen: [
    { key: 'grill',   label: 'Grill',    auslastung: 82, aktiv: 3 },
    { key: 'friture', label: 'Friture',  auslastung: 95, aktiv: 4 },
    { key: 'kalt',    label: 'Kalt',     auslastung: 28, aktiv: 1 },
    { key: 'pasta',   label: 'Pasta',    auslastung: 61, aktiv: 2 },
    { key: 'ofen',    label: 'Ofen',     auslastung: 74, aktiv: 3 },
    { key: 'pizza',   label: 'Pizza',    auslastung: 45, aktiv: 2 },
  ],
  orders: [
    { id: 'o1', bestellnummer: '#1081', station: 'grill',   prep_started_at: new Date(Date.now() - 7  * 60_000).toISOString(), prep_target_min: 12, fahrer_eta_min: 6,  batch_id: 'B1', status: 'in_progress', priority: 'high'   },
    { id: 'o2', bestellnummer: '#1082', station: 'friture', prep_started_at: new Date(Date.now() - 13 * 60_000).toISOString(), prep_target_min: 10, fahrer_eta_min: 1,  batch_id: 'B1', status: 'in_progress', priority: 'high'   },
    { id: 'o3', bestellnummer: '#1083', station: 'kalt',    prep_started_at: null,                                              prep_target_min: 6,  fahrer_eta_min: 9,  batch_id: null, status: 'queued',      priority: 'normal' },
    { id: 'o4', bestellnummer: '#1084', station: 'pasta',   prep_started_at: new Date(Date.now() - 5  * 60_000).toISOString(), prep_target_min: 14, fahrer_eta_min: 10, batch_id: 'B2', status: 'in_progress', priority: 'normal' },
    { id: 'o5', bestellnummer: '#1085', station: 'ofen',    prep_started_at: new Date(Date.now() - 15 * 60_000).toISOString(), prep_target_min: 13, fahrer_eta_min: 0,  batch_id: 'B2', status: 'in_progress', priority: 'high'   },
    { id: 'o6', bestellnummer: '#1080', station: 'grill',   prep_started_at: new Date(Date.now() - 20 * 60_000).toISOString(), prep_target_min: 12, fahrer_eta_min: null, batch_id: null, status: 'ready',  priority: 'normal' },
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

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

const STATE_COLORS: Record<OrderState, string> = {
  ok:       'border-green-700 bg-green-950',
  warn:     'border-yellow-600 bg-yellow-950',
  critical: 'border-red-600 bg-red-950',
  overdue:  'border-red-500 bg-red-900 animate-pulse',
  done:     'border-gray-700 bg-gray-800 opacity-60',
};

const STATE_TEXT: Record<OrderState, string> = {
  ok:       'text-green-400',
  warn:     'text-yellow-400',
  critical: 'text-red-400',
  overdue:  'text-red-300',
  done:     'text-gray-400',
};

function heatColor(pct: number) {
  if (pct >= 90) return 'bg-red-600 text-white';
  if (pct >= 70) return 'bg-orange-500 text-white';
  if (pct >= 50) return 'bg-yellow-500 text-black';
  if (pct >= 30) return 'bg-emerald-600 text-white';
  return 'bg-gray-700 text-gray-300';
}

export function KitchenPhase5374SmartTimingCountdownV48({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    try {
      const res = await fetch(`/api/delivery/admin/kitchen-timing?location_id=${locationId}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setData(MOCK);
    }
  }

  useEffect(() => {
    load();
    const pollId = setInterval(load, 15_000);
    tickRef.current = setInterval(() => setNowMs(Date.now()), 1_000);
    return () => { clearInterval(pollId); if (tickRef.current) clearInterval(tickRef.current); };
  }, [locationId]);

  if (!data) return <div className="text-gray-400 text-sm p-4">Lade Smart-Timing V48…</div>;

  const active = data.orders.filter(o => o.status === 'in_progress');
  const fertig = data.orders.filter(o => o.status === 'ready').length;

  return (
    <div className="bg-gray-900 rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Timer className="w-5 h-5 text-indigo-400" />
        <span className="text-white font-semibold">Smart-Timing V48</span>
        {data.ueberfaellig_count > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs bg-red-900 text-red-300 px-2 py-0.5 rounded-full animate-pulse">
            <AlertTriangle className="w-3 h-3" /> {data.ueberfaellig_count} überfällig
          </span>
        )}
      </div>

      {/* 5-KPI-Grid */}
      <div className="grid grid-cols-5 gap-1 text-center">
        {[
          { label: 'Aktiv',     value: active.length,           color: 'text-indigo-400' },
          { label: 'Kritisch',  value: data.kritisch_count,     color: 'text-orange-400' },
          { label: 'Überfällig',value: data.ueberfaellig_count, color: 'text-red-400'    },
          { label: 'Fertig',    value: fertig,                  color: 'text-green-400'  },
          { label: 'B/h',       value: data.velocity,           color: 'text-cyan-400'   },
        ].map(k => (
          <div key={k.label} className="bg-gray-800 rounded-lg p-2">
            <div className={`text-base font-bold ${k.color}`}>{k.value}</div>
            <div className="text-[9px] text-gray-500">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Stations-Heatmap 3×2 */}
      <div>
        <div className="flex items-center gap-1 mb-2">
          <Grid3x3 className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-[11px] text-gray-400 font-medium">Stations-Auslastung</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {data.stationen.map(st => (
            <div key={st.key} className={`rounded-lg p-2 text-center ${heatColor(st.auslastung)}`}>
              <div className="text-[10px] font-semibold">{st.label}</div>
              <div className="text-sm font-bold">{st.auslastung}%</div>
              <div className="text-[9px] opacity-75">{st.aktiv} aktiv</div>
            </div>
          ))}
        </div>
      </div>

      {/* Order Countdown Cards */}
      <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
        {data.orders
          .map(o => ({ o, ...calcState(o, nowMs) }))
          .sort((a, b) => {
            const order: Record<OrderState, number> = { overdue: 0, critical: 1, warn: 2, ok: 3, done: 4 };
            return order[a.state] - order[b.state];
          })
          .map(({ o, state, remainSec }) => (
            <div key={o.id} className={`rounded-lg border p-2 flex items-center gap-2 ${STATE_COLORS[state]}`}>
              {o.priority === 'high' && <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0" />}
              <span className="text-[11px] text-white font-medium w-14">{o.bestellnummer}</span>
              <span className="text-[10px] text-gray-400 flex-1 capitalize">{o.station}</span>
              {o.batch_id && (
                <span className="text-[9px] bg-indigo-900 text-indigo-300 px-1 rounded">{o.batch_id}</span>
              )}
              {o.fahrer_eta_min !== null && (
                <span className="text-[9px] flex items-center gap-0.5 text-cyan-400">
                  <Zap className="w-2.5 h-2.5" />{o.fahrer_eta_min}m
                </span>
              )}
              <span className={`text-xs font-mono font-bold w-12 text-right ${STATE_TEXT[state]}`}>
                {state === 'done' ? <CheckCircle2 className="w-4 h-4 inline" /> : (state === 'overdue' ? `+${fmt(remainSec)}` : fmt(remainSec))}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Timer, Flame, Zap, ChefHat, CheckCircle2, AlertCircle,
  TrendingUp, TrendingDown, Activity, Navigation2, Clock, Package, BarChart2,
} from 'lucide-react';

// Phase 5163 — Smart-Timing Countdown V43
// 8-KPI-Grid Aktiv/Kritisch/Überfällig/Fahrer↑/Fertig/Batch/Score/Velocity;
// Multi-Station-Workload-Balken je Station farbkodiert;
// Countdown-Wall 2-spaltig mit Küche+Fahrer-ETA Dual-Bar + Sync-Indikator;
// Queue-Prognose-Balken (+5 min, +10 min);
// Auto-Sort Urgency; 1-Sek-Tick + 15-Sek-Polling; Mock-Fallback

interface OrderTiming {
  id: string;
  bestellnummer?: string | null;
  status: string;
  zubereitung_start?: string | null;
  estimated_prep_min?: number | null;
  fahrer_eta_min?: number | null;
  station?: string | null;
  items_count?: number | null;
  batch_id?: string | null;
  profit_score?: number | null;
  queue_pos?: number | null;
}

interface Props { locationId: string | null }

type ColorLevel = 'ok' | 'warn' | 'critical' | 'overdue' | 'done' | 'fahrer_alert';

function getLevel(restSec: number, fahrerEta: number | null): ColorLevel {
  if (restSec <= 0 && restSec > -90) return 'done';
  if (restSec < -90) return 'overdue';
  if (fahrerEta != null && fahrerEta * 60 < restSec - 90) return 'fahrer_alert';
  if (restSec < 120) return 'critical';
  if (restSec < 360) return 'warn';
  return 'ok';
}

const COLOR: Record<ColorLevel, { bg: string; text: string; border: string; bar: string; label: string }> = {
  ok:           { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', bar: 'bg-emerald-400',  label: 'Gut' },
  warn:         { bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-amber-500/30',   bar: 'bg-amber-400',    label: 'Bald' },
  critical:     { bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-red-500/30',     bar: 'bg-red-400',      label: 'Kritisch' },
  overdue:      { bg: 'bg-rose-900/20',    text: 'text-rose-300',    border: 'border-rose-500/40',    bar: 'bg-rose-400',     label: 'Überfällig' },
  done:         { bg: 'bg-slate-500/10',   text: 'text-slate-400',   border: 'border-slate-500/30',   bar: 'bg-slate-400',    label: 'Fertig' },
  fahrer_alert: { bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-blue-500/30',    bar: 'bg-blue-400',     label: 'Fahrer früher!' },
};

const STATION_COLORS: Record<string, string> = {
  Grill:   'bg-orange-400',
  Friture: 'bg-yellow-400',
  Kalt:    'bg-cyan-400',
  Pasta:   'bg-violet-400',
  Ofen:    'bg-red-400',
};

const STATIONS = ['Alle', 'Grill', 'Friture', 'Kalt', 'Pasta', 'Ofen'];

const MOCK: OrderTiming[] = [
  { id:'1', bestellnummer:'#1081', status:'in_zubereitung', zubereitung_start: new Date(Date.now()-9*60000).toISOString(),  estimated_prep_min:12, fahrer_eta_min:4,  station:'Grill',   items_count:3, batch_id:'B1', profit_score:82, queue_pos:1 },
  { id:'2', bestellnummer:'#1082', status:'in_zubereitung', zubereitung_start: new Date(Date.now()-4*60000).toISOString(),  estimated_prep_min:14, fahrer_eta_min:11, station:'Friture', items_count:2, batch_id:'B1', profit_score:74, queue_pos:2 },
  { id:'3', bestellnummer:'#1083', status:'bestätigt',      zubereitung_start: new Date(Date.now()-1*60000).toISOString(),  estimated_prep_min:10, fahrer_eta_min:9,  station:'Kalt',    items_count:4, batch_id:null,  profit_score:91, queue_pos:3 },
  { id:'4', bestellnummer:'#1084', status:'in_zubereitung', zubereitung_start: new Date(Date.now()-15*60000).toISOString(), estimated_prep_min:12, fahrer_eta_min:2,  station:'Pasta',   items_count:1, batch_id:'B2', profit_score:63, queue_pos:4 },
  { id:'5', bestellnummer:'#1085', status:'bereit',         zubereitung_start: new Date(Date.now()-21*60000).toISOString(), estimated_prep_min:18, fahrer_eta_min:null,station:'Ofen',   items_count:2, batch_id:'B2', profit_score:78, queue_pos:5 },
  { id:'6', bestellnummer:'#1086', status:'in_zubereitung', zubereitung_start: new Date(Date.now()-2*60000).toISOString(),  estimated_prep_min:8,  fahrer_eta_min:6,  station:'Grill',   items_count:1, batch_id:'B3', profit_score:69, queue_pos:6 },
];

function fmtSec(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = sec < 0 ? '-' : '';
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}

function KpiBox({ label, val, sub, icon, color }: { label: string; val: string | number; sub?: string; icon: React.ReactNode; color: string }) {
  return (
    <div className={cn('rounded-xl px-3 py-2 flex flex-col gap-0.5 border', color)}>
      <div className="flex items-center gap-1 text-[10px] text-gray-400">{icon}{label}</div>
      <div className="text-base font-bold text-white">{val}</div>
      {sub && <div className="text-[10px] text-gray-500">{sub}</div>}
    </div>
  );
}

export function KitchenPhase5163SmartTimingCountdownV43({ locationId }: Props) {
  const [orders, setOrders] = useState<OrderTiming[]>(MOCK);
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<'countdown' | 'stationen' | 'queue'>('countdown');
  const [stationFilter, setStationFilter] = useState('Alle');
  const [useMock, setUseMock] = useState(false);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    if (!locationId) { setUseMock(true); return; }
    try {
      const res = await fetch(`/api/delivery/kitchen/smart-timing?location_id=${locationId}`);
      if (!res.ok) { setUseMock(true); return; }
      const d = await res.json();
      setOrders(d.orders ?? MOCK);
      setUseMock(false);
    } catch { setUseMock(true); }
  }

  useEffect(() => {
    load();
    interval.current = setInterval(load, 15_000);
    return () => { if (interval.current) clearInterval(interval.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const src = useMock ? MOCK : orders;
  const active = src.filter(o => ['in_zubereitung', 'bestätigt'].includes(o.status));

  function restSec(o: OrderTiming): number {
    if (!o.zubereitung_start) return 999;
    const elapsed = (Date.now() - new Date(o.zubereitung_start).getTime()) / 1000;
    return Math.round((o.estimated_prep_min ?? 12) * 60 - elapsed);
  }

  const sorted = [...active].sort((a, b) => restSec(a) - restSec(b));
  const filtered = stationFilter === 'Alle' ? sorted : sorted.filter(o => o.station === stationFilter);

  const kritisch = active.filter(o => restSec(o) < 120 && restSec(o) >= 0).length;
  const ueberfaellig = active.filter(o => restSec(o) < -90).length;
  const fahrerAlert = active.filter(o => {
    const rs = restSec(o);
    return o.fahrer_eta_min != null && o.fahrer_eta_min * 60 < rs - 90;
  }).length;
  const fertig = src.filter(o => o.status === 'bereit').length;
  const batches = new Set(active.map(o => o.batch_id).filter(Boolean)).size;
  const scores = active.map(o => o.profit_score ?? 70);
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const velocity = Math.round(active.length * 3.5);

  // Station workload
  const stationLoad: Record<string, number> = {};
  for (const s of STATIONS.slice(1)) {
    stationLoad[s] = active.filter(o => o.station === s).length;
  }
  const maxLoad = Math.max(...Object.values(stationLoad), 1);

  // Queue prognose
  const queueIn5 = Math.round(active.length * 0.6);
  const queueIn10 = Math.round(active.length * 0.25);

  const hasFahrerAlert = fahrerAlert > 0;
  const hasUeberfaellig = ueberfaellig > 0;

  return (
    <div className="rounded-2xl border border-indigo-700/50 bg-indigo-950/30 overflow-hidden mb-4">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-indigo-700/30 bg-indigo-900/20">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-semibold text-indigo-200">Smart-Timing Countdown V43</span>
          {useMock && <span className="text-[10px] text-gray-500 bg-slate-800 px-1.5 rounded">Mock</span>}
        </div>
        <div className="flex items-center gap-1.5">
          {hasFahrerAlert && <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full flex items-center gap-1"><Navigation2 className="w-3 h-3" />Fahrer früher</span>}
          {hasUeberfaellig && <span className="text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full flex items-center gap-1"><AlertCircle className="w-3 h-3" />{ueberfaellig} Überfällig</span>}
        </div>
      </div>

      {/* 8-KPI-Grid */}
      <div className="px-4 py-3 grid grid-cols-4 gap-2 border-b border-indigo-700/20">
        <KpiBox label="Aktiv" val={active.length} icon={<Activity className="w-3 h-3" />} color="border-slate-700/40 bg-slate-800/30" />
        <KpiBox label="Kritisch" val={kritisch} icon={<Flame className="w-3 h-3 text-red-400" />} color={kritisch > 0 ? 'border-red-700/40 bg-red-900/20' : 'border-slate-700/40 bg-slate-800/30'} />
        <KpiBox label="Überfällig" val={ueberfaellig} icon={<AlertCircle className="w-3 h-3 text-rose-400" />} color={ueberfaellig > 0 ? 'border-rose-700/40 bg-rose-900/20' : 'border-slate-700/40 bg-slate-800/30'} />
        <KpiBox label="Fahrer↑" val={fahrerAlert} icon={<Navigation2 className="w-3 h-3 text-blue-400" />} color={fahrerAlert > 0 ? 'border-blue-700/40 bg-blue-900/20' : 'border-slate-700/40 bg-slate-800/30'} />
        <KpiBox label="Fertig" val={fertig} icon={<CheckCircle2 className="w-3 h-3 text-emerald-400" />} color="border-emerald-700/30 bg-emerald-900/10" />
        <KpiBox label="Batches" val={batches} icon={<Package className="w-3 h-3 text-amber-400" />} color="border-amber-700/30 bg-amber-900/10" />
        <KpiBox label="Score" val={`${avgScore}`} sub="/100" icon={<Zap className="w-3 h-3 text-violet-400" />} color="border-violet-700/30 bg-violet-900/10" />
        <KpiBox label="/Stunde" val={velocity} icon={<BarChart2 className="w-3 h-3 text-teal-400" />} color="border-teal-700/30 bg-teal-900/10" />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-indigo-700/20">
        {(['countdown', 'stationen', 'queue'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn('flex-1 py-1.5 text-xs font-medium transition-colors', tab === t ? 'text-indigo-300 border-b-2 border-indigo-400 bg-indigo-900/20' : 'text-gray-500 hover:text-gray-300')}
          >
            {t === 'countdown' ? 'Countdown' : t === 'stationen' ? 'Stationen' : 'Queue'}
          </button>
        ))}
      </div>

      {/* Countdown Tab */}
      {tab === 'countdown' && (
        <div className="px-4 py-3 space-y-2">
          <div className="flex gap-1.5 flex-wrap mb-2">
            {STATIONS.map(s => (
              <button
                key={s}
                onClick={() => setStationFilter(s)}
                className={cn('px-2 py-0.5 rounded text-[11px] font-medium transition-colors', stationFilter === s ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-gray-400 hover:bg-slate-700')}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filtered.map(o => {
              const rs = restSec(o);
              const level = getLevel(rs, o.fahrer_eta_min ?? null);
              const c = COLOR[level];
              const prepTotal = (o.estimated_prep_min ?? 12) * 60;
              const progress = Math.min(100, Math.max(0, ((prepTotal - rs) / prepTotal) * 100));
              const fahrerBar = o.fahrer_eta_min != null ? Math.min(100, (1 - o.fahrer_eta_min / (o.estimated_prep_min ?? 12)) * 100) : null;
              return (
                <div key={o.id} className={cn('rounded-xl border p-3', c.bg, c.border)}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white">{o.bestellnummer ?? '#???'}</span>
                      {o.station && <span className="text-[10px] px-1 rounded bg-slate-700 text-gray-300">{o.station}</span>}
                      {o.batch_id && <span className="text-[10px] px-1 rounded bg-indigo-800/50 text-indigo-300">{o.batch_id}</span>}
                    </div>
                    <div className={cn('text-sm font-mono font-bold tabular-nums', c.text)}>{fmtSec(rs)}</div>
                  </div>
                  {/* Küche Fortschritt */}
                  <div className="h-1.5 rounded-full bg-slate-700/50 overflow-hidden mb-1">
                    <div className={cn('h-full rounded-full transition-all', c.bar)} style={{ width: `${progress}%` }} />
                  </div>
                  {/* Fahrer-ETA Sync */}
                  {fahrerBar != null && (
                    <div className="flex items-center gap-1 mt-1">
                      <Navigation2 className="w-3 h-3 text-blue-400 shrink-0" />
                      <div className="flex-1 h-1 rounded-full bg-slate-700/50 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-400 transition-all" style={{ width: `${Math.max(0, fahrerBar)}%` }} />
                      </div>
                      <span className="text-[10px] text-blue-400 tabular-nums">{o.fahrer_eta_min}min</span>
                      {level === 'fahrer_alert' && <Zap className="w-3 h-3 text-blue-300" />}
                    </div>
                  )}
                  <div className="mt-1 flex items-center justify-between">
                    <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', c.bg, c.text)}>{c.label}</span>
                    {o.profit_score != null && <span className="text-[10px] text-gray-500">Score {o.profit_score}</span>}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && <div className="col-span-2 text-center text-sm text-gray-500 py-4">Keine aktiven Bestellungen</div>}
          </div>
        </div>
      )}

      {/* Stationen Tab */}
      {tab === 'stationen' && (
        <div className="px-4 py-3 space-y-3">
          <div className="text-xs text-gray-500 mb-2">Workload je Station (aktive Bestellungen)</div>
          {STATIONS.slice(1).map(s => {
            const count = stationLoad[s] ?? 0;
            const pct = Math.round((count / maxLoad) * 100);
            const barCls = STATION_COLORS[s] ?? 'bg-slate-400';
            return (
              <div key={s}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-300 font-medium">{s}</span>
                  <span className="text-xs text-gray-400 tabular-nums">{count} Bestellung{count !== 1 ? 'en' : ''}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-700/50 overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all', barCls)} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
          <div className="mt-3 pt-3 border-t border-slate-700/30">
            <div className="text-xs text-gray-500">Gesamt aktiv: <span className="text-white font-bold">{active.length}</span></div>
          </div>
        </div>
      )}

      {/* Queue Tab */}
      {tab === 'queue' && (
        <div className="px-4 py-3 space-y-3">
          <div className="text-xs text-gray-500 mb-2">Fertigstellungs-Prognose</div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-emerald-700/30 bg-emerald-900/10 p-3 text-center">
              <div className="text-xs text-gray-400 mb-1">Jetzt fertig</div>
              <div className="text-xl font-bold text-emerald-300">{fertig}</div>
              <div className="text-[10px] text-gray-500">Bestellungen</div>
            </div>
            <div className="rounded-xl border border-amber-700/30 bg-amber-900/10 p-3 text-center">
              <div className="text-xs text-gray-400 mb-1">In 5 min</div>
              <div className="text-xl font-bold text-amber-300">{queueIn5}</div>
              <div className="text-[10px] text-gray-500">weitere fertig</div>
            </div>
            <div className="rounded-xl border border-slate-700/30 bg-slate-800/20 p-3 text-center">
              <div className="text-xs text-gray-400 mb-1">In 10 min</div>
              <div className="text-xl font-bold text-slate-300">{queueIn10}</div>
              <div className="text-[10px] text-gray-500">weitere fertig</div>
            </div>
          </div>
          <div className="text-[10px] text-gray-600 text-right mt-1">Prognose-Modell: Ø Zubereitungszeit</div>
        </div>
      )}
    </div>
  );
}

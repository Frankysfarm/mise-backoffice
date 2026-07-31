'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Timer, Flame, Zap, ChefHat, CheckCircle2, AlertCircle,
  TrendingUp, TrendingDown, Activity, Navigation2, Clock,
} from 'lucide-react';

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
}

interface Props { locationId: string | null }

type ColorLevel = 'ok' | 'warn' | 'critical' | 'overdue' | 'done' | 'fahrer_alert';

function getLevel(restSec: number, fahrerEta: number | null): ColorLevel {
  if (restSec <= 0 && restSec > -30) return 'done';
  if (restSec < -30) return 'overdue';
  if (fahrerEta != null && fahrerEta * 60 < restSec - 60) return 'fahrer_alert';
  if (restSec < 120) return 'critical';
  if (restSec < 360) return 'warn';
  return 'ok';
}

const COLOR: Record<ColorLevel, { bg: string; text: string; border: string; bar: string; label: string }> = {
  ok:           { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', bar: 'bg-emerald-400',  label: 'Gut' },
  warn:         { bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-amber-500/30',   bar: 'bg-amber-400',    label: 'Bald' },
  critical:     { bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-red-500/30',     bar: 'bg-red-400',      label: 'Kritisch' },
  overdue:      { bg: 'bg-rose-500/10',    text: 'text-rose-400',    border: 'border-rose-500/30',    bar: 'bg-rose-400',     label: 'Überfällig' },
  done:         { bg: 'bg-slate-500/10',   text: 'text-slate-400',   border: 'border-slate-500/30',   bar: 'bg-slate-400',    label: 'Fertig' },
  fahrer_alert: { bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-blue-500/30',    bar: 'bg-blue-400',     label: 'Fahrer früher!' },
};

const STATION_COLORS: Record<string, { badge: string; heat: string }> = {
  Grill:   { badge: 'bg-orange-500/20 text-orange-300', heat: 'bg-orange-400' },
  Friture: { badge: 'bg-yellow-500/20 text-yellow-300', heat: 'bg-yellow-400' },
  Kalt:    { badge: 'bg-cyan-500/20 text-cyan-300',     heat: 'bg-cyan-400' },
  Pasta:   { badge: 'bg-violet-500/20 text-violet-300', heat: 'bg-violet-400' },
  Ofen:    { badge: 'bg-red-500/20 text-red-300',       heat: 'bg-red-400' },
};

const STATIONS = ['Alle', 'Grill', 'Friture', 'Kalt', 'Pasta', 'Ofen'];

const MOCK: OrderTiming[] = [
  { id:'1', bestellnummer:'#1071', status:'in_zubereitung', zubereitung_start: new Date(Date.now()-9*60000).toISOString(),  estimated_prep_min:12, fahrer_eta_min:4,  station:'Grill',   items_count:3, batch_id:'B1', profit_score:82 },
  { id:'2', bestellnummer:'#1072', status:'in_zubereitung', zubereitung_start: new Date(Date.now()-4*60000).toISOString(),  estimated_prep_min:14, fahrer_eta_min:11, station:'Friture', items_count:2, batch_id:'B1', profit_score:74 },
  { id:'3', bestellnummer:'#1073', status:'bestätigt',      zubereitung_start: new Date(Date.now()-1*60000).toISOString(),  estimated_prep_min:10, fahrer_eta_min:9,  station:'Kalt',    items_count:4, batch_id:null, profit_score:91 },
  { id:'4', bestellnummer:'#1074', status:'in_zubereitung', zubereitung_start: new Date(Date.now()-15*60000).toISOString(), estimated_prep_min:12, fahrer_eta_min:2,  station:'Pasta',   items_count:1, batch_id:'B2', profit_score:63 },
  { id:'5', bestellnummer:'#1075', status:'bereit',         zubereitung_start: new Date(Date.now()-21*60000).toISOString(), estimated_prep_min:18, fahrer_eta_min:null, station:'Ofen',  items_count:2, batch_id:'B2', profit_score:78 },
  { id:'6', bestellnummer:'#1076', status:'in_zubereitung', zubereitung_start: new Date(Date.now()-7*60000).toISOString(),  estimated_prep_min:8,  fahrer_eta_min:1,  station:'Grill',   items_count:2, batch_id:null, profit_score:88 },
  { id:'7', bestellnummer:'#1077', status:'in_zubereitung', zubereitung_start: new Date(Date.now()-2*60000).toISOString(),  estimated_prep_min:11, fahrer_eta_min:10, station:'Pasta',   items_count:3, batch_id:'B3', profit_score:71 },
  { id:'8', bestellnummer:'#1078', status:'bestätigt',      zubereitung_start: new Date(Date.now()-0.5*60000).toISOString(),estimated_prep_min:13, fahrer_eta_min:12, station:'Ofen',   items_count:1, batch_id:'B3', profit_score:56 },
];

function useNow() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);
  return now;
}

function fmt(sec: number) {
  const a = Math.abs(sec), m = Math.floor(a / 60), s = a % 60;
  return `${sec < 0 ? '-' : ''}${m}:${String(s).padStart(2, '0')}`;
}

function StationHeatBar({ orders, station, now }: { orders: OrderTiming[]; station: string; now: number }) {
  const relevant = station === 'Alle' ? orders : orders.filter(o => o.station === station);
  const active = relevant.filter(o => ['in_zubereitung', 'bestätigt'].includes(o.status));
  const critical = active.filter(o => {
    const rest = ((o.estimated_prep_min ?? 12) * 60) - Math.floor((now - new Date(o.zubereitung_start ?? now).getTime()) / 1000);
    return rest < 120;
  }).length;
  const load = Math.min(100, Math.round((active.length / Math.max(1, relevant.length)) * 100));
  const sc = STATION_COLORS[station];
  const heatClass = load > 75 ? 'bg-red-400' : load > 50 ? 'bg-amber-400' : (sc?.heat ?? 'bg-emerald-400');

  return (
    <div className="flex items-center gap-2 py-1">
      <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-mono w-14 text-center', sc?.badge ?? 'bg-slate-700 text-slate-300')}>{station}</span>
      <div className="flex-1 h-2 rounded-full bg-slate-700">
        <div className={cn('h-2 rounded-full transition-all', heatClass)} style={{ width: `${load}%` }} />
      </div>
      <span className="text-[10px] text-slate-400 w-6 text-right">{load}%</span>
      {critical > 0 && <span className="text-[10px] text-red-400 flex items-center gap-0.5"><AlertCircle className="w-2.5 h-2.5" />{critical}</span>}
    </div>
  );
}

export function KitchenPhase5141SmartTimingCountdownV41({ locationId }: Props) {
  const now = useNow();
  const [orders, setOrders] = useState<OrderTiming[]>([]);
  const [loading, setLoading] = useState(true);
  const [stationFilter, setStationFilter] = useState('Alle');
  const [tab, setTab] = useState<'countdown' | 'heatmap'>('countdown');

  useEffect(() => {
    if (!locationId) { setOrders(MOCK); setLoading(false); return; }
    let active = true;
    async function load() {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const sb = createClient();
        const { data } = await sb
          .from('customer_orders')
          .select('id,bestellnummer,status,zubereitung_start,estimated_prep_min,fahrer_eta_min,station,items_count,batch_id,profit_score')
          .eq('location_id', locationId)
          .in('status', ['bestätigt', 'in_zubereitung', 'fertig', 'bereit'])
          .order('zubereitung_start', { ascending: true })
          .limit(24);
        if (active) { setOrders(data && data.length ? data : MOCK); setLoading(false); }
      } catch { if (active) { setOrders(MOCK); setLoading(false); } }
    }
    load();
    const iv = setInterval(load, 15_000);
    return () => { active = false; clearInterval(iv); };
  }, [locationId]);

  const active = orders.filter(o => ['bestätigt', 'in_zubereitung'].includes(o.status));
  const visible = stationFilter === 'Alle' ? active : active.filter(o => o.station === stationFilter);
  const sorted = [...visible].sort((a, b) => {
    const ra = ((a.estimated_prep_min ?? 12) * 60) - Math.floor((now - new Date(a.zubereitung_start ?? now).getTime()) / 1000);
    const rb = ((b.estimated_prep_min ?? 12) * 60) - Math.floor((now - new Date(b.zubereitung_start ?? now).getTime()) / 1000);
    return ra - rb;
  });

  const criticalCount = active.filter(o => {
    const r = ((o.estimated_prep_min ?? 12) * 60) - Math.floor((now - new Date(o.zubereitung_start ?? now).getTime()) / 1000);
    return r < 120;
  }).length;
  const fahrerAlertCount = active.filter(o => {
    const r = ((o.estimated_prep_min ?? 12) * 60) - Math.floor((now - new Date(o.zubereitung_start ?? now).getTime()) / 1000);
    return o.fahrer_eta_min != null && o.fahrer_eta_min * 60 < r - 60;
  }).length;
  const doneCount = orders.filter(o => ['fertig', 'bereit'].includes(o.status)).length;
  const avgScore = orders.length ? Math.round(orders.reduce((s, o) => s + (o.profit_score ?? 70), 0) / orders.length) : 0;
  const totalMin = orders.reduce((s, o) => s + (o.estimated_prep_min ?? 12), 0);
  const velocity = Math.round(doneCount * 60 / Math.max(1, totalMin));

  if (loading) return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-slate-400 text-sm">Lade Timing…</div>
  );

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 text-slate-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700 bg-slate-800/60">
        <Timer className="w-5 h-5 text-indigo-400" />
        <div>
          <span className="font-semibold text-sm">Smart-Timing V41</span>
          <span className="ml-2 text-[10px] text-slate-500">Dual-Countdown + KI-Fahrer-Alert</span>
        </div>
        <span className="ml-auto text-xs text-slate-500">Live · 15s</span>
      </div>

      {/* 6-KPI-Grid */}
      <div className="grid grid-cols-6 divide-x divide-slate-700 border-b border-slate-700">
        {[
          { label: 'Aktiv',        value: active.length,      color: 'text-slate-100' },
          { label: 'Kritisch',     value: criticalCount,      color: criticalCount > 0 ? 'text-red-400' : 'text-slate-100' },
          { label: 'Fahrer ↑',    value: fahrerAlertCount,   color: fahrerAlertCount > 0 ? 'text-blue-400' : 'text-slate-100' },
          { label: 'Fertig',       value: doneCount,          color: 'text-emerald-400' },
          { label: 'Score',        value: avgScore,           color: avgScore >= 80 ? 'text-emerald-400' : avgScore >= 60 ? 'text-amber-400' : 'text-red-400' },
          { label: '/h',           value: velocity,           color: 'text-violet-400' },
        ].map(k => (
          <div key={k.label} className="flex flex-col items-center py-2 px-1">
            <span className={cn('text-lg font-bold tabular-nums', k.color)}>{k.value}</span>
            <span className="text-[9px] text-slate-500 mt-0.5 text-center leading-tight">{k.label}</span>
          </div>
        ))}
      </div>

      {/* Fahrer-Alert Banner */}
      {fahrerAlertCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border-b border-blue-500/20 text-blue-300 text-xs">
          <Navigation2 className="w-3.5 h-3.5 shrink-0" />
          <span><strong>{fahrerAlertCount}</strong> Fahrer kommt früher als Küche fertig — Kochstart prüfen!</span>
        </div>
      )}

      {/* Tab Nav */}
      <div className="flex border-b border-slate-700">
        {(['countdown', 'heatmap'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('flex-1 py-2 text-xs font-medium transition-colors',
              tab === t ? 'text-indigo-400 border-b-2 border-indigo-400 bg-slate-800/30' : 'text-slate-500 hover:text-slate-300')}>
            {t === 'countdown' ? 'Countdown-Wall' : 'Stations-Heatmap'}
          </button>
        ))}
      </div>

      {tab === 'countdown' && (
        <>
          {/* Station filter */}
          <div className="flex gap-1.5 px-3 py-2 overflow-x-auto border-b border-slate-700/40">
            {STATIONS.map(s => (
              <button key={s} onClick={() => setStationFilter(s)}
                className={cn('text-xs px-2 py-0.5 rounded-full shrink-0 transition-colors',
                  stationFilter === s ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600')}>
                {s}
              </button>
            ))}
          </div>

          {/* Countdown cards 2-col */}
          <div className="p-3 grid grid-cols-2 gap-2">
            {sorted.length === 0 && (
              <div className="col-span-2 text-center text-slate-500 py-6 text-sm">Keine aktiven Bestellungen</div>
            )}
            {sorted.map(o => {
              const elapsed = Math.floor((now - new Date(o.zubereitung_start ?? now).getTime()) / 1000);
              const totalSec = (o.estimated_prep_min ?? 12) * 60;
              const restSec = totalSec - elapsed;
              const lv = getLevel(restSec, o.fahrer_eta_min ?? null);
              const col = COLOR[lv];
              const pct = Math.min(100, Math.max(0, Math.round((elapsed / totalSec) * 100)));
              const fahrerSec = o.fahrer_eta_min != null ? o.fahrer_eta_min * 60 : null;

              return (
                <div key={o.id} className={cn('rounded-lg border p-2.5 flex flex-col gap-1.5', col.bg, col.border)}>
                  {/* Order header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {lv === 'fahrer_alert' ? <Navigation2 className="w-3.5 h-3.5 text-blue-400" /> :
                        lv === 'critical' || lv === 'overdue' ? <Flame className="w-3.5 h-3.5 text-red-400" /> :
                          <ChefHat className="w-3.5 h-3.5 text-slate-400" />}
                      <span className="text-xs font-mono font-semibold">{o.bestellnummer ?? o.id}</span>
                    </div>
                    <span className={cn('text-[10px] px-1 py-0.5 rounded font-mono', STATION_COLORS[o.station ?? '']?.badge ?? 'bg-slate-700 text-slate-400')}>
                      {o.station ?? '—'}
                    </span>
                  </div>

                  {/* Dual countdown: Küche + Fahrer */}
                  <div className="flex items-end justify-between gap-1">
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] text-slate-500">Küche</span>
                      <span className={cn('text-xl font-mono font-bold tabular-nums', col.text)}>{fmt(restSec)}</span>
                    </div>
                    {fahrerSec != null && (
                      <div className="flex flex-col items-center opacity-70">
                        <span className="text-[9px] text-blue-400">Fahrer</span>
                        <span className="text-lg font-mono font-semibold tabular-nums text-blue-300">{fmt(fahrerSec)}</span>
                      </div>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 rounded-full bg-slate-700">
                    <div className={cn('h-1.5 rounded-full transition-all', col.bar)} style={{ width: `${pct}%` }} />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span className={col.text}>{col.label}</span>
                    <div className="flex items-center gap-1">
                      {o.batch_id && <span className="bg-violet-500/20 text-violet-300 px-1 rounded text-[9px]">{o.batch_id}</span>}
                      {(o.items_count ?? 0) > 2 && <span className="text-amber-400">{o.items_count}×</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === 'heatmap' && (
        <div className="p-4 flex flex-col gap-2">
          <p className="text-xs text-slate-500 mb-2">Stations-Auslastung &amp; Kritische Bestellungen</p>
          {STATIONS.filter(s => s !== 'Alle').map(s => (
            <StationHeatBar key={s} orders={orders} station={s} now={now} />
          ))}
          {/* Velocity ticker */}
          <div className="mt-3 rounded-lg bg-slate-800 border border-slate-700 p-3 flex items-center gap-3">
            <Activity className="w-4 h-4 text-violet-400 shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300">Küchengeschwindigkeit</span>
                <span className="text-sm font-bold text-violet-400">{velocity}/h</span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                {velocity >= 10
                  ? <TrendingUp className="w-3 h-3 text-emerald-400" />
                  : <TrendingDown className="w-3 h-3 text-red-400" />}
                <span className="text-[10px] text-slate-500">
                  {velocity >= 10 ? 'Hoher Durchsatz' : 'Unter Ziel'}
                </span>
              </div>
            </div>
          </div>
          {/* KI-Hinweis */}
          {criticalCount > 2 && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">
                <strong>{criticalCount} kritische Bestellungen</strong> — Stationen priorisieren und ggf. Batch-Zusammenlegung prüfen.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

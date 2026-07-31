'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Timer, Flame, Zap, ChefHat, CheckCircle2, AlertCircle,
  TrendingUp, TrendingDown, Gauge, BarChart2, Activity, Package,
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

type ColorLevel = 'ok' | 'warn' | 'critical' | 'overdue' | 'done';

function level(restSec: number): ColorLevel {
  if (restSec > 360) return 'ok';
  if (restSec > 120) return 'warn';
  if (restSec > 0) return 'critical';
  if (restSec === 0) return 'done';
  return 'overdue';
}

const COLOR: Record<ColorLevel, { bg: string; text: string; border: string; bar: string; label: string }> = {
  ok:      { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', bar: 'bg-emerald-400', label: 'Gut' },
  warn:    { bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-amber-500/30',   bar: 'bg-amber-400',   label: 'Bald' },
  critical:{ bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-red-500/30',     bar: 'bg-red-400',     label: 'Kritisch' },
  overdue: { bg: 'bg-rose-500/10',    text: 'text-rose-400',    border: 'border-rose-500/30',    bar: 'bg-rose-400',    label: 'Überfällig' },
  done:    { bg: 'bg-slate-500/10',   text: 'text-slate-400',   border: 'border-slate-500/30',   bar: 'bg-slate-400',   label: 'Fertig' },
};

const STATION_COLORS: Record<string, string> = {
  Grill:   'bg-orange-500/20 text-orange-300',
  Friture: 'bg-yellow-500/20 text-yellow-300',
  Kalt:    'bg-cyan-500/20 text-cyan-300',
  Pasta:   'bg-violet-500/20 text-violet-300',
  Ofen:    'bg-red-500/20 text-red-300',
};

const STATIONS = ['Alle', 'Grill', 'Friture', 'Kalt', 'Pasta', 'Ofen'];

const MOCK: OrderTiming[] = [
  { id:'1', bestellnummer:'#1055', status:'in_zubereitung', zubereitung_start: new Date(Date.now()-9*60000).toISOString(),  estimated_prep_min:12, fahrer_eta_min:4,  station:'Grill',   items_count:3, batch_id:'B1', profit_score:82 },
  { id:'2', bestellnummer:'#1056', status:'in_zubereitung', zubereitung_start: new Date(Date.now()-4*60000).toISOString(),  estimated_prep_min:14, fahrer_eta_min:11, station:'Friture', items_count:2, batch_id:'B1', profit_score:74 },
  { id:'3', bestellnummer:'#1057', status:'bestätigt',      zubereitung_start: new Date(Date.now()-1*60000).toISOString(),  estimated_prep_min:10, fahrer_eta_min:9,  station:'Kalt',    items_count:4, batch_id:null, profit_score:91 },
  { id:'4', bestellnummer:'#1058', status:'in_zubereitung', zubereitung_start: new Date(Date.now()-15*60000).toISOString(), estimated_prep_min:12, fahrer_eta_min:2,  station:'Pasta',   items_count:1, batch_id:'B2', profit_score:63 },
  { id:'5', bestellnummer:'#1059', status:'bereit',         zubereitung_start: new Date(Date.now()-21*60000).toISOString(), estimated_prep_min:18, fahrer_eta_min:null,station:'Ofen',   items_count:2, batch_id:'B2', profit_score:78 },
  { id:'6', bestellnummer:'#1060', status:'in_zubereitung', zubereitung_start: new Date(Date.now()-7*60000).toISOString(),  estimated_prep_min:8,  fahrer_eta_min:3,  station:'Grill',   items_count:2, batch_id:null, profit_score:88 },
  { id:'7', bestellnummer:'#1061', status:'in_zubereitung', zubereitung_start: new Date(Date.now()-2*60000).toISOString(),  estimated_prep_min:11, fahrer_eta_min:10, station:'Pasta',   items_count:3, batch_id:'B3', profit_score:71 },
  { id:'8', bestellnummer:'#1062', status:'bestätigt',      zubereitung_start: new Date(Date.now()-0.5*60000).toISOString(),estimated_prep_min:13, fahrer_eta_min:12, station:'Ofen',    items_count:1, batch_id:'B3', profit_score:56 },
];

function useNow() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv); }, []);
  return now;
}

function fmt(sec: number) {
  const a = Math.abs(sec), m = Math.floor(a / 60), s = a % 60;
  return `${sec < 0 ? '-' : ''}${m}:${String(s).padStart(2,'0')}`;
}

function StationSyncBar({ orders, station }: { orders: OrderTiming[]; station: string }) {
  const relevant = station === 'Alle' ? orders : orders.filter(o => o.station === station);
  const load = Math.min(100, Math.round((relevant.filter(o => o.status === 'in_zubereitung').length / Math.max(1, relevant.length)) * 100));
  const heatClass = load > 75 ? 'bg-red-400' : load > 50 ? 'bg-amber-400' : 'bg-emerald-400';
  return (
    <div className="flex items-center gap-2">
      <span className={cn('text-xs px-1.5 py-0.5 rounded font-mono', STATION_COLORS[station] ?? 'bg-slate-700 text-slate-300')}>{station}</span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-700">
        <div className={cn('h-1.5 rounded-full transition-all', heatClass)} style={{ width: `${load}%` }} />
      </div>
      <span className="text-xs text-slate-400 w-8 text-right">{load}%</span>
    </div>
  );
}

export function KitchenPhase5140SmartTimingCountdownV40({ locationId }: Props) {
  const now = useNow();
  const [orders, setOrders] = useState<OrderTiming[]>([]);
  const [loading, setLoading] = useState(true);
  const [stationFilter, setStationFilter] = useState('Alle');
  const [tab, setTab] = useState<'orders' | 'sync'>('orders');

  useEffect(() => {
    if (!locationId) { setOrders(MOCK); setLoading(false); return; }
    let active = true;
    async function load() {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const sb = createClient();
        const { data } = await sb
          .from('customer_orders')
          .select('id,bestellnummer,status,zubereitung_start,estimated_prep_min,fahrer_eta_min,station,items_count,batch_id')
          .eq('location_id', locationId)
          .in('status', ['bestätigt','in_zubereitung','fertig','bereit'])
          .order('zubereitung_start', { ascending: true })
          .limit(20);
        if (active) { setOrders(data && data.length ? data : MOCK); setLoading(false); }
      } catch { if (active) { setOrders(MOCK); setLoading(false); } }
    }
    load();
    const iv = setInterval(load, 15_000);
    return () => { active = false; clearInterval(iv); };
  }, [locationId]);

  const active = orders.filter(o => ['bestätigt','in_zubereitung'].includes(o.status));
  const visible = stationFilter === 'Alle' ? active : active.filter(o => o.station === stationFilter);
  const sorted = [...visible].sort((a, b) => {
    const restA = ((a.estimated_prep_min ?? 12) * 60) - Math.floor((now - new Date(a.zubereitung_start ?? now).getTime()) / 1000);
    const restB = ((b.estimated_prep_min ?? 12) * 60) - Math.floor((now - new Date(b.zubereitung_start ?? now).getTime()) / 1000);
    return restA - restB;
  });

  const criticalCount = active.filter(o => {
    const rest = ((o.estimated_prep_min ?? 12) * 60) - Math.floor((now - new Date(o.zubereitung_start ?? now).getTime()) / 1000);
    return rest < 120;
  }).length;
  const doneCount = orders.filter(o => o.status === 'fertig' || o.status === 'bereit').length;
  const avgScore = orders.length ? Math.round(orders.reduce((s, o) => s + (o.profit_score ?? 70), 0) / orders.length) : 0;
  const velocity = Math.round(doneCount / Math.max(1, (now - new Date(orders[0]?.zubereitung_start ?? now).getTime()) / 3_600_000));

  if (loading) return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-slate-400 text-sm">Lade Timing…</div>
  );

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 text-slate-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700 bg-slate-800/50">
        <Timer className="w-5 h-5 text-indigo-400" />
        <span className="font-semibold text-sm">Smart-Timing V40</span>
        <span className="ml-auto text-xs text-slate-400">Live · 15s</span>
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-5 divide-x divide-slate-700 border-b border-slate-700">
        {[
          { label: 'Aktiv',     value: active.length,   color: 'text-slate-100' },
          { label: 'Kritisch',  value: criticalCount,   color: criticalCount > 0 ? 'text-red-400' : 'text-slate-100' },
          { label: 'Fertig',    value: doneCount,       color: 'text-emerald-400' },
          { label: 'Score',     value: avgScore,        color: avgScore >= 80 ? 'text-emerald-400' : avgScore >= 60 ? 'text-amber-400' : 'text-red-400' },
          { label: '/h',        value: velocity,        color: 'text-violet-400' },
        ].map(k => (
          <div key={k.label} className="flex flex-col items-center py-2 px-1">
            <span className={cn('text-xl font-bold tabular-nums', k.color)}>{k.value}</span>
            <span className="text-[10px] text-slate-500 mt-0.5">{k.label}</span>
          </div>
        ))}
      </div>

      {/* Tab Nav */}
      <div className="flex border-b border-slate-700">
        {(['orders', 'sync'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('flex-1 py-2 text-xs font-medium transition-colors',
              tab === t ? 'text-indigo-400 border-b-2 border-indigo-400 bg-slate-800/30' : 'text-slate-500 hover:text-slate-300')}>
            {t === 'orders' ? 'Bestellungen' : 'Stations-Sync'}
          </button>
        ))}
      </div>

      {tab === 'orders' && (
        <>
          {/* Station filter */}
          <div className="flex gap-1.5 px-3 py-2 overflow-x-auto border-b border-slate-700/50">
            {STATIONS.map(s => (
              <button key={s} onClick={() => setStationFilter(s)}
                className={cn('text-xs px-2 py-0.5 rounded-full shrink-0 transition-colors',
                  stationFilter === s ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600')}>
                {s}
              </button>
            ))}
          </div>

          {/* Order countdown wall */}
          <div className="p-3 grid grid-cols-2 gap-2">
            {sorted.length === 0 && (
              <div className="col-span-2 text-center text-slate-500 py-6 text-sm">Keine aktiven Bestellungen</div>
            )}
            {sorted.map(o => {
              const elapsed = Math.floor((now - new Date(o.zubereitung_start ?? now).getTime()) / 1000);
              const totalSec = (o.estimated_prep_min ?? 12) * 60;
              const restSec = totalSec - elapsed;
              const lv = level(restSec);
              const col = COLOR[lv];
              const pct = Math.min(100, Math.max(0, Math.round((elapsed / totalSec) * 100)));

              return (
                <div key={o.id} className={cn('rounded-lg border p-2.5 flex flex-col gap-1.5', col.bg, col.border)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {lv === 'critical' || lv === 'overdue' ? <Flame className="w-3.5 h-3.5 text-red-400" /> : <ChefHat className="w-3.5 h-3.5 text-slate-400" />}
                      <span className="text-xs font-mono font-semibold">{o.bestellnummer ?? o.id}</span>
                    </div>
                    <span className={cn('text-xs px-1 py-0.5 rounded font-mono', STATION_COLORS[o.station ?? ''] ?? 'bg-slate-700 text-slate-400')}>{o.station ?? '—'}</span>
                  </div>

                  <div className={cn('text-2xl font-mono font-bold tabular-nums text-center', col.text)}>
                    {fmt(restSec)}
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 rounded-full bg-slate-700">
                    <div className={cn('h-1.5 rounded-full transition-all', col.bar)} style={{ width: `${pct}%` }} />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>{col.label}</span>
                    <div className="flex items-center gap-1">
                      {o.fahrer_eta_min != null && (
                        <span className="flex items-center gap-0.5 text-blue-400">
                          <Zap className="w-2.5 h-2.5" />{o.fahrer_eta_min}m
                        </span>
                      )}
                      {o.batch_id && <span className="bg-violet-500/20 text-violet-300 px-1 rounded text-[9px]">{o.batch_id}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === 'sync' && (
        <div className="p-4 flex flex-col gap-3">
          <p className="text-xs text-slate-500 mb-1">Auslastung je Station (aktive Bestellungen)</p>
          {STATIONS.filter(s => s !== 'Alle').map(s => (
            <StationSyncBar key={s} orders={active} station={s} />
          ))}
          <div className="mt-2 rounded-lg bg-slate-800 border border-slate-700 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-violet-400" />
              <span className="text-xs font-medium text-slate-300">Batch-Koordination</span>
            </div>
            {['B1','B2','B3'].map(bid => {
              const batch = active.filter(o => o.batch_id === bid);
              if (!batch.length) return null;
              const allCrit = batch.every(o => {
                const r = ((o.estimated_prep_min ?? 12)*60) - Math.floor((now - new Date(o.zubereitung_start ?? now).getTime())/1000);
                return r < 120;
              });
              return (
                <div key={bid} className="flex items-center gap-2 py-1">
                  <span className="text-xs font-mono text-violet-300 w-8">{bid}</span>
                  <span className="text-xs text-slate-400">{batch.length} Pos.</span>
                  {allCrit && <span className="text-xs text-red-400 flex items-center gap-0.5"><AlertCircle className="w-3 h-3" />Kritisch</span>}
                  {!allCrit && <span className="text-xs text-emerald-400 flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" />OK</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

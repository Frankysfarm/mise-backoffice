'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Timer, Flame, Zap, ChefHat, CheckCircle2, AlertCircle, TrendingUp, TrendingDown, Gauge, BarChart2 } from 'lucide-react';

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
}

interface Props {
  locationId: string | null;
}

type ColorLevel = 'ok' | 'warn' | 'critical' | 'done' | 'overdue';

function getColorLevel(restSec: number): ColorLevel {
  if (restSec > 300) return 'ok';
  if (restSec > 120) return 'warn';
  if (restSec > 0) return 'critical';
  if (restSec === 0) return 'done';
  return 'overdue';
}

const COLOR: Record<ColorLevel, { bg: string; text: string; border: string; bar: string; label: string }> = {
  ok:       { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', bar: 'bg-emerald-400', label: 'Gut' },
  warn:     { bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-amber-500/30',   bar: 'bg-amber-400',   label: 'Bald' },
  critical: { bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-red-500/30',     bar: 'bg-red-400',     label: 'Kritisch' },
  done:     { bg: 'bg-slate-500/10',   text: 'text-slate-400',   border: 'border-slate-500/30',   bar: 'bg-slate-400',   label: 'Fertig' },
  overdue:  { bg: 'bg-rose-500/10',    text: 'text-rose-400',    border: 'border-rose-500/30',    bar: 'bg-rose-400',    label: 'Überfällig' },
};

const STATIONS = ['Alle', 'Grill', 'Friture', 'Kalt', 'Pasta', 'Ofen'];

const MOCK_ORDERS: OrderTiming[] = [
  { id: '1', bestellnummer: '#1042', status: 'in_zubereitung', zubereitung_start: new Date(Date.now() - 8 * 60_000).toISOString(),  estimated_prep_min: 12, fahrer_eta_min: 5,  station: 'Grill',   items_count: 3, batch_id: 'B1' },
  { id: '2', bestellnummer: '#1043', status: 'in_zubereitung', zubereitung_start: new Date(Date.now() - 3 * 60_000).toISOString(),  estimated_prep_min: 15, fahrer_eta_min: 12, station: 'Friture', items_count: 2, batch_id: 'B1' },
  { id: '3', bestellnummer: '#1044', status: 'bestätigt',      zubereitung_start: new Date(Date.now() - 1 * 60_000).toISOString(),  estimated_prep_min: 10, fahrer_eta_min: 8,  station: 'Kalt',    items_count: 4, batch_id: null },
  { id: '4', bestellnummer: '#1045', status: 'in_zubereitung', zubereitung_start: new Date(Date.now() - 14 * 60_000).toISOString(), estimated_prep_min: 12, fahrer_eta_min: 2,  station: 'Pasta',   items_count: 1, batch_id: 'B2' },
  { id: '5', bestellnummer: '#1046', status: 'bereit',          zubereitung_start: new Date(Date.now() - 20 * 60_000).toISOString(), estimated_prep_min: 18, fahrer_eta_min: null, station: 'Ofen', items_count: 2, batch_id: 'B2' },
  { id: '6', bestellnummer: '#1047', status: 'in_zubereitung', zubereitung_start: new Date(Date.now() - 6 * 60_000).toISOString(),  estimated_prep_min: 8,  fahrer_eta_min: 3,  station: 'Grill',   items_count: 2, batch_id: null },
  { id: '7', bestellnummer: '#1048', status: 'in_zubereitung', zubereitung_start: new Date(Date.now() - 2 * 60_000).toISOString(),  estimated_prep_min: 10, fahrer_eta_min: 9,  station: 'Pasta',   items_count: 3, batch_id: 'B3' },
  { id: '8', bestellnummer: '#1049', status: 'bestätigt',      zubereitung_start: new Date(Date.now() - 0.5 * 60_000).toISOString(), estimated_prep_min: 14, fahrer_eta_min: 13, station: 'Ofen',  items_count: 1, batch_id: 'B3' },
];

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(iv);
  }, []);
  return now;
}

function fmtSec(sec: number) {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sec < 0 ? '-' : ''}${m}:${String(s).padStart(2, '0')}`;
}

export function KitchenPhase5137SmartTimingCountdownV39({ locationId }: Props) {
  const now = useNow();
  const [orders, setOrders] = useState<OrderTiming[]>([]);
  const [loading, setLoading] = useState(true);
  const [stationFilter, setStationFilter] = useState<string>('Alle');
  const [prevScore, setPrevScore] = useState<number | null>(null);
  const [velocityHistory, setVelocityHistory] = useState<number[]>([]);

  useEffect(() => {
    if (!locationId) { setOrders(MOCK_ORDERS); setLoading(false); return; }
    async function load() {
      try {
        const res = await fetch(`/api/delivery/kitchen/queue?location_id=${locationId}`);
        if (res.ok) {
          const data = await res.json();
          setOrders(data.orders ?? data ?? MOCK_ORDERS);
        } else { setOrders(MOCK_ORDERS); }
      } catch { setOrders(MOCK_ORDERS); }
      finally { setLoading(false); }
    }
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const active = orders.filter(o => ['in_zubereitung', 'bestätigt', 'neu'].includes(o.status));
  const filtered = stationFilter === 'Alle' ? active : active.filter(o => o.station === stationFilter);

  const enriched = filtered.map(o => {
    const elapsed = o.zubereitung_start ? (now - new Date(o.zubereitung_start).getTime()) / 1000 : 0;
    const prepSec = (o.estimated_prep_min ?? 12) * 60;
    const restSec = Math.round(prepSec - elapsed);
    const pct = Math.min(100, Math.max(0, Math.round((elapsed / prepSec) * 100)));
    const level = getColorLevel(restSec);
    const driverEtaSec = o.fahrer_eta_min != null ? o.fahrer_eta_min * 60 : null;
    const syncWarning = driverEtaSec !== null && restSec > driverEtaSec + 60;
    return { ...o, restSec, pct, level, syncWarning };
  });

  const sorted = [...enriched].sort((a, b) => a.restSec - b.restSec);
  const criticalCount = enriched.filter(o => ['critical', 'overdue'].includes(o.level)).length;
  const doneCount = orders.filter(o => o.status === 'bereit').length;
  const gesamt = orders.length;
  const score = active.length ? Math.round(((active.length - criticalCount) / active.length) * 100) : 100;

  // Velocity: orders/h based on active count and avg prep time
  const avgPrepMin = active.length
    ? active.reduce((s, o) => s + (o.estimated_prep_min ?? 12), 0) / active.length
    : 12;
  const velocity = avgPrepMin > 0 ? Math.round(60 / avgPrepMin * active.length) : 0;

  useEffect(() => {
    setVelocityHistory(prev => [...prev.slice(-11), velocity]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scoreTrend = prevScore !== null && score !== prevScore
    ? (score > prevScore ? 'up' : 'down')
    : null;

  useEffect(() => {
    setPrevScore(score);
  }, [score]);

  // Batch groups
  const batches = Object.entries(
    enriched.reduce<Record<string, typeof enriched>>((acc, o) => {
      const k = o.batch_id ?? '__single__';
      (acc[k] = acc[k] ?? []).push(o);
      return acc;
    }, {})
  );

  if (loading) return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex items-center gap-2 text-slate-400 text-sm">
      <Timer className="w-4 h-4 animate-spin" /> Lade Küchen-Timing...
    </div>
  );

  return (
    <div className="rounded-xl border border-indigo-500/20 bg-slate-900/80 backdrop-blur p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="w-5 h-5 text-indigo-400" />
          <span className="font-semibold text-white text-sm">Smart-Timing V39</span>
        </div>
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-indigo-300" />
          <span className="text-indigo-200 text-xs font-mono">{velocity}/h</span>
          {scoreTrend === 'up' && <TrendingUp className="w-4 h-4 text-emerald-400" />}
          {scoreTrend === 'down' && <TrendingDown className="w-4 h-4 text-red-400" />}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: 'Score',    value: `${score}%`, color: score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-red-400' },
          { label: 'Aktiv',    value: active.length,  color: 'text-blue-400' },
          { label: 'Kritisch', value: criticalCount,  color: criticalCount > 0 ? 'text-red-400' : 'text-slate-400' },
          { label: 'Fertig',   value: doneCount,      color: 'text-emerald-400' },
          { label: 'Gesamt',   value: gesamt,         color: 'text-slate-300' },
        ].map(k => (
          <div key={k.label} className="bg-slate-800/60 rounded-lg p-2 text-center">
            <div className={cn('text-lg font-bold tabular-nums', k.color)}>{k.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Station Filters */}
      <div className="flex gap-1 flex-wrap">
        {STATIONS.map(s => (
          <button
            key={s}
            onClick={() => setStationFilter(s)}
            className={cn(
              'px-2 py-0.5 rounded-full text-xs font-medium transition-colors',
              stationFilter === s
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            )}
          >{s}</button>
        ))}
      </div>

      {/* Velocity Trend Bar */}
      {velocityHistory.length > 2 && (
        <div className="flex items-end gap-0.5 h-8">
          {velocityHistory.map((v, i) => (
            <div
              key={i}
              className={cn('flex-1 rounded-sm', i === velocityHistory.length - 1 ? 'bg-indigo-400' : 'bg-indigo-800/60')}
              style={{ height: `${Math.max(4, Math.min(100, (v / Math.max(...velocityHistory, 1)) * 100))}%` }}
            />
          ))}
          <span className="text-xs text-slate-500 ml-1 self-end">Velocity</span>
        </div>
      )}

      {/* Countdown Wall */}
      <div className="grid grid-cols-2 gap-2">
        {sorted.map(o => {
          const c = COLOR[o.level];
          return (
            <div key={o.id} className={cn('rounded-lg border p-2.5 space-y-1.5', c.bg, c.border)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {o.level === 'critical' || o.level === 'overdue' ? <Flame className={cn('w-3.5 h-3.5', c.text)} /> : <ChefHat className={cn('w-3.5 h-3.5', c.text)} />}
                  <span className="text-xs font-semibold text-white">{o.bestellnummer ?? `#${o.id}`}</span>
                  {o.batch_id && (
                    <span className="text-[10px] bg-slate-700 text-slate-300 rounded px-1">{o.batch_id}</span>
                  )}
                </div>
                <span className={cn('text-sm font-bold tabular-nums', c.text)}>{fmtSec(o.restSec)}</span>
              </div>
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full transition-all', c.bar)} style={{ width: `${o.pct}%` }} />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>{o.station ?? '—'}</span>
                <div className="flex items-center gap-1">
                  {o.fahrer_eta_min != null && (
                    <span className={cn('flex items-center gap-0.5', o.syncWarning ? 'text-amber-400' : '')}>
                      <Zap className="w-2.5 h-2.5" />{o.fahrer_eta_min}m
                    </span>
                  )}
                  <span className={cn('rounded px-1', c.bg, c.text)}>{c.label}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Batch Sync Summary */}
      {batches.filter(([k]) => k !== '__single__').length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <BarChart2 className="w-3.5 h-3.5" /> Batch-Gruppen
          </div>
          {batches.filter(([k]) => k !== '__single__').map(([batchId, bOrders]) => {
            const minRest = Math.min(...bOrders.map(o => o.restSec));
            const bLevel = getColorLevel(minRest);
            const bc = COLOR[bLevel];
            return (
              <div key={batchId} className={cn('flex items-center justify-between rounded px-2 py-1 text-xs', bc.bg, bc.border, 'border')}>
                <span className="text-white font-medium">{batchId}</span>
                <span className="text-slate-400">{bOrders.length} Bestellungen</span>
                <span className={cn('font-mono', bc.text)}>{fmtSec(minRest)}</span>
              </div>
            );
          })}
        </div>
      )}

      {criticalCount > 0 && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-400">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{criticalCount} Bestellung{criticalCount > 1 ? 'en' : ''} kritisch — sofort abfertigen!</span>
        </div>
      )}

      <div className="text-[10px] text-slate-600 text-right">1-Sek-Tick · 15-Sek-Polling</div>
    </div>
  );
}

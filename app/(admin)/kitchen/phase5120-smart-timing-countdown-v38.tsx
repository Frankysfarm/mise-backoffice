'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, Timer, Flame, Zap, CheckCircle2, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';

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

function getColorLevel(restSec: number, isDone: boolean): ColorLevel {
  if (isDone) return 'done';
  if (restSec < 0) return 'overdue';
  if (restSec <= 90) return 'critical';
  if (restSec <= 240) return 'warn';
  return 'ok';
}

const COLOR: Record<ColorLevel, { ring: string; bg: string; text: string; bar: string; label: string }> = {
  ok:       { ring: 'ring-emerald-500/40', bg: 'bg-emerald-950/40', text: 'text-emerald-300', bar: 'bg-emerald-500', label: 'Pünktlich' },
  warn:     { ring: 'ring-amber-500/40',   bg: 'bg-amber-950/40',   text: 'text-amber-300',   bar: 'bg-amber-400',   label: 'Bald fällig' },
  critical: { ring: 'ring-red-500/60',     bg: 'bg-red-950/50',     text: 'text-red-300',     bar: 'bg-red-500',     label: 'Kritisch' },
  done:     { ring: 'ring-slate-600/30',   bg: 'bg-slate-800/30',   text: 'text-slate-400',   bar: 'bg-slate-600',   label: 'Fertig' },
  overdue:  { ring: 'ring-rose-500/60',    bg: 'bg-rose-950/50',    text: 'text-rose-300',    bar: 'bg-rose-600',    label: 'Überfällig' },
};

const MOCK: OrderTiming[] = [
  { id: '1', bestellnummer: '#2042', status: 'in_zubereitung', zubereitung_start: new Date(Date.now() - 9 * 60_000).toISOString(), estimated_prep_min: 12, fahrer_eta_min: 4, station: 'Grill', items_count: 3, batch_id: 'B-01' },
  { id: '2', bestellnummer: '#2043', status: 'in_zubereitung', zubereitung_start: new Date(Date.now() - 2 * 60_000).toISOString(), estimated_prep_min: 15, fahrer_eta_min: 13, station: 'Friture', items_count: 2, batch_id: 'B-01' },
  { id: '3', bestellnummer: '#2044', status: 'bestätigt', zubereitung_start: new Date(Date.now() - 1 * 60_000).toISOString(), estimated_prep_min: 8, fahrer_eta_min: 7, station: 'Kalt', items_count: 1, batch_id: 'B-02' },
  { id: '4', bestellnummer: '#2045', status: 'in_zubereitung', zubereitung_start: new Date(Date.now() - 13 * 60_000).toISOString(), estimated_prep_min: 12, fahrer_eta_min: 2, station: 'Pasta', items_count: 4, batch_id: 'B-02' },
  { id: '5', bestellnummer: '#2046', status: 'bereit', zubereitung_start: new Date(Date.now() - 18 * 60_000).toISOString(), estimated_prep_min: 15, fahrer_eta_min: null, station: 'Ofen', items_count: 2, batch_id: 'B-03' },
  { id: '6', bestellnummer: '#2047', status: 'in_zubereitung', zubereitung_start: new Date(Date.now() - 5 * 60_000).toISOString(), estimated_prep_min: 10, fahrer_eta_min: 6, station: 'Grill', items_count: 3, batch_id: 'B-03' },
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

function PrioIcon({ level }: { level: ColorLevel }) {
  if (level === 'critical' || level === 'overdue') return <Flame className="w-3.5 h-3.5 text-red-400 animate-pulse" />;
  if (level === 'warn') return <Zap className="w-3.5 h-3.5 text-amber-400" />;
  if (level === 'done') return <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />;
  return <ChefHat className="w-3.5 h-3.5 text-emerald-400" />;
}

export function KitchenPhase5120SmartTimingCountdownV38({ locationId }: Props) {
  const now = useNow();
  const [orders, setOrders] = useState<OrderTiming[]>([]);
  const [loading, setLoading] = useState(true);
  const [schichtScore, setSchichtScore] = useState(87);
  const [trend, setTrend] = useState<'up' | 'down'>('up');

  useEffect(() => {
    if (!locationId) { setOrders(MOCK); setLoading(false); return; }
    async function load() {
      try {
        const res = await fetch(`/api/delivery/kitchen/queue?location_id=${locationId}`);
        if (res.ok) {
          const data = await res.json();
          const rows = data.orders ?? data ?? [];
          setOrders(rows.length ? rows : MOCK);
        } else {
          setOrders(MOCK);
        }
      } catch { setOrders(MOCK); }
      finally { setLoading(false); }
    }
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const enriched = orders.map((o) => {
    const isDone = o.status === 'bereit' || o.status === 'abgeholt';
    const startMs = o.zubereitung_start ? new Date(o.zubereitung_start).getTime() : null;
    const totalSec = (o.estimated_prep_min ?? 12) * 60;
    const elapsedSec = startMs ? Math.floor((now - startMs) / 1_000) : 0;
    const restSec = totalSec - elapsedSec;
    const progress = Math.min(1, Math.max(0, elapsedSec / totalSec));
    const level = getColorLevel(restSec, isDone);
    return { ...o, restSec, progress, level, isDone };
  }).sort((a, b) => {
    const prio: Record<ColorLevel, number> = { overdue: 0, critical: 1, warn: 2, ok: 3, done: 4 };
    return prio[a.level] - prio[b.level];
  });

  const kpiAktiv = enriched.filter(o => !o.isDone).length;
  const kpiKritisch = enriched.filter(o => o.level === 'critical' || o.level === 'overdue').length;
  const kpiFertig = enriched.filter(o => o.isDone).length;
  const kpiGesamt = enriched.length;

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700/60 overflow-hidden text-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-indigo-400" />
          <span className="font-semibold text-white text-sm">Smart-Timing V38</span>
          {loading && <span className="w-3 h-3 border-2 border-slate-600 border-t-indigo-400 rounded-full animate-spin" />}
        </div>
        <div className="flex items-center gap-1.5">
          {trend === 'up' ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> : <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
          <span className={cn('text-xs font-bold', trend === 'up' ? 'text-emerald-400' : 'text-red-400')}>{schichtScore}</span>
          <span className="text-xs text-slate-500">Score</span>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-4 divide-x divide-slate-700/50 border-b border-slate-700/50">
        {[
          { label: 'Aktiv', val: kpiAktiv, color: 'text-white' },
          { label: 'Kritisch', val: kpiKritisch, color: kpiKritisch > 0 ? 'text-red-400' : 'text-slate-400' },
          { label: 'Fertig', val: kpiFertig, color: 'text-emerald-400' },
          { label: 'Gesamt', val: kpiGesamt, color: 'text-slate-300' },
        ].map(({ label, val, color }) => (
          <div key={label} className="flex flex-col items-center py-2">
            <span className={cn('text-lg font-bold leading-none', color)}>{val}</span>
            <span className="text-[10px] text-slate-500 mt-0.5">{label}</span>
          </div>
        ))}
      </div>

      {/* Countdown Wall */}
      <div className="p-3 grid grid-cols-2 gap-2 max-h-80 overflow-y-auto">
        {enriched.map((o) => {
          const c = COLOR[o.level];
          return (
            <div key={o.id} className={cn('rounded-lg ring-1 p-2.5 space-y-1.5', c.ring, c.bg)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <PrioIcon level={o.level} />
                  <span className="font-mono text-xs text-slate-300">{o.bestellnummer ?? o.id}</span>
                </div>
                <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', c.bar === 'bg-slate-600' ? 'bg-slate-700 text-slate-400' : `${c.bar.replace('bg-', 'bg-').replace('500', '900')} ${c.text}`)}>{c.label}</span>
              </div>
              <div className="flex items-end justify-between">
                <span className={cn('text-xl font-mono font-bold leading-none', c.text)}>
                  {o.isDone ? '✓' : fmtSec(o.restSec)}
                </span>
                <div className="text-right">
                  {o.station && <div className="text-[10px] text-slate-500">{o.station}</div>}
                  {o.fahrer_eta_min != null && !o.isDone && (
                    <div className="flex items-center gap-0.5 justify-end">
                      <Zap className="w-2.5 h-2.5 text-amber-400" />
                      <span className="text-[10px] text-amber-400">{o.fahrer_eta_min}min</span>
                    </div>
                  )}
                </div>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-slate-700/60 rounded-full h-1">
                <div className={cn('h-1 rounded-full transition-all duration-1000', c.bar)} style={{ width: `${o.progress * 100}%` }} />
              </div>
            </div>
          );
        })}
        {enriched.length === 0 && (
          <div className="col-span-2 flex items-center justify-center gap-2 py-6 text-slate-500">
            <AlertCircle className="w-4 h-4" />
            <span className="text-xs">Keine aktiven Bestellungen</span>
          </div>
        )}
      </div>

      <div className="px-4 py-1.5 border-t border-slate-700/40 text-center text-[10px] text-slate-600">
        1-Sek-Tick · 15-Sek-Polling · Mock-Fallback
      </div>
    </div>
  );
}

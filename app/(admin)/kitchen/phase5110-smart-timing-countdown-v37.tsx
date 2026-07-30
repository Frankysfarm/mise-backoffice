'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, Clock, Flame, Zap, CheckCircle2, AlertCircle, Timer, TrendingUp } from 'lucide-react';

interface OrderTiming {
  id: string;
  bestellnummer?: string | null;
  status: string;
  zubereitung_start?: string | null;
  estimated_prep_min?: number | null;
  fahrer_eta_min?: number | null;
  station?: string | null;
  items_count?: number | null;
}

interface Props {
  locationId: string | null;
}

type ColorLevel = 'ok' | 'warn' | 'critical' | 'done' | 'overdue';

function getColorLevel(restSec: number, driverEtaSec: number | null): ColorLevel {
  if (restSec <= 0 && (driverEtaSec === null || driverEtaSec > 0)) return 'overdue';
  if (restSec <= 0) return 'done';
  if (restSec <= 120) return 'critical';
  if (restSec <= 300) return 'warn';
  return 'ok';
}

const COLOR: Record<ColorLevel, { bg: string; text: string; border: string; badge: string; label: string }> = {
  ok:      { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', badge: 'bg-emerald-500/20 text-emerald-300', label: 'Gut' },
  warn:    { bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-amber-500/30',   badge: 'bg-amber-500/20 text-amber-300',   label: 'Bald' },
  critical:{ bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-red-500/30',     badge: 'bg-red-500/20 text-red-300',     label: 'Kritisch' },
  done:    { bg: 'bg-slate-500/10',   text: 'text-slate-400',   border: 'border-slate-500/30',   badge: 'bg-slate-500/20 text-slate-300',   label: 'Fertig' },
  overdue: { bg: 'bg-rose-500/10',    text: 'text-rose-400',    border: 'border-rose-500/30',    badge: 'bg-rose-500/20 text-rose-300',    label: 'Überfällig' },
};

const STATIONS = ['Grill', 'Friture', 'Kalt', 'Pasta', 'Ofen'];

const MOCK_ORDERS: OrderTiming[] = [
  { id: '1', bestellnummer: '#1042', status: 'in_zubereitung', zubereitung_start: new Date(Date.now() - 8 * 60_000).toISOString(), estimated_prep_min: 12, fahrer_eta_min: 5, station: 'Grill', items_count: 3 },
  { id: '2', bestellnummer: '#1043', status: 'in_zubereitung', zubereitung_start: new Date(Date.now() - 3 * 60_000).toISOString(), estimated_prep_min: 15, fahrer_eta_min: 12, station: 'Friture', items_count: 2 },
  { id: '3', bestellnummer: '#1044', status: 'bestätigt',      zubereitung_start: new Date(Date.now() - 1 * 60_000).toISOString(), estimated_prep_min: 10, fahrer_eta_min: 8, station: 'Kalt', items_count: 4 },
  { id: '4', bestellnummer: '#1045', status: 'in_zubereitung', zubereitung_start: new Date(Date.now() - 14 * 60_000).toISOString(), estimated_prep_min: 12, fahrer_eta_min: 2, station: 'Pasta', items_count: 1 },
  { id: '5', bestellnummer: '#1046', status: 'bereit',          zubereitung_start: new Date(Date.now() - 20 * 60_000).toISOString(), estimated_prep_min: 18, fahrer_eta_min: null, station: 'Ofen', items_count: 2 },
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
  if (sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function KitchenPhase5110SmartTimingCountdownV37({ locationId }: Props) {
  const now = useNow();
  const [orders, setOrders] = useState<OrderTiming[]>([]);
  const [loading, setLoading] = useState(true);
  const [stationFilter, setStationFilter] = useState<string | null>(null);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }
    async function load() {
      try {
        const res = await fetch(`/api/delivery/kitchen/queue?location_id=${locationId}`);
        if (res.ok) {
          const data = await res.json();
          setOrders(data.orders ?? data ?? []);
        } else { setOrders(MOCK_ORDERS); }
      } catch { setOrders(MOCK_ORDERS); }
      finally { setLoading(false); }
    }
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!locationId) {
    setOrders(MOCK_ORDERS);
  }

  const active = orders.filter(o => ['in_zubereitung', 'bestätigt', 'neu'].includes(o.status));
  const filtered = stationFilter ? active.filter(o => o.station === stationFilter) : active;
  const critical = filtered.filter(o => {
    if (!o.zubereitung_start) return false;
    const elapsed = (now - new Date(o.zubereitung_start).getTime()) / 1000;
    const prepSec = (o.estimated_prep_min ?? 12) * 60;
    return prepSec - elapsed <= 120;
  });
  const done = orders.filter(o => o.status === 'bereit');
  const score = active.length ? Math.round(((active.length - critical.length) / active.length) * 100) : 100;

  const scoreColor = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-indigo-400" />
          <span className="text-sm font-semibold text-white">Smart-Timing Countdown V37</span>
        </div>
        <div className={cn('text-lg font-bold', scoreColor)}>{score}%</div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { icon: Flame, label: 'Aktiv', val: active.length, color: 'text-amber-400' },
          { icon: AlertCircle, label: 'Kritisch', val: critical.length, color: 'text-red-400' },
          { icon: CheckCircle2, label: 'Bereit', val: done.length, color: 'text-emerald-400' },
          { icon: TrendingUp, label: 'Score', val: `${score}%`, color: scoreColor },
        ].map(({ icon: Icon, label, val, color }) => (
          <div key={label} className="rounded-lg bg-white/5 p-2 text-center">
            <Icon className={cn('h-3 w-3 mx-auto mb-1', color)} />
            <div className={cn('text-sm font-bold', color)}>{val}</div>
            <div className="text-xs text-white/40">{label}</div>
          </div>
        ))}
      </div>

      {/* Station-Filter */}
      <div className="flex gap-1 flex-wrap">
        <button
          onClick={() => setStationFilter(null)}
          className={cn('px-2 py-0.5 rounded text-xs transition-colors', stationFilter === null ? 'bg-indigo-500/30 text-indigo-300' : 'text-white/40 hover:text-white/60')}
        >
          Alle
        </button>
        {STATIONS.map(s => (
          <button
            key={s}
            onClick={() => setStationFilter(stationFilter === s ? null : s)}
            className={cn('px-2 py-0.5 rounded text-xs transition-colors', stationFilter === s ? 'bg-indigo-500/30 text-indigo-300' : 'text-white/40 hover:text-white/60')}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Countdown Wall */}
      {loading ? (
        <div className="text-center text-white/40 text-xs py-4">Lädt…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-white/40 text-xs py-4">Keine aktiven Bestellungen</div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {filtered.map(o => {
            const start = o.zubereitung_start ? new Date(o.zubereitung_start).getTime() : null;
            const prepSec = (o.estimated_prep_min ?? 12) * 60;
            const elapsed = start ? Math.floor((now - start) / 1000) : 0;
            const restSec = Math.max(0, prepSec - elapsed);
            const driverEtaSec = o.fahrer_eta_min !== null && o.fahrer_eta_min !== undefined ? o.fahrer_eta_min * 60 : null;
            const level = getColorLevel(restSec, driverEtaSec);
            const c = COLOR[level];
            const progress = start ? Math.min(100, Math.round((elapsed / prepSec) * 100)) : 0;

            return (
              <div key={o.id} className={cn('rounded-lg border p-2 space-y-1', c.bg, c.border)}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-white/70">{o.bestellnummer ?? o.id.slice(0, 5)}</span>
                  <span className={cn('text-xs px-1 rounded', c.badge)}>{c.label}</span>
                </div>
                <div className={cn('text-xl font-bold font-mono', c.text)}>{fmtSec(restSec)}</div>
                {/* Fortschrittsbalken */}
                <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', level === 'ok' ? 'bg-emerald-400' : level === 'warn' ? 'bg-amber-400' : level === 'critical' ? 'bg-red-400' : level === 'overdue' ? 'bg-rose-400' : 'bg-slate-400')}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-white/40">
                  <span>{o.station ?? '—'}</span>
                  {driverEtaSec !== null && <span className="flex items-center gap-0.5"><Zap className="h-2.5 w-2.5" />{Math.round(driverEtaSec / 60)}m</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

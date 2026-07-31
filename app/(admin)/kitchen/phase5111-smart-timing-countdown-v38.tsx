'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, Clock, Flame, Zap, CheckCircle2, AlertCircle, Timer, TrendingUp, TrendingDown, BarChart2 } from 'lucide-react';

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
  if (restSec > 0 && restSec > 300) return 'ok';
  if (restSec > 0 && restSec > 120) return 'warn';
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

export function KitchenPhase5111SmartTimingCountdownV38({ locationId }: Props) {
  const now = useNow();
  const [orders, setOrders] = useState<OrderTiming[]>([]);
  const [loading, setLoading] = useState(true);
  const [stationFilter, setStationFilter] = useState<string>('Alle');
  const [prevScore, setPrevScore] = useState<number | null>(null);

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

  const criticalCount = enriched.filter(o => ['critical', 'overdue'].includes(o.level)).length;
  const doneCount = orders.filter(o => o.status === 'bereit').length;
  const score = active.length ? Math.round(((active.length - criticalCount) / active.length) * 100) : 100;

  useEffect(() => {
    setPrevScore(prev => {
      if (prev === null) return score;
      return prev;
    });
    const t = setTimeout(() => setPrevScore(score), 500);
    return () => clearTimeout(t);
  }, [score]);

  const scoreDelta = prevScore !== null ? score - prevScore : 0;
  const scoreColor = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-red-400';

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center justify-center h-32">
        <span className="text-slate-400 text-sm animate-pulse">Lade Timing-Daten…</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-indigo-400" />
          <span className="text-sm font-semibold text-white">Smart-Timing Countdown V38</span>
          <span className="text-xs text-slate-500">Schicht-Effizienz</span>
        </div>
        <div className="flex items-center gap-1.5">
          {scoreDelta !== 0 && (
            scoreDelta > 0
              ? <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              : <TrendingDown className="h-3.5 w-3.5 text-red-400" />
          )}
          <div className={cn('text-lg font-bold', scoreColor)}>{score}%</div>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-5 gap-1.5">
        {[
          { icon: Flame,        label: 'Aktiv',     val: active.length,    color: 'text-amber-400'   },
          { icon: AlertCircle,  label: 'Kritisch',  val: criticalCount,    color: 'text-red-400'     },
          { icon: CheckCircle2, label: 'Bereit',    val: doneCount,        color: 'text-emerald-400' },
          { icon: ChefHat,      label: 'Gesamt',    val: orders.length,    color: 'text-indigo-400'  },
          { icon: BarChart2,    label: 'Score',     val: `${score}%`,      color: scoreColor         },
        ].map(({ icon: Icon, label, val, color }) => (
          <div key={label} className="rounded-lg bg-white/5 p-2 text-center">
            <Icon className={cn('h-3.5 w-3.5 mx-auto mb-0.5', color)} />
            <div className={cn('text-sm font-bold leading-tight', color)}>{val}</div>
            <div className="text-[10px] text-slate-500">{label}</div>
          </div>
        ))}
      </div>

      {/* Station Filter */}
      <div className="flex gap-1.5 flex-wrap">
        {STATIONS.map(s => (
          <button
            key={s}
            onClick={() => setStationFilter(s)}
            className={cn(
              'px-2 py-0.5 rounded-md text-xs font-medium transition-colors',
              stationFilter === s
                ? 'bg-indigo-500/30 text-indigo-300 border border-indigo-500/40'
                : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Countdown Wall */}
      {enriched.length === 0 ? (
        <div className="text-center text-slate-500 text-xs py-4">Keine aktiven Bestellungen</div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {enriched
            .sort((a, b) => a.restSec - b.restSec)
            .map(o => {
              const c = COLOR[o.level];
              return (
                <div key={o.id} className={cn('rounded-lg border p-2.5 space-y-1.5', c.bg, c.border)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-white">{o.bestellnummer ?? o.id}</span>
                      {o.batch_id && (
                        <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1 rounded">{o.batch_id}</span>
                      )}
                    </div>
                    <span className={cn('text-xs font-medium', c.text)}>{c.label}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={cn('text-base font-mono font-bold', c.text)}>{fmtSec(o.restSec)}</span>
                    <div className="flex items-center gap-1">
                      {o.station && <span className="text-[10px] text-slate-400">{o.station}</span>}
                      {o.syncWarning && <Zap className="h-3 w-3 text-yellow-400" title="Fahrer früher da" />}
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', c.bar)}
                      style={{ width: `${o.pct}%` }}
                    />
                  </div>
                  {o.fahrer_eta_min != null && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5 text-slate-500" />
                      <span className="text-[10px] text-slate-400">Fahrer in {o.fahrer_eta_min} Min</span>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* Schicht-Score Ring */}
      <div className="flex items-center justify-between pt-1 border-t border-white/5">
        <span className="text-[10px] text-slate-500">Schicht-Effizienz</span>
        <div className="flex items-center gap-1.5">
          <div className="w-24 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', score >= 80 ? 'bg-emerald-400' : score >= 60 ? 'bg-amber-400' : 'bg-red-400')}
              style={{ width: `${score}%` }}
            />
          </div>
          <span className={cn('text-xs font-bold', scoreColor)}>{score}%</span>
        </div>
      </div>
    </div>
  );
}

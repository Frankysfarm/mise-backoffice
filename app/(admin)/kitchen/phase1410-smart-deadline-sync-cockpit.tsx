'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, Clock, Flame, Timer, Zap } from 'lucide-react';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  typ?: string;
  kunde_name?: string | null;
};

type KitchenTiming = {
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

type DriverBatch = {
  driver_name: string | null;
  pickup_eta_sec: number; // seconds until driver arrives at restaurant
  order_ids: string[];
};

interface Props {
  orders: Order[];
  timings: KitchenTiming[];
}

type DeadlineState = 'ok' | 'soon' | 'urgent' | 'critical' | 'overdue' | 'done';

function getDeadlineState(remainSec: number | null, status: string): DeadlineState {
  if (status === 'fertig') return 'done';
  if (remainSec === null) return 'ok';
  if (remainSec < 0) return 'overdue';
  if (remainSec < 60) return 'critical';
  if (remainSec < 180) return 'urgent';
  if (remainSec < 360) return 'soon';
  return 'ok';
}

const STATE_STYLES: Record<DeadlineState, { bar: string; bg: string; text: string; border: string; label: string; pulse: boolean }> = {
  ok:       { bar: 'bg-matcha-500',  bg: 'bg-matcha-50',  text: 'text-matcha-800',  border: 'border-matcha-200',  label: 'Planmäßig', pulse: false },
  soon:     { bar: 'bg-amber-400',   bg: 'bg-amber-50',   text: 'text-amber-800',   border: 'border-amber-200',   label: 'Bald',      pulse: false },
  urgent:   { bar: 'bg-orange-500',  bg: 'bg-orange-50',  text: 'text-orange-800',  border: 'border-orange-200',  label: 'Dringend!', pulse: true  },
  critical: { bar: 'bg-red-500',     bg: 'bg-red-50',     text: 'text-red-800',     border: 'border-red-300',     label: 'KRITISCH',  pulse: true  },
  overdue:  { bar: 'bg-red-600',     bg: 'bg-red-100',    text: 'text-red-900',     border: 'border-red-400',     label: 'ÜBERFÄLLIG',pulse: true  },
  done:     { bar: 'bg-matcha-400',  bg: 'bg-matcha-50',  text: 'text-matcha-700',  border: 'border-matcha-200',  label: 'Fertig',    pulse: false },
};

function fmt(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = sec < 0 ? '-' : '';
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}

export function KitchenPhase1410SmartDeadlineSyncCockpit({ orders, timings }: Props) {
  const [, setTick] = useState(0);
  const [driverBatches, setDriverBatches] = useState<DriverBatch[]>([]);

  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  // Poll driver pickup ETAs
  useEffect(() => {
    const load = () => {
      fetch('/api/delivery/admin/fahrer-kapazitaet-live', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (!d) return;
          const batches: DriverBatch[] = [];
          const items = Array.isArray(d.drivers) ? d.drivers : Array.isArray(d) ? d : [];
          for (const drv of items) {
            if (!drv.pickup_eta_min || !Array.isArray(drv.order_ids)) continue;
            batches.push({
              driver_name: drv.name ?? drv.vorname ?? null,
              pickup_eta_sec: (drv.pickup_eta_min ?? 0) * 60,
              order_ids: drv.order_ids,
            });
          }
          setDriverBatches(batches);
        })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, []);

  const now = Date.now();

  const active = orders.filter(o =>
    ['bestätigt', 'in_zubereitung', 'fertig'].includes(o.status)
  );

  if (active.length === 0) return null;

  type Row = {
    order: Order;
    timing: KitchenTiming | undefined;
    remainSec: number | null;
    progressPct: number;
    state: DeadlineState;
    driverArrivingSec: number | null;
  };

  const rows: Row[] = active.map(o => {
    const timing = timings.find(t => t.order_id === o.id);
    let remainSec: number | null = null;
    let progressPct = 0;

    if (timing?.ready_target) {
      remainSec = Math.round((new Date(timing.ready_target).getTime() - now) / 1000);
      const totalSec = (timing.prep_min ?? 15) * 60;
      const elapsedSec = totalSec - remainSec;
      progressPct = Math.max(0, Math.min(100, Math.round((elapsedSec / totalSec) * 100)));
    } else if (o.bestellt_am && o.geschaetzte_zubereitung_min) {
      const started = new Date(o.bestellt_am).getTime();
      const totalMs = o.geschaetzte_zubereitung_min * 60_000;
      const elapsed = now - started;
      remainSec = Math.round((started + totalMs - now) / 1000);
      progressPct = Math.max(0, Math.min(100, Math.round((elapsed / totalMs) * 100)));
    }

    // Check if a driver is coming for this order
    const batch = driverBatches.find(b => b.order_ids.includes(o.id));
    const driverArrivingSec = batch ? batch.pickup_eta_sec : null;

    return {
      order: o,
      timing,
      remainSec,
      progressPct: o.status === 'fertig' ? 100 : progressPct,
      state: getDeadlineState(remainSec, o.status),
      driverArrivingSec,
    };
  }).sort((a, b) => {
    // Sort: overdue first, then by remainSec ascending
    const pri = (s: DeadlineState) =>
      s === 'overdue' ? 0 : s === 'critical' ? 1 : s === 'urgent' ? 2 : s === 'soon' ? 3 : s === 'done' ? 5 : 4;
    if (pri(a.state) !== pri(b.state)) return pri(a.state) - pri(b.state);
    if (a.remainSec !== null && b.remainSec !== null) return a.remainSec - b.remainSec;
    return 0;
  });

  const criticalCount = rows.filter(r => r.state === 'critical' || r.state === 'overdue').length;
  const urgentCount = rows.filter(r => r.state === 'urgent').length;

  return (
    <div className="rounded-xl border border-matcha-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className={cn(
        'flex items-center gap-2 px-3 py-2 border-b',
        criticalCount > 0 ? 'bg-red-50 border-red-200' : urgentCount > 0 ? 'bg-orange-50 border-orange-200' : 'bg-matcha-50 border-matcha-200',
      )}>
        <Timer className={cn('h-3.5 w-3.5 shrink-0', criticalCount > 0 ? 'text-red-600 animate-pulse' : 'text-matcha-700')} />
        <span className={cn('font-display text-xs font-black uppercase tracking-wider', criticalCount > 0 ? 'text-red-800' : 'text-matcha-800')}>
          Deadline-Sync · Cockpit
        </span>
        {criticalCount > 0 && (
          <span className="ml-1 rounded-full bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 animate-pulse">
            {criticalCount} Kritisch
          </span>
        )}
        {urgentCount > 0 && criticalCount === 0 && (
          <span className="ml-1 rounded-full bg-orange-500 text-white text-[9px] font-black px-1.5 py-0.5">
            {urgentCount} Dringend
          </span>
        )}
        <span className="ml-auto text-[9px] font-semibold text-gray-400 tabular-nums">{rows.length} aktiv</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-100">
        {rows.map(row => {
          const st = STATE_STYLES[row.state];
          const nr = row.order.bestellnummer?.replace(/^FF-/, '') ?? '—';
          return (
            <div key={row.order.id} className={cn('flex items-center gap-3 px-3 py-2 text-xs', st.bg)}>
              {/* Order number */}
              <span className={cn('font-mono font-black text-[11px] w-10 shrink-0', st.text)}>#{nr}</span>

              {/* Progress bar container */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className={cn('text-[10px] font-semibold truncate', st.text)}>
                    {row.order.kunde_name ?? '—'}
                  </span>
                  <span className={cn(
                    'text-[10px] font-black ml-2 shrink-0',
                    st.text,
                    row.state === 'overdue' || row.state === 'critical' ? 'animate-pulse' : '',
                  )}>
                    {row.state === 'done' ? (
                      <span className="flex items-center gap-0.5"><CheckCircle2 className="h-3 w-3" /> Fertig</span>
                    ) : row.remainSec !== null ? (
                      fmt(row.remainSec)
                    ) : (
                      <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" /> —</span>
                    )}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-1000', st.bar, st.pulse ? 'animate-pulse' : '')}
                    style={{ width: `${row.progressPct}%` }}
                  />
                </div>
              </div>

              {/* Status badge */}
              <div className="shrink-0 flex items-center gap-1">
                {row.driverArrivingSec !== null && row.state !== 'done' && (
                  <span className="text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded px-1 py-0.5">
                    Fahrer ~{Math.max(0, Math.round(row.driverArrivingSec / 60))}m
                  </span>
                )}
                <span className={cn(
                  'text-[9px] font-black rounded px-1.5 py-0.5',
                  row.state === 'done' ? 'bg-matcha-100 text-matcha-700' :
                  row.state === 'ok' ? 'bg-matcha-100 text-matcha-700' :
                  row.state === 'soon' ? 'bg-amber-100 text-amber-800' :
                  row.state === 'urgent' ? 'bg-orange-100 text-orange-800' :
                  'bg-red-100 text-red-800',
                )}>
                  {st.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer: driver sync warnings */}
      {rows.some(r => r.driverArrivingSec !== null && r.driverArrivingSec < 300 && r.state !== 'done') && (
        <div className="px-3 py-1.5 bg-blue-50 border-t border-blue-200 flex items-center gap-1.5">
          <Zap className="h-3 w-3 text-blue-600 animate-pulse shrink-0" />
          <span className="text-[10px] font-bold text-blue-800">
            Fahrer in &lt;5 Min — Bestellungen priorisieren!
          </span>
        </div>
      )}
    </div>
  );
}

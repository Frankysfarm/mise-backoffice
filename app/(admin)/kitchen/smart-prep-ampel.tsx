'use client';

import { useEffect, useState } from 'react';
import { Clock, Flame, CheckCircle2, AlertTriangle, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

type PrepStatus = 'ok' | 'tight' | 'critical' | 'done' | 'waiting';

interface OrderRow {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  typ: string;
}

interface TimingRow {
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
}

function computePrepStatus(order: OrderRow, timing: TimingRow | null, nowMs: number): {
  status: PrepStatus;
  elapsedMin: number;
  remainMin: number | null;
  targetMin: number | null;
  progressPct: number;
} {
  const targetMin = timing?.prep_min ?? order.geschaetzte_zubereitung_min ?? 20;
  const startMs = timing?.cook_start_at
    ? new Date(timing.cook_start_at).getTime()
    : order.bestellt_am
    ? new Date(order.bestellt_am).getTime()
    : null;

  if (order.status === 'fertig') {
    return { status: 'done', elapsedMin: 0, remainMin: 0, targetMin, progressPct: 100 };
  }

  if (!startMs || order.status === 'neu') {
    return { status: 'waiting', elapsedMin: 0, remainMin: targetMin, targetMin, progressPct: 0 };
  }

  const elapsedMs = nowMs - startMs;
  const elapsedMin = Math.floor(elapsedMs / 60_000);
  const remainMin = Math.max(0, targetMin - elapsedMin);
  const progressPct = Math.min(100, Math.round((elapsedMin / targetMin) * 100));
  const overPct = (elapsedMin - targetMin) / targetMin;

  let status: PrepStatus = 'ok';
  if (elapsedMin > targetMin) status = 'critical';
  else if (overPct > -0.2) status = 'tight';

  return { status, elapsedMin, remainMin, targetMin, progressPct };
}

const STATUS_META = {
  ok:       { bg: 'bg-matcha-50',  border: 'border-matcha-200', bar: 'bg-matcha-500', text: 'text-matcha-700',  label: 'OK',        icon: CheckCircle2 },
  tight:    { bg: 'bg-amber-50',   border: 'border-amber-200',  bar: 'bg-amber-400',  text: 'text-amber-700',   label: 'Knapp',     icon: Timer },
  critical: { bg: 'bg-red-50',     border: 'border-red-200',    bar: 'bg-red-500',    text: 'text-red-700',     label: 'Überfällig',icon: Flame },
  done:     { bg: 'bg-stone-50',   border: 'border-stone-200',  bar: 'bg-stone-400',  text: 'text-stone-500',   label: 'Fertig',    icon: CheckCircle2 },
  waiting:  { bg: 'bg-blue-50',    border: 'border-blue-200',   bar: 'bg-blue-400',   text: 'text-blue-700',    label: 'Wartend',   icon: Clock },
};

export function KitchenSmartPrepAmpel({
  orders,
  timings,
}: {
  orders: OrderRow[];
  timings: TimingRow[];
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(iv);
  }, []);

  const activeOrders = orders.filter(
    (o) => ['bestätigt', 'in_zubereitung'].includes(o.status) && o.typ === 'lieferung',
  );

  if (activeOrders.length === 0) return null;

  const rows = activeOrders.map((o) => {
    const timing = timings.find((t) => t.order_id === o.id) ?? null;
    const prep = computePrepStatus(o, timing, now);
    return { order: o, ...prep };
  });

  const criticalCount = rows.filter((r) => r.status === 'critical').length;
  const tightCount    = rows.filter((r) => r.status === 'tight').length;

  return (
    <div className="rounded-xl border border-matcha-700/40 bg-matcha-900/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-matcha-700/30">
        <Timer className="h-3.5 w-3.5 text-matcha-400 shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-widest text-matcha-300">
          Smart Prep-Ampel · {activeOrders.length} aktiv
        </span>
        {criticalCount > 0 && (
          <span className="ml-auto rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-black text-white animate-pulse">
            {criticalCount} überfällig
          </span>
        )}
        {tightCount > 0 && criticalCount === 0 && (
          <span className="ml-auto rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-black text-white">
            {tightCount} knapp
          </span>
        )}
      </div>

      {/* Order rows */}
      <div className="divide-y divide-matcha-800/30">
        {rows
          .sort((a, b) => {
            const ord = ['critical', 'tight', 'ok', 'waiting', 'done'];
            return ord.indexOf(a.status) - ord.indexOf(b.status);
          })
          .map(({ order, status, elapsedMin, remainMin, targetMin, progressPct }) => {
            const meta = STATUS_META[status];
            const Icon = meta.icon;
            return (
              <div
                key={order.id}
                className={cn(
                  'flex items-center gap-3 px-3 py-2',
                  status === 'critical' && 'animate-pulse',
                )}
              >
                {/* Order number */}
                <span className="font-mono text-[11px] font-black text-matcha-200 shrink-0 w-14 truncate">
                  #{order.bestellnummer.slice(-4)}
                </span>

                {/* Progress bar */}
                <div className="flex-1 relative h-3.5 rounded-full bg-matcha-800/60 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', meta.bar)}
                    style={{ width: `${progressPct}%` }}
                  />
                  {progressPct > 100 && (
                    <div className="absolute inset-0 rounded-full bg-red-500/30 animate-pulse" />
                  )}
                </div>

                {/* Time info */}
                <div className="flex items-center gap-1 shrink-0 w-20 justify-end">
                  <Icon className={cn('h-3 w-3 shrink-0', meta.text)} />
                  <span className={cn('font-mono text-[11px] font-bold tabular-nums', meta.text)}>
                    {status === 'done'
                      ? 'Fertig'
                      : status === 'waiting'
                      ? `~${targetMin}m`
                      : status === 'critical'
                      ? `+${elapsedMin - (targetMin ?? 0)}m`
                      : remainMin !== null
                      ? `${remainMin}m`
                      : '—'}
                  </span>
                </div>

                {/* Status badge */}
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black w-16 text-center',
                    meta.bg, meta.text, 'border', meta.border,
                  )}
                >
                  {meta.label}
                </span>
              </div>
            );
          })}
      </div>

      {/* Summary footer */}
      {rows.length > 3 && (
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-matcha-800/30 bg-matcha-900/60">
          <span className="text-[9px] text-matcha-400 font-semibold">
            Ø {Math.round(rows.reduce((s, r) => s + (r.targetMin ?? 0), 0) / rows.length)} Min Ziel
          </span>
          <span className="text-[9px] text-matcha-400 font-semibold">
            {rows.filter((r) => r.status === 'ok').length} pünktlich
          </span>
        </div>
      )}
    </div>
  );
}

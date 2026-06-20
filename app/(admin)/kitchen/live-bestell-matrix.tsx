'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, CheckCircle2, Loader, AlertTriangle } from 'lucide-react';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  kunde_name: string;
};

type Timing = {
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

type Props = {
  orders: Order[];
  timings: Timing[];
};

const ACTIVE_STATUSES = ['neu', 'bestätigt', 'in_zubereitung'];

function useTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
}

function getSecsLeft(order: Order, timing: Timing | undefined): number {
  const now = Date.now();
  if (timing?.ready_target) {
    return Math.floor((new Date(timing.ready_target).getTime() - now) / 1000);
  }
  const totalSecs = (timing?.prep_min ?? order.geschaetzte_zubereitung_min ?? 15) * 60;
  const startMs = timing?.cook_start_at
    ? new Date(timing.cook_start_at).getTime()
    : order.bestellt_am
    ? new Date(order.bestellt_am).getTime()
    : now;
  const elapsed = Math.floor((now - startMs) / 1000);
  return totalSecs - elapsed;
}

function urgencyClass(secsLeft: number): string {
  if (secsLeft < 0) return 'bg-red-50 border-red-500 animate-pulse';
  if (secsLeft < 120) return 'bg-red-50 border-red-500 animate-pulse';
  if (secsLeft < 240) return 'bg-orange-50 border-orange-400';
  if (secsLeft < 480) return 'bg-amber-50 border-amber-400';
  return 'bg-matcha-100 border-matcha-400';
}

function urgencyTextClass(secsLeft: number): string {
  if (secsLeft < 120) return 'text-red-600';
  if (secsLeft < 240) return 'text-orange-600';
  if (secsLeft < 480) return 'text-amber-700';
  return 'text-matcha-700';
}

function statusLabel(status: string): string {
  if (status === 'neu') return 'Neu';
  if (status === 'bestätigt') return 'Bestätigt';
  if (status === 'in_zubereitung') return 'In Zubereitung';
  return status;
}

function statusIcon(status: string) {
  if (status === 'in_zubereitung') return <Loader className="h-3 w-3 animate-spin text-matcha-600" />;
  if (status === 'bestätigt') return <CheckCircle2 className="h-3 w-3 text-matcha-500" />;
  return <Clock className="h-3 w-3 text-amber-500" />;
}

function formatCountdown(secsLeft: number): string {
  const abs = Math.abs(secsLeft);
  const mm = Math.floor(abs / 60);
  const ss = abs % 60;
  const str = `${mm}:${String(ss).padStart(2, '0')}`;
  return secsLeft < 0 ? `+${str}` : str;
}

function OrderCard({ order, timing }: { order: Order; timing: Timing | undefined }) {
  useTick();

  const secsLeft = getSecsLeft(order, timing);
  const totalSecs = (timing?.prep_min ?? order.geschaetzte_zubereitung_min ?? 15) * 60;
  const progressPct = Math.min(100, Math.max(0, ((totalSecs - secsLeft) / totalSecs) * 100));
  const isOverdue = secsLeft < 0;

  return (
    <div
      className={cn(
        'rounded-xl border-2 p-3 flex flex-col gap-2 transition-all duration-300',
        urgencyClass(secsLeft),
      )}
    >
      {/* Header: order number + status */}
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-black text-foreground truncate">#{order.bestellnummer}</span>
        <span className="flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground shrink-0">
          {statusIcon(order.status)}
          {statusLabel(order.status)}
        </span>
      </div>

      {/* Customer name */}
      <div className="text-[11px] font-semibold text-muted-foreground truncate">{order.kunde_name}</div>

      {/* Countdown */}
      <div className={cn('font-mono text-2xl font-black tabular-nums leading-none', urgencyTextClass(secsLeft))}>
        {isOverdue && <AlertTriangle className="inline h-4 w-4 mr-1" />}
        {formatCountdown(secsLeft)}
      </div>

      {/* Label */}
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {isOverdue ? 'Überfällig!' : secsLeft < 120 ? 'Dringend!' : secsLeft < 240 ? 'Bald fertig' : 'In Zubereitung'}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-1000',
            isOverdue
              ? 'bg-red-500'
              : secsLeft < 120
              ? 'bg-red-400'
              : secsLeft < 240
              ? 'bg-orange-400'
              : secsLeft < 480
              ? 'bg-amber-400'
              : 'bg-matcha-500',
          )}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}

export function KitchenLiveBestellMatrix({ orders, timings }: Props) {
  const active = orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
  const timingMap = new Map(timings.map((t) => [t.order_id, t]));

  if (active.length === 0) {
    return (
      <div className="rounded-xl border bg-matcha-50 p-8 text-center">
        <CheckCircle2 className="h-10 w-10 text-matcha-400 mx-auto mb-2" />
        <p className="text-sm font-bold text-matcha-700">Keine aktiven Bestellungen</p>
        <p className="text-xs text-muted-foreground mt-1">Alle Bestellungen wurden abgearbeitet</p>
      </div>
    );
  }

  // Sort: overdue first, then ascending by secs left
  const sorted = [...active].sort((a, b) => {
    const sa = getSecsLeft(a, timingMap.get(a.id));
    const sb = getSecsLeft(b, timingMap.get(b.id));
    return sa - sb;
  });

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center gap-2 flex-wrap text-[10px] font-bold">
        <span className="rounded-full bg-matcha-100 text-matcha-700 px-2 py-0.5">
          {active.length} Aktiv
        </span>
        {sorted.filter((o) => getSecsLeft(o, timingMap.get(o.id)) < 0).length > 0 && (
          <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 animate-pulse">
            ⚠ {sorted.filter((o) => getSecsLeft(o, timingMap.get(o.id)) < 0).length} Überfällig
          </span>
        )}
        {sorted.filter((o) => { const s = getSecsLeft(o, timingMap.get(o.id)); return s >= 0 && s < 120; }).length > 0 && (
          <span className="rounded-full bg-orange-100 text-orange-700 px-2 py-0.5">
            ⚡ {sorted.filter((o) => { const s = getSecsLeft(o, timingMap.get(o.id)); return s >= 0 && s < 120; }).length} Dringend
          </span>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {sorted.map((order) => (
          <OrderCard key={order.id} order={order} timing={timingMap.get(order.id)} />
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap text-[9px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-matcha-400 inline-block" />
          {'>'}8 Min
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
          4–8 Min
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-orange-400 inline-block" />
          2–4 Min
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
          {'<'}2 Min / Überfällig
        </span>
      </div>
    </div>
  );
}

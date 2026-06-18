'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Clock, Truck, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Batch {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  total_eta_min: number | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: {
    id: string;
    order_id: string;
    reihenfolge: number;
    geliefert_am: string | null;
  }[];
}

interface Props {
  batches: Batch[];
}

function useTick(ms = 5000) {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT((n) => n + 1), ms);
    return () => clearInterval(iv);
  }, [ms]);
}

function TourProgressBar({ batch, now }: { batch: Batch; now: number }) {
  const started = batch.startzeit ? new Date(batch.startzeit).getTime() : null;
  const totalMs = batch.total_eta_min != null ? batch.total_eta_min * 60_000 : null;

  if (!started || !totalMs) return null;

  const elapsedMs = now - started;
  const remainMs = totalMs - elapsedMs;
  const pct = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
  const isOverdue = remainMs < 0;
  const overdueMin = isOverdue ? Math.floor(-remainMs / 60_000) : null;
  const remainMin = !isOverdue ? Math.ceil(remainMs / 60_000) : null;

  const totalStops = batch.stops.length;
  const doneStops = batch.stops.filter((s) => s.geliefert_am).length;

  const driverName = batch.fahrer
    ? `${batch.fahrer.vorname} ${batch.fahrer.nachname[0]}.`
    : 'Fahrer';

  return (
    <div className={cn(
      'rounded-xl border p-3 space-y-2 transition-all',
      isOverdue ? 'border-red-300 bg-red-50' : pct > 80 ? 'border-amber-300 bg-amber-50' : 'border-border bg-white',
    )}>
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Truck className={cn('h-3.5 w-3.5 shrink-0', isOverdue ? 'text-red-500' : 'text-matcha-600')} />
          <span className="text-xs font-bold truncate text-foreground">{driverName}</span>
          {batch.zone && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground shrink-0">
              Zone {batch.zone}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isOverdue ? (
            <span className="flex items-center gap-0.5 text-[10px] font-black text-red-600 animate-pulse">
              <AlertTriangle className="h-3 w-3" />
              +{overdueMin} Min überfällig
            </span>
          ) : (
            <span className="flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground">
              <Clock className="h-3 w-3" />
              {remainMin} Min
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-1000',
            isOverdue ? 'bg-red-500' : pct > 80 ? 'bg-amber-400' : 'bg-matcha-500',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Stop progress */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-matcha-500" />
          <span>{doneStops}/{totalStops} Stops geliefert</span>
        </div>
        <span className="tabular-nums">{Math.round(pct)}% der Tour</span>
      </div>

      {/* Stop dots */}
      {totalStops > 0 && (
        <div className="flex items-center gap-1">
          {[...batch.stops]
            .sort((a, b) => a.reihenfolge - b.reihenfolge)
            .map((s) => (
              <div
                key={s.id}
                className={cn(
                  'h-2 w-2 rounded-full flex-1 transition-colors',
                  s.geliefert_am ? 'bg-matcha-500' : 'bg-muted',
                )}
              />
            ))}
        </div>
      )}
    </div>
  );
}

export function DispatchTourZeitfortschritt({ batches }: Props) {
  useTick(5000);
  const now = Date.now();

  const ACTIVE = new Set(['pickup', 'unterwegs', 'pending_acceptance', 'assigned', 'at_restaurant', 'on_route']);
  const active = batches.filter((b) => ACTIVE.has(b.status) && b.startzeit && b.total_eta_min);

  if (active.length === 0) return null;

  const overdue = active.filter((b) => {
    if (!b.startzeit || !b.total_eta_min) return false;
    const eta = new Date(b.startzeit).getTime() + b.total_eta_min * 60_000;
    return eta < now;
  }).length;

  return (
    <Card className="overflow-hidden">
      <div className={cn(
        'flex items-center gap-2 px-4 py-2.5 border-b',
        overdue > 0 ? 'bg-red-50' : 'bg-white',
      )}>
        <Truck className={cn('h-4 w-4 shrink-0', overdue > 0 ? 'text-red-500' : 'text-matcha-600')} />
        <span className="text-xs font-bold uppercase tracking-wider flex-1">Tour-Zeitfortschritt</span>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-muted-foreground">{active.length} aktiv</span>
          {overdue > 0 && (
            <span className="rounded-full bg-red-500 text-white px-2 py-0.5 font-bold animate-pulse">
              {overdue} überfällig
            </span>
          )}
        </div>
      </div>

      <div className="p-3 space-y-2">
        {active
          .sort((a, b) => {
            const etaA = a.startzeit && a.total_eta_min ? new Date(a.startzeit).getTime() + a.total_eta_min * 60_000 : Infinity;
            const etaB = b.startzeit && b.total_eta_min ? new Date(b.startzeit).getTime() + b.total_eta_min * 60_000 : Infinity;
            return etaA - etaB;
          })
          .map((batch) => (
            <TourProgressBar key={batch.id} batch={batch} now={now} />
          ))}
      </div>
    </Card>
  );
}

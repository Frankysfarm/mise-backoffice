'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Bike, CheckCircle2, Clock, MapPin, AlertTriangle, Zap, Route, TrendingUp,
} from 'lucide-react';

type Stop = {
  id: string;
  order_id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    eta_earliest: string | null;
    eta_latest: string | null;
  } | null;
};

type Batch = {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  total_distance_km: number | null;
  total_eta_min: number | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: Stop[];
};

function useTick(intervalMs = 10_000) {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT(n => n + 1), intervalMs);
    return () => clearInterval(iv);
  }, [intervalMs]);
}

function fmtMin(ms: number): string {
  const min = Math.round(ms / 60_000);
  if (min < 0) return `+${Math.abs(min)} Min`;
  if (min === 0) return 'jetzt';
  return `${min} Min`;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; borderColor: string }> = {
  pickup:              { label: 'Pickup',     color: 'text-amber-700',  bg: 'bg-amber-50',   borderColor: 'border-amber-300' },
  zugewiesen:          { label: 'Zugewiesen', color: 'text-purple-700', bg: 'bg-purple-50',  borderColor: 'border-purple-300' },
  unterwegs:           { label: 'Unterwegs',  color: 'text-blue-700',   bg: 'bg-blue-50',    borderColor: 'border-blue-300' },
  on_route:            { label: 'On Route',   color: 'text-blue-700',   bg: 'bg-blue-50',    borderColor: 'border-blue-300' },
  pending_acceptance:  { label: 'Wartet',     color: 'text-gray-600',   bg: 'bg-gray-50',    borderColor: 'border-gray-300' },
  at_restaurant:       { label: 'Am Rest.',   color: 'text-orange-700', bg: 'bg-orange-50',  borderColor: 'border-orange-300' },
  assigned:            { label: 'Vergeben',   color: 'text-indigo-700', bg: 'bg-indigo-50',  borderColor: 'border-indigo-300' },
};

function TourCard({ batch }: { batch: Batch }) {
  useTick();
  const now = Date.now();
  const sorted = [...batch.stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const doneCount = sorted.filter(s => !!s.geliefert_am).length;
  const totalCount = sorted.length;
  const pct = totalCount > 0 ? doneCount / totalCount : 0;

  const etaMs = batch.startzeit && batch.total_eta_min != null
    ? new Date(batch.startzeit).getTime() + batch.total_eta_min * 60_000
    : null;
  const remainMs = etaMs != null ? etaMs - now : null;
  const isOverdue = remainMs != null && remainMs < 0;
  const elapsedMin = batch.startzeit ? Math.round((now - new Date(batch.startzeit).getTime()) / 60_000) : null;

  const meta = STATUS_META[batch.status] ?? { label: batch.status, color: 'text-muted-foreground', bg: 'bg-muted', borderColor: 'border-border' };
  const driverName = batch.fahrer
    ? `${batch.fahrer.vorname} ${batch.fahrer.nachname[0]}.`
    : 'Fahrer';

  const nextStop = sorted.find(s => !s.geliefert_am);
  const nextEtaMs = nextStop?.order?.eta_earliest
    ? new Date(nextStop.order.eta_earliest).getTime()
    : null;
  const nextRemainMs = nextEtaMs != null ? nextEtaMs - now : null;

  return (
    <div className={cn(
      'rounded-xl border-2 p-3 transition-all',
      meta.borderColor, meta.bg,
      isOverdue && 'ring-2 ring-red-400 ring-offset-1',
    )}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <Bike className={cn('h-3.5 w-3.5 shrink-0', meta.color)} />
          <span className={cn('font-bold text-xs', meta.color)}>{driverName}</span>
        </div>
        <span className={cn(
          'ml-auto rounded-full px-2 py-0.5 text-[9px] font-black',
          meta.color, 'bg-white/60',
        )}>
          {meta.label}
        </span>
        {isOverdue && (
          <span className="flex items-center gap-0.5 rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[9px] font-black animate-pulse">
            <AlertTriangle className="h-2.5 w-2.5" />
            {fmtMin(remainMs!)}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 h-2.5 rounded-full bg-white/60 border border-white/40 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              isOverdue ? 'bg-red-500' : pct >= 1 ? 'bg-green-500' : 'bg-blue-500',
            )}
            style={{ width: `${pct * 100}%` }}
          />
        </div>
        <span className={cn('text-[9px] font-black tabular-nums shrink-0', meta.color)}>
          {doneCount}/{totalCount}
        </span>
      </div>

      {/* Stops row */}
      <div className="flex gap-1 flex-wrap mb-2">
        {sorted.map((s, i) => (
          <div
            key={s.id}
            className={cn(
              'rounded-md px-1.5 py-0.5 text-[8px] font-bold flex items-center gap-0.5',
              s.geliefert_am
                ? 'bg-green-100 text-green-700 line-through opacity-60'
                : i === sorted.findIndex(st => !st.geliefert_am)
                ? 'bg-blue-500 text-white'
                : 'bg-white/60 text-muted-foreground',
            )}
            title={s.order?.kunde_adresse ?? ''}
          >
            {s.geliefert_am && <CheckCircle2 className="h-2 w-2 shrink-0" />}
            {s.order?.bestellnummer?.slice(-4) ?? `#${i + 1}`}
          </div>
        ))}
      </div>

      {/* Meta info */}
      <div className="flex items-center gap-2 flex-wrap text-[9px] text-muted-foreground">
        {elapsedMin != null && elapsedMin > 0 && (
          <span className="flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />
            {elapsedMin} Min unterwegs
          </span>
        )}
        {batch.total_distance_km != null && (
          <span className="flex items-center gap-0.5">
            <Route className="h-2.5 w-2.5" />
            {batch.total_distance_km.toFixed(1)} km
          </span>
        )}
        {nextStop?.order && !isOverdue && nextRemainMs != null && (
          <span className={cn(
            'flex items-center gap-0.5 ml-auto font-bold',
            nextRemainMs < 0 ? 'text-red-600' : nextRemainMs < 5 * 60_000 ? 'text-orange-600' : 'text-muted-foreground',
          )}>
            <MapPin className="h-2.5 w-2.5" />
            Nächste: {fmtMin(nextRemainMs)}
          </span>
        )}
        {batch.zone && (
          <span className="rounded-full bg-white/60 px-1.5 py-0.5 font-bold">{batch.zone}</span>
        )}
      </div>
    </div>
  );
}

export function LiveTourTracker({
  batches,
}: {
  batches: Batch[];
}) {
  useTick();
  const active = batches.filter(b =>
    ['pickup', 'zugewiesen', 'unterwegs', 'on_route', 'at_restaurant', 'assigned', 'pending_acceptance'].includes(b.status)
  );

  if (active.length === 0) return null;

  const now = Date.now();
  const overdueCount = active.filter(b => {
    if (!b.startzeit || b.total_eta_min == null) return false;
    return now > new Date(b.startzeit).getTime() + b.total_eta_min * 60_000;
  }).length;

  const totalStops = active.reduce((s, b) => s + b.stops.length, 0);
  const deliveredStops = active.reduce((s, b) => s + b.stops.filter(st => !!st.geliefert_am).length, 0);

  return (
    <div className="rounded-xl border bg-card p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <Route className="h-4 w-4 text-blue-500 shrink-0" />
        <span className="text-sm font-bold">Live-Touren</span>
        <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-[10px] font-black">
          {active.length} aktiv
        </span>
        {overdueCount > 0 && (
          <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-black animate-pulse">
            <AlertTriangle className="h-2.5 w-2.5 inline mr-0.5" />
            {overdueCount} überfällig
          </span>
        )}
        <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
          <TrendingUp className="h-3 w-3" />
          {deliveredStops}/{totalStops} Stopps erledigt
        </span>
      </div>

      {/* Tour cards */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {active.map(b => (
          <TourCard key={b.id} batch={b} />
        ))}
      </div>

      {/* Summary */}
      {active.length > 0 && (
        <div className="grid grid-cols-3 gap-2 border-t border-border pt-2">
          <div className="text-center">
            <div className="font-black text-lg text-blue-600">{active.length}</div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Touren</div>
          </div>
          <div className="text-center">
            <div className="font-black text-lg">{totalStops - deliveredStops}</div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Ausstehend</div>
          </div>
          <div className="text-center">
            <div className={cn('font-black text-lg', overdueCount > 0 ? 'text-red-600' : 'text-green-600')}>
              {overdueCount}
            </div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Überfällig</div>
          </div>
        </div>
      )}
    </div>
  );
}

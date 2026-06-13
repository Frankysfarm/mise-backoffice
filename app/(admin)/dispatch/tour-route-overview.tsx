'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Route, Clock, MapPin, CheckCircle2, Bike, AlertTriangle } from 'lucide-react';

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
  startzeit?: string | null;
  total_eta_min: number | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: Stop[];
};

type Props = {
  batches: Batch[];
};

function BatchTourCard({ batch }: { batch: Batch }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  const sorted = [...batch.stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const doneCount = sorted.filter(s => !!s.geliefert_am).length;
  const totalCount = sorted.length;
  const pct = totalCount > 0 ? doneCount / totalCount : 0;

  // ETA calculation
  const etaMs = batch.startzeit && batch.total_eta_min != null
    ? new Date(batch.startzeit).getTime() + batch.total_eta_min * 60_000
    : null;
  const remainMin = etaMs != null ? Math.round((etaMs - now) / 60_000) : null;
  const isOverdue = remainMin != null && remainMin < 0;
  const elapsedMin = batch.startzeit ? Math.round((now - new Date(batch.startzeit).getTime()) / 60_000) : null;

  const driverName = batch.fahrer
    ? `${batch.fahrer.vorname} ${batch.fahrer.nachname[0]}.`
    : 'Fahrer';

  const statusMeta = {
    'pickup':     { label: 'Pickup',    color: 'text-amber-600',   bg: 'bg-amber-50  border-amber-200' },
    'aktiv':      { label: 'Unterwegs', color: 'text-blue-600',    bg: 'bg-blue-50   border-blue-200' },
    'unterwegs':  { label: 'Unterwegs', color: 'text-blue-600',    bg: 'bg-blue-50   border-blue-200' },
    'on_route':   { label: 'On Route',  color: 'text-blue-600',    bg: 'bg-blue-50   border-blue-200' },
    'zugewiesen': { label: 'Zugewiesen', color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
  };
  const meta = statusMeta[batch.status as keyof typeof statusMeta] ?? { label: batch.status, color: 'text-muted-foreground', bg: 'bg-muted border-border' };

  return (
    <div className={cn('rounded-xl border p-3 space-y-2 transition-all', meta.bg)}>
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className={cn('flex items-center gap-1.5 font-bold text-xs', meta.color)}>
          <Bike className="h-3.5 w-3.5 shrink-0" />
          {driverName}
        </div>
        <span className={cn(
          'inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-black',
          meta.color, 'bg-white/60 border border-current/30',
        )}>
          {meta.label}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {remainMin != null && (
            <span className={cn(
              'text-[10px] font-black tabular-nums',
              isOverdue ? 'text-red-600' : remainMin <= 5 ? 'text-orange-600' : 'text-muted-foreground',
            )}>
              {isOverdue
                ? <span className="flex items-center gap-0.5"><AlertTriangle className="h-2.5 w-2.5" />{Math.abs(remainMin)}m</span>
                : `${remainMin}m`}
            </span>
          )}
          {elapsedMin != null && (
            <span className="text-[9px] text-muted-foreground tabular-nums">
              +{elapsedMin}m
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="h-2 rounded-full bg-black/10 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              pct >= 1 ? 'bg-matcha-500' : isOverdue ? 'bg-red-500' : 'bg-blue-500',
            )}
            style={{ width: `${pct * 100}%` }}
          />
        </div>
        <div className="text-[9px] text-muted-foreground flex justify-between">
          <span>{doneCount}/{totalCount} geliefert</span>
          {etaMs && (
            <span>{new Date(etaMs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} ETA</span>
          )}
        </div>
      </div>

      {/* Stop dots - compact visual */}
      {sorted.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {sorted.map((stop, idx) => {
            const done = !!stop.geliefert_am;
            const isNext = !done && sorted.slice(0, idx).every(s => !!s.geliefert_am);
            const hasSoonEta = stop.order?.eta_earliest
              ? (new Date(stop.order.eta_earliest).getTime() - now) < 10 * 60_000
              : false;
            return (
              <div key={stop.id} className="flex items-center">
                <div
                  title={stop.order ? `${stop.order.bestellnummer} · ${stop.order.kunde_name}\n${stop.order.kunde_adresse ?? ''}` : ''}
                  className={cn(
                    'h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-black border-2 transition',
                    done
                      ? 'bg-matcha-500 border-matcha-600 text-white'
                      : isNext
                      ? hasSoonEta
                        ? 'bg-orange-400 border-orange-500 text-white animate-pulse'
                        : 'bg-blue-500 border-blue-600 text-white'
                      : 'bg-white/60 border-border text-muted-foreground',
                  )}
                >
                  {done ? '✓' : stop.reihenfolge}
                </div>
                {idx < sorted.length - 1 && (
                  <div className={cn(
                    'h-0.5 w-3 mx-0.5',
                    done ? 'bg-matcha-400' : 'bg-border',
                  )} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Next stop info */}
      {(() => {
        const nextStop = sorted.find(s => !s.geliefert_am);
        if (!nextStop?.order) return null;
        const eta = nextStop.order.eta_earliest
          ? new Date(nextStop.order.eta_earliest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
          : null;
        return (
          <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <span className="font-bold text-foreground truncate">
                {nextStop.order.kunde_name}
              </span>
              {nextStop.order.kunde_adresse && (
                <span className="ml-1 truncate">{nextStop.order.kunde_adresse}</span>
              )}
              {eta && <span className="ml-1 font-bold text-blue-600 tabular-nums">→ {eta}</span>}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export function TourRouteOverview({ batches }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const activeBatches = batches.filter(b =>
    ['aktiv', 'unterwegs', 'on_route', 'pickup', 'zugewiesen'].includes(b.status)
  );

  if (activeBatches.length === 0) return null;

  const totalStops = activeBatches.reduce((s, b) => s + b.stops.length, 0);
  const doneStops = activeBatches.reduce((s, b) => s + b.stops.filter(st => !!st.geliefert_am).length, 0);

  return (
    <div className="rounded-xl border bg-card p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Route className="h-3.5 w-3.5 text-blue-600 shrink-0" />
          <span className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Aktive Touren
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 border border-blue-200 px-2 py-0.5 text-[10px] font-black text-blue-700">
            {activeBatches.length} {activeBatches.length === 1 ? 'Tour' : 'Touren'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <CheckCircle2 className="h-3 w-3 text-matcha-500" />
          <span className="tabular-nums font-bold">{doneStops}/{totalStops}</span>
          <span>Stopps</span>
        </div>
      </div>

      {/* Tour cards */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {activeBatches.map(batch => (
          <BatchTourCard key={batch.id} batch={batch} />
        ))}
      </div>
    </div>
  );
}

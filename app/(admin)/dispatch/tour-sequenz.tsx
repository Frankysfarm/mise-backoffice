'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, MapPin, Route, ChevronRight, AlertTriangle } from 'lucide-react';

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

function useTick() {
  const [, setT] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setT((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
}

function etaLabel(iso: string | null | undefined): string {
  if (!iso) return '–';
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function StopEtaBadge({ eta_earliest, eta_latest, isDone }: { eta_earliest: string | null; eta_latest: string | null; isDone: boolean }) {
  if (isDone) return null;
  if (!eta_earliest) return null;
  const now = Date.now();
  const earliestMs = new Date(eta_earliest).getTime();
  const latestMs = eta_latest ? new Date(eta_latest).getTime() : earliestMs + 10 * 60_000;
  const minLeft = Math.round((earliestMs - now) / 60_000);
  const isOverdue = now > latestMs;
  const isUrgent = !isOverdue && minLeft <= 5;
  const fmt = etaLabel(eta_earliest);

  if (isOverdue) {
    const overdueMin = Math.round((now - latestMs) / 60_000);
    return (
      <span className="shrink-0 flex items-center gap-0.5 rounded-full bg-red-100 text-red-700 px-1.5 py-0.5 text-[9px] font-black animate-pulse">
        <AlertTriangle className="h-2.5 w-2.5" />+{overdueMin}m
      </span>
    );
  }
  if (isUrgent) {
    return (
      <span className="shrink-0 flex items-center gap-0.5 rounded-full bg-orange-100 text-orange-700 px-1.5 py-0.5 text-[9px] font-bold">
        <Clock className="h-2.5 w-2.5" />{minLeft}m · {fmt}
      </span>
    );
  }
  return (
    <span className="shrink-0 text-[10px] font-mono tabular-nums text-muted-foreground">
      {fmt}
    </span>
  );
}

function BatchSequenzCard({ batch }: { batch: Batch }) {
  useTick();

  const stops = [...batch.stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const doneCount = stops.filter((s) => s.geliefert_am).length;
  const remaining = stops.length - doneCount;
  const driverName = batch.fahrer
    ? `${batch.fahrer.vorname} ${batch.fahrer.nachname[0]}.`
    : 'Kein Fahrer';

  const now = Date.now();
  const etaMs = batch.startzeit && batch.total_eta_min
    ? new Date(batch.startzeit).getTime() + batch.total_eta_min * 60_000
    : null;
  const secsLeft = etaMs ? Math.floor((etaMs - now) / 1000) : null;
  const isOverdue = secsLeft !== null && secsLeft < -60;

  const statusColor =
    batch.status === 'on_route' || batch.status === 'unterwegs'
      ? 'border-matcha-400 bg-matcha-50'
      : batch.status === 'at_restaurant' || batch.status === 'pickup'
      ? 'border-amber-400 bg-amber-50'
      : 'border-border bg-card';

  return (
    <div className={cn('rounded-xl border-2 p-3 space-y-2.5 text-sm', statusColor)}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 shrink-0 rounded-full bg-matcha-700 text-white flex items-center justify-center font-black text-sm">
            {batch.fahrer?.vorname?.[0] ?? '?'}
          </div>
          <div className="min-w-0">
            <div className="font-bold truncate text-[13px]">{driverName}</div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Route className="h-3 w-3" />
              {batch.total_distance_km != null
                ? `${batch.total_distance_km.toFixed(1)} km`
                : '–'}
              {batch.zone && <span>· Zone {batch.zone}</span>}
            </div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          {secsLeft !== null ? (
            <div className={cn(
              'font-mono text-[11px] font-black tabular-nums',
              isOverdue ? 'text-red-600' : secsLeft < 300 ? 'text-orange-600' : 'text-matcha-700',
            )}>
              {isOverdue ? (
                <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" />+{Math.abs(Math.floor(secsLeft / 60))} Min</span>
              ) : (
                `${Math.floor(secsLeft / 60)} Min`
              )}
            </div>
          ) : null}
          <div className="text-[10px] text-muted-foreground">
            {doneCount}/{stops.length} zugestellt
          </div>
        </div>
      </div>

      {/* Stop Sequence */}
      <div className="relative">
        {/* Connector line */}
        <div className="absolute left-[13px] top-4 bottom-2 w-0.5 bg-border rounded-full" />
        <div className="space-y-2">
          {stops.map((stop, idx) => {
            const isDone = !!stop.geliefert_am;
            const isNext = !isDone && stops.slice(0, idx).every((s) => s.geliefert_am);
            return (
              <div key={stop.id} className="relative flex items-start gap-2 pl-0">
                {/* Stop node */}
                <div
                  className={cn(
                    'relative z-10 h-7 w-7 shrink-0 rounded-full border-2 flex items-center justify-center text-[11px] font-black transition-all',
                    isDone
                      ? 'bg-matcha-600 border-matcha-600 text-white'
                      : isNext
                      ? 'bg-white border-matcha-500 text-matcha-700 shadow-[0_0_8px_rgba(34,197,94,0.4)]'
                      : 'bg-muted border-border text-muted-foreground',
                  )}
                >
                  {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : idx + 1}
                </div>
                {/* Stop info */}
                <div className="flex-1 min-w-0 pb-2">
                  <div className="flex items-center justify-between gap-1">
                    <div className={cn(
                      'font-semibold truncate text-[12px]',
                      isDone ? 'line-through text-muted-foreground' : isNext ? 'text-matcha-700' : 'text-foreground',
                    )}>
                      {stop.order?.kunde_name ?? 'Unbekannt'}
                    </div>
                    <StopEtaBadge
                      eta_earliest={stop.order?.eta_earliest ?? null}
                      eta_latest={stop.order?.eta_latest ?? null}
                      isDone={isDone}
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                    <MapPin className="h-2.5 w-2.5 shrink-0" />
                    {stop.order?.kunde_adresse ?? stop.order?.bestellnummer ?? '–'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-matcha-500 rounded-full transition-all"
            style={{ width: `${stops.length > 0 ? (doneCount / stops.length) * 100 : 0}%` }}
          />
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
          {remaining > 0 ? `${remaining} offen` : 'Fertig'}
        </span>
      </div>

      {/* Tempo-Badge: Stopps/h bei laufenden Touren */}
      {doneCount > 0 && batch.startzeit && (() => {
        const elapsedH = (Date.now() - new Date(batch.startzeit).getTime()) / 3_600_000;
        if (elapsedH < 0.05) return null;
        const rate = Math.round(doneCount / elapsedH);
        if (rate === 0) return null;
        const isGood = rate >= 3;
        return (
          <div className="flex items-center justify-between">
            <span className={cn(
              'text-[9px] font-bold rounded-full px-2 py-0.5',
              isGood ? 'bg-matcha-100 text-matcha-700' : 'bg-amber-100 text-amber-700',
            )}>
              {rate} Stopps/h
            </span>
            <span className="text-[9px] text-muted-foreground tabular-nums">
              {Math.round(elapsedH * 60)} Min on Tour
            </span>
          </div>
        );
      })()}
    </div>
  );
}

export function TourSequenzPanel({ batches }: { batches: Batch[] }) {
  const active = batches.filter(
    (b) => ['pickup', 'unterwegs', 'on_route', 'at_restaurant', 'assigned', 'pending_acceptance'].includes(b.status),
  );

  if (active.length === 0) return null;

  const withStops = active.filter((b) => b.stops.length > 0);
  if (withStops.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-center gap-2 mb-3">
        <Route className="h-4 w-4 text-matcha-600" />
        <span className="text-sm font-bold">Tour-Sequenz</span>
        <span className="rounded-full bg-matcha-100 text-matcha-700 px-2 py-0.5 text-[10px] font-black">
          {withStops.length} aktiv
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {withStops.reduce((s, b) => s + b.stops.filter((st) => !st.geliefert_am).length, 0)} Stop{withStops.reduce((s, b) => s + b.stops.filter((st) => !st.geliefert_am).length, 0) !== 1 ? 's' : ''} offen
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {withStops.map((b) => (
          <BatchSequenzCard key={b.id} batch={b} />
        ))}
      </div>
    </div>
  );
}

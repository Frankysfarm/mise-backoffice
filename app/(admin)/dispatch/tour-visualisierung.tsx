'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, CheckCircle2, Clock, Truck, MapPin, Navigation, AlertTriangle } from 'lucide-react';

type BatchStop = {
  id: string;
  order_id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: { bestellnummer: string; kunde_name: string; kunde_adresse: string | null; eta_earliest: string | null; eta_latest: string | null } | null;
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
  stops: BatchStop[];
};

interface Props {
  batches: Batch[];
}

function elapsedMin(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
}

export function DispatchTourVisualisierung({ batches }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 30_000);
    return () => clearInterval(iv);
  }, []);

  const activeBatches = batches.filter(b =>
    b.status === 'unterwegs' || b.status === 'on_route' || b.status === 'aktiv' || b.status === 'assigned',
  );

  if (activeBatches.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Truck size={14} className="text-muted-foreground" />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Tour-Visualisierung
        </span>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
          {activeBatches.length} aktiv
        </span>
      </div>

      <div className="space-y-2">
        {activeBatches.map(batch => {
          const batchStops = [...batch.stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
          const completedCount = batchStops.filter(s => s.geliefert_am != null).length;
          const totalStops = batchStops.length;
          const progressPct = totalStops > 0 ? (completedCount / totalStops) * 100 : 0;

          const elapsed = elapsedMin(batch.startzeit);
          const etaTotal = batch.total_eta_min ?? null;
          const etaRemain = etaTotal != null ? Math.max(0, etaTotal - elapsed) : null;
          const isLate = etaTotal != null && elapsed > etaTotal * 1.15;

          const driverName = batch.fahrer
            ? `${batch.fahrer.vorname} ${batch.fahrer.nachname[0]}.`
            : 'Fahrer';

          return (
            <div key={batch.id} className="rounded-lg bg-muted/50 border border-border/60 px-3 py-2.5 space-y-2">
              {/* Header */}
              <div className="flex items-center gap-2">
                <Truck size={13} className="text-blue-600 shrink-0" />
                <span className="text-xs font-bold text-foreground">{driverName}</span>
                <span className="text-[10px] text-muted-foreground ml-1">
                  {completedCount}/{totalStops} Stopps
                </span>
                {batch.zone && (
                  <span className="rounded bg-background border border-border/50 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
                    {batch.zone}
                  </span>
                )}
                {etaRemain != null && (
                  <span className={cn(
                    'ml-auto flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums',
                    isLate
                      ? 'bg-red-100 text-red-700'
                      : etaRemain <= 5
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-matcha-100 text-matcha-700',
                  )}>
                    <Clock size={9} />
                    {etaRemain} Min
                  </span>
                )}
              </div>

              {/* Stopp-Kette */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                {batchStops.map((stop, idx) => {
                  const done = stop.geliefert_am != null;
                  const current = !done && batchStops.slice(0, idx).every(s => s.geliefert_am != null);
                  return (
                    <div key={stop.id} className="flex items-center gap-1 shrink-0">
                      <div
                        className={cn(
                          'h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-black border-2 shrink-0',
                          done    ? 'bg-matcha-500 border-matcha-600 text-white' :
                          current ? 'bg-blue-500 border-blue-600 text-white animate-pulse' :
                                    'bg-muted border-border text-muted-foreground',
                        )}
                        title={stop.order?.kunde_name ?? `Stop ${idx + 1}`}
                      >
                        {done ? <CheckCircle2 size={12} /> : idx + 1}
                      </div>
                      {idx < batchStops.length - 1 && (
                        <div className={cn(
                          'h-0.5 w-4 rounded-full',
                          done ? 'bg-matcha-400' : 'bg-border',
                        )} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Aktueller Stop: Adresse + ETA */}
              {(() => {
                const activeStop = batchStops.find(
                  (s, idx) => s.geliefert_am == null && batchStops.slice(0, idx).every((p) => p.geliefert_am != null),
                );
                if (!activeStop?.order) return null;
                const o = activeStop.order;
                const stopEtaMin =
                  batch.total_eta_min && batchStops.length > 0
                    ? Math.round((batch.total_eta_min / batchStops.length) * (batchStops.indexOf(activeStop) + 1 - completedCount))
                    : null;
                const etaIso = o.eta_latest ?? o.eta_earliest;
                const stopSecsLeft = etaIso ? Math.floor((new Date(etaIso).getTime() - Date.now()) / 1000) : null;
                const isLateStop = stopSecsLeft !== null && stopSecsLeft < -120;

                return (
                  <div className={cn(
                    'flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs',
                    isLateStop ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200',
                  )}>
                    <Navigation size={11} className={cn('shrink-0 mt-0.5', isLateStop ? 'text-red-500' : 'text-blue-500')} />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate text-foreground">{o.kunde_name}</div>
                      {(o.kunde_adresse) && (
                        <div className="text-[10px] text-muted-foreground truncate">
                          <MapPin size={8} className="inline mr-0.5" />
                          {o.kunde_adresse}
                        </div>
                      )}
                    </div>
                    {(stopSecsLeft !== null || stopEtaMin !== null) && (
                      <div className={cn(
                        'shrink-0 font-mono text-[10px] font-black tabular-nums',
                        isLateStop ? 'text-red-600' : 'text-blue-600',
                      )}>
                        {stopSecsLeft !== null
                          ? stopSecsLeft < 0
                            ? `+${Math.floor(Math.abs(stopSecsLeft) / 60)}m`
                            : `${Math.floor(stopSecsLeft / 60)}m`
                          : `~${stopEtaMin}m`}
                        {isLateStop && <AlertTriangle size={9} className="inline ml-0.5 text-red-500" />}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Progress-Balken */}
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    isLate ? 'bg-red-500' : 'bg-matcha-500',
                  )}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

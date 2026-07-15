'use client';

import { MapPin, Bike, Clock, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Stop = {
  id: string;
  reihenfolge?: number | null;
  geliefert_am?: string | null;
  eta_min?: number | null;
  adresse?: string | null;
};

type Batch = {
  id: string;
  status: string;
  startzeit?: string | null;
  total_eta_min?: number | null;
  fahrer_id?: string | null;
  zone?: string | null;
  stops?: Stop[];
};

type Driver = {
  employee_id: string;
  employee?: { vorname: string; nachname: string } | null;
};

type Props = {
  batches: Batch[];
  drivers: Driver[];
};

const ACTIVE_STATUSES = ['unterwegs', 'on_route', 'gestartet', 'in_delivery'];

function DriverName({ batch, drivers }: { batch: Batch; drivers: Driver[] }) {
  const dr = drivers.find((d) => d.employee_id === (batch.fahrer_id ?? ''));
  if (!dr?.employee) return <span className="text-muted-foreground">Fahrer</span>;
  return <span>{dr.employee.vorname} {dr.employee.nachname[0]}.</span>;
}

export function DispatchPhase1695TourFortschrittsBoard({ batches, drivers }: Props) {
  const active = batches.filter((b) => ACTIVE_STATUSES.includes(b.status));

  if (active.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2.5">
        <Bike className="h-4 w-4 text-matcha-600" />
        <span className="font-display text-sm font-bold uppercase tracking-wider">
          Tour-Fortschritts-Board
        </span>
        <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
          {active.length} aktive Touren
        </span>
      </div>

      <div className="divide-y">
        {active.map((batch) => {
          const stops = batch.stops ?? [];
          const done = stops.filter((s) => !!s.geliefert_am).length;
          const total = stops.length;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;

          const startMs = batch.startzeit ? new Date(batch.startzeit).getTime() : null;
          const elapsedMin = startMs ? Math.floor((Date.now() - startMs) / 60_000) : null;
          const etaMin = batch.total_eta_min ?? null;

          const health =
            elapsedMin !== null && etaMin !== null
              ? elapsedMin > etaMin * 1.2
                ? 'late'
                : elapsedMin > etaMin * 0.9
                ? 'tight'
                : 'ok'
              : 'unknown';

          const healthStyle = {
            ok:      'text-matcha-700',
            tight:   'text-amber-600',
            late:    'text-red-600',
            unknown: 'text-muted-foreground',
          }[health];

          return (
            <div key={batch.id} className="px-4 py-3 space-y-2">
              {/* Top row: driver + zone + time */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Bike className="h-3.5 w-3.5 shrink-0 text-matcha-600" />
                  <span className="text-sm font-semibold truncate">
                    <DriverName batch={batch} drivers={drivers} />
                  </span>
                  {batch.zone && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                      {batch.zone}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {elapsedMin !== null && (
                    <span className={cn('flex items-center gap-1 text-xs font-bold', healthStyle)}>
                      <Clock className="h-3 w-3" />
                      {elapsedMin}m{etaMin ? ` / ${etaMin}m` : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      pct >= 100 ? 'bg-matcha-500' : pct >= 50 ? 'bg-amber-400' : 'bg-blue-400',
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs font-bold tabular-nums text-muted-foreground w-12 text-right">
                  {done}/{total} Stopps
                </span>
              </div>

              {/* Stop dots */}
              {total > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {stops
                    .slice()
                    .sort((a, b) => (a.reihenfolge ?? 0) - (b.reihenfolge ?? 0))
                    .map((s, i) => (
                      <div key={s.id} className="flex items-center gap-0.5">
                        {s.geliefert_am ? (
                          <CheckCircle2 className="h-4 w-4 text-matcha-500" />
                        ) : (
                          <Circle className={cn('h-4 w-4', i === done ? 'text-matcha-600 fill-matcha-100' : 'text-muted-foreground')} />
                        )}
                        {i < stops.length - 1 && (
                          <div className={cn('h-px w-3', i < done ? 'bg-matcha-400' : 'bg-muted-foreground/30')} />
                        )}
                      </div>
                    ))}
                  {batch.zone && (
                    <span className="ml-1 flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      Rückkehr
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

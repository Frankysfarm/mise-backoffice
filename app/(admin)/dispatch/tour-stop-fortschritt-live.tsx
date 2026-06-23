'use client';

import { useEffect, useState } from 'react';
import { Route, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Stop {
  id: string;
  geliefert_am: string | null;
  kunde_name?: string | null;
}

interface Batch {
  id: string;
  status: string;
  gestartet_am: string | null;
  estimated_duration_min?: number | null;
  stops?: Stop[];
  driver?: { vorname: string; nachname: string } | null;
}

interface Props {
  batches: Batch[];
}

type TourHealth = 'gut' | 'knapp' | 'spaet';

function getTourHealth(batch: Batch, now: number): TourHealth {
  if (!batch.gestartet_am || !batch.estimated_duration_min) return 'gut';
  const elapsed = (now - new Date(batch.gestartet_am).getTime()) / 60_000;
  const pct = elapsed / batch.estimated_duration_min;
  if (pct < 0.7) return 'gut';
  if (pct < 1.0) return 'knapp';
  return 'spaet';
}

const healthStyle: Record<TourHealth, { dot: string; bar: string; badge: string; label: string }> = {
  gut:   { dot: 'bg-matcha-500', bar: 'bg-matcha-400', badge: 'bg-matcha-100 text-matcha-700', label: 'Im Plan' },
  knapp: { dot: 'bg-amber-500',  bar: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-700',  label: 'Knapp' },
  spaet: { dot: 'bg-red-500',    bar: 'bg-red-400',    badge: 'bg-red-100 text-red-700',      label: 'Verspätet' },
};

export function DispatchTourStopFortschrittLive({ batches }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(iv);
  }, []);

  const active = batches.filter((b) =>
    ['unterwegs', 'on_route', 'gestartet'].includes(b.status) && (b.stops?.length ?? 0) > 0,
  );

  if (active.length === 0) return null;

  return (
    <div className="rounded-2xl border bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <Route className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1">
          Tour-Stop-Fortschritt · Live
        </span>
        <span className="rounded-full bg-matcha-100 text-matcha-700 px-2 py-0.5 text-[10px] font-bold">
          {active.length} aktiv
        </span>
      </div>

      <div className="divide-y">
        {active.map((batch) => {
          const stops = batch.stops ?? [];
          const done = stops.filter((s) => s.geliefert_am).length;
          const total = stops.length;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          const health = getTourHealth(batch, now);
          const hs = healthStyle[health];
          const driverName = batch.driver
            ? `${batch.driver.vorname} ${batch.driver.nachname}`
            : 'Fahrer';
          const elapsedMin = batch.gestartet_am
            ? Math.floor((now - new Date(batch.gestartet_am).getTime()) / 60_000)
            : null;

          return (
            <div key={batch.id} className="px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <div className={cn('h-2 w-2 rounded-full shrink-0', hs.dot)} />
                <span className="text-xs font-bold flex-1 truncate">{driverName}</span>
                <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-bold', hs.badge)}>
                  {hs.label}
                </span>
                {elapsedMin !== null && (
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" />{elapsedMin} Min
                  </span>
                )}
              </div>

              {/* Stop dots */}
              <div className="flex items-center gap-1 mb-2 flex-wrap">
                {stops.map((s, i) => (
                  <div
                    key={s.id}
                    className={cn(
                      'h-4 w-4 rounded-full border-2 flex items-center justify-center text-[8px] font-bold transition-all',
                      s.geliefert_am
                        ? 'border-matcha-400 bg-matcha-400 text-white'
                        : i === done
                        ? 'border-amber-400 bg-amber-50 text-amber-700 animate-pulse'
                        : 'border-stone-200 bg-white text-stone-400',
                    )}
                    title={s.kunde_name ?? `Stop ${i + 1}`}
                  >
                    {s.geliefert_am ? <CheckCircle2 className="h-2.5 w-2.5" /> : i + 1}
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', hs.bar)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold tabular-nums text-muted-foreground shrink-0">
                  {done}/{total}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {active.some((b) => getTourHealth(b, now) === 'spaet') && (
        <div className="mx-4 mb-3 flex items-center gap-1.5 rounded-xl bg-red-50 border border-red-200 px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
          <span className="text-[11px] font-bold text-red-700">
            {active.filter((b) => getTourHealth(b, now) === 'spaet').length} Tour(en) überfällig
          </span>
        </div>
      )}
    </div>
  );
}

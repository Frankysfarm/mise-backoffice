'use client';

import { useEffect, useState } from 'react';
import { MapPin, Clock, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Stop = {
  id: string;
  order_id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    bestellnummer: string;
    kunde_name: string;
    eta_earliest: string | null;
    eta_latest: string | null;
  } | null;
};

type Batch = {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  total_eta_min: number | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: Stop[];
};

interface Props {
  batches: Batch[];
}

type TourHealth = 'im-plan' | 'knapp' | 'verspätet';

interface TourRow {
  batch: Batch;
  health: TourHealth;
  completedStops: number;
  totalStops: number;
  elapsedMin: number | null;
  remainMin: number | null;
  nextStop: Stop | null;
  etaMinsLate: number | null;
}

const ACTIVE = new Set(['unterwegs', 'on_route', 'assigned', 'pickup', 'en_route']);

function buildRow(batch: Batch): TourRow {
  const now = Date.now();
  const completedStops = batch.stops.filter(s => s.geliefert_am != null).length;
  const totalStops = batch.stops.length;
  const nextStop = batch.stops.find(s => !s.geliefert_am) ?? null;

  const elapsedMin = batch.startzeit
    ? Math.round((now - new Date(batch.startzeit).getTime()) / 60000)
    : null;

  const remainMin = batch.total_eta_min && elapsedMin !== null
    ? Math.max(0, batch.total_eta_min - elapsedMin)
    : null;

  let etaMinsLate: number | null = null;
  if (nextStop?.order?.eta_latest) {
    const diff = Math.round((now - new Date(nextStop.order.eta_latest).getTime()) / 60000);
    if (diff > 0) etaMinsLate = diff;
  }

  let health: TourHealth = 'im-plan';
  if (etaMinsLate !== null && etaMinsLate > 5) health = 'verspätet';
  else if (etaMinsLate !== null && etaMinsLate > 0) health = 'knapp';
  else if (remainMin !== null && batch.total_eta_min && elapsedMin !== null) {
    if (elapsedMin > batch.total_eta_min * 1.15) health = 'verspätet';
    else if (elapsedMin > batch.total_eta_min * 0.9) health = 'knapp';
  }

  return { batch, health, completedStops, totalStops, elapsedMin, remainMin, nextStop, etaMinsLate };
}

const HEALTH_CONFIG: Record<TourHealth, { label: string; dot: string; text: string; bg: string }> = {
  'im-plan':  { label: 'Im Plan',   dot: 'bg-matcha-500', text: 'text-matcha-700', bg: 'bg-matcha-50/60' },
  'knapp':    { label: 'Knapp',     dot: 'bg-amber-500',  text: 'text-amber-700',  bg: 'bg-amber-50/60'  },
  'verspätet':{ label: 'Verspätet', dot: 'bg-red-500',    text: 'text-red-700',    bg: 'bg-red-50/60'    },
};

export function DispatchTourRealtimeFortschritt({ batches }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 10000);
    return () => clearInterval(iv);
  }, []);

  const active = batches.filter(b => ACTIVE.has(b.status));
  if (active.length === 0) return null;

  const rows = active.map(buildRow).sort((a, b) => {
    const order: TourHealth[] = ['verspätet', 'knapp', 'im-plan'];
    return order.indexOf(a.health) - order.indexOf(b.health);
  });

  const verspätet = rows.filter(r => r.health === 'verspätet').length;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-100 bg-stone-50">
        <MapPin className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">
          Echtzeit-Tourfortschritt · {active.length} aktiv
        </span>
        {verspätet > 0 && (
          <span className="ml-auto rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700 animate-pulse">
            {verspätet} verspätet
          </span>
        )}
      </div>

      <div className="divide-y divide-stone-100">
        {rows.map(({ batch, health, completedStops, totalStops, elapsedMin, remainMin, nextStop, etaMinsLate }) => {
          const cfg = HEALTH_CONFIG[health];
          const progress = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;
          const driverName = batch.fahrer ? `${batch.fahrer.vorname} ${batch.fahrer.nachname}` : 'Fahrer';

          return (
            <div key={batch.id} className={cn('px-4 py-3', cfg.bg)}>
              <div className="flex items-start gap-3">
                {/* Health dot */}
                <div className="mt-1 shrink-0">
                  <div className={cn('h-2.5 w-2.5 rounded-full', cfg.dot,
                    health !== 'im-plan' && 'animate-pulse')} />
                </div>

                <div className="flex-1 min-w-0">
                  {/* Row 1: Driver + Zone + Health */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold">{driverName}</span>
                    {batch.zone && (
                      <span className="rounded-full bg-white/80 border border-stone-200 px-1.5 py-0.5 text-[9px] font-bold">
                        Zone {batch.zone}
                      </span>
                    )}
                    <span className={cn('text-[10px] font-bold ml-auto shrink-0', cfg.text)}>
                      {cfg.label}
                    </span>
                  </div>

                  {/* Row 2: Progress bar */}
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex flex-1 gap-0.5">
                      {Array.from({ length: totalStops }).map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            'flex-1 h-1.5 rounded-full',
                            i < completedStops ? cfg.dot : 'bg-stone-200',
                          )}
                        />
                      ))}
                    </div>
                    <span className="shrink-0 text-[9px] font-bold text-muted-foreground tabular-nums">
                      {completedStops}/{totalStops}
                    </span>
                  </div>

                  {/* Row 3: Next stop + timing */}
                  <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                    {nextStop?.order && (
                      <span className="flex items-center gap-1">
                        <Circle className="h-2.5 w-2.5 text-amber-500" />
                        <span className="font-medium">{nextStop.order.kunde_name}</span>
                      </span>
                    )}
                    {elapsedMin !== null && (
                      <span className="flex items-center gap-0.5 ml-auto">
                        <Clock className="h-2.5 w-2.5" />
                        {elapsedMin}m vergangen
                      </span>
                    )}
                    {remainMin !== null && (
                      <span className="font-semibold text-matcha-600">
                        ~{remainMin}m verbleibend
                      </span>
                    )}
                  </div>

                  {etaMinsLate !== null && etaMinsLate > 0 && (
                    <div className="mt-1 text-[10px] font-bold text-red-600">
                      {etaMinsLate} Min verspätet
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

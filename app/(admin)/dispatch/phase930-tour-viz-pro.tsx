'use client';

import { useMemo } from 'react';
import { cn, euro } from '@/lib/utils';
import { Route, Clock, CheckCircle2, MapPin, TrendingUp, Star } from 'lucide-react';

interface BatchStop {
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
}

interface Batch {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  total_distance_km: number | null;
  total_eta_min: number | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: BatchStop[];
}

interface Props {
  batches: Batch[];
}

function getStatusColor(status: string) {
  if (['on_route', 'unterwegs'].includes(status)) return 'bg-matcha-500';
  if (['at_restaurant', 'pickup'].includes(status)) return 'bg-saffron';
  if (['assigned', 'zugewiesen'].includes(status)) return 'bg-blue-500';
  return 'bg-stone-400';
}

function getStatusLabel(status: string) {
  if (['on_route', 'unterwegs'].includes(status)) return 'Unterwegs';
  if (['at_restaurant', 'pickup'].includes(status)) return 'Am Restaurant';
  if (['assigned', 'pending_acceptance'].includes(status)) return 'Zugewiesen';
  return status;
}

export function DispatchPhase930TourVizPro({ batches }: Props) {
  const now = Date.now();

  const activeBatches = useMemo(() =>
    batches.filter(b => ['pickup', 'unterwegs', 'on_route', 'at_restaurant', 'assigned', 'pending_acceptance'].includes(b.status)),
    [batches]
  );

  if (activeBatches.length === 0) return null;

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-subtle overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-100 bg-stone-50">
        <Route className="w-4 h-4 text-matcha-600" />
        <span className="text-sm font-semibold text-stone-800">Tour-Visualisierung Pro</span>
        <span className="text-xs text-stone-500">· {activeBatches.length} aktive Tour{activeBatches.length !== 1 ? 'en' : ''}</span>
      </div>

      <div className="divide-y divide-stone-100">
        {activeBatches.map(batch => {
          const driver = batch.fahrer;
          const stops = [...batch.stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
          const completedStops = stops.filter(s => s.geliefert_am).length;
          const totalStops = stops.length;
          const pct = totalStops > 0 ? (completedStops / totalStops) * 100 : 0;

          const etaMs = batch.startzeit && batch.total_eta_min != null
            ? new Date(batch.startzeit).getTime() + batch.total_eta_min * 60_000
            : null;
          const etaMinsLeft = etaMs ? Math.floor((etaMs - now) / 60_000) : null;

          return (
            <div key={batch.id} className="px-4 py-3">
              {/* Tour header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={cn('w-2.5 h-2.5 rounded-full', getStatusColor(batch.status))} />
                  <span className="text-sm font-semibold text-stone-800">
                    {driver ? `${driver.vorname} ${driver.nachname}` : 'Kein Fahrer'}
                  </span>
                  <span className="text-xs text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">
                    {getStatusLabel(batch.status)}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-stone-500">
                  {batch.total_distance_km != null && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {batch.total_distance_km.toFixed(1)} km
                    </span>
                  )}
                  {etaMinsLeft !== null && (
                    <span className={cn('flex items-center gap-1 font-medium',
                      etaMinsLeft < 5 ? 'text-red-600' : etaMinsLeft < 15 ? 'text-amber-600' : 'text-matcha-700'
                    )}>
                      <Clock className="w-3 h-3" />
                      {etaMinsLeft < 0 ? 'Überfällig' : `~${etaMinsLeft} Min`}
                    </span>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="relative h-1.5 bg-stone-100 rounded-full mb-3 overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full bg-matcha-500 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>

              {/* Stop timeline */}
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {stops.map((stop, i) => {
                  const isDelivered = !!stop.geliefert_am;
                  const isCurrent = !isDelivered && (i === 0 || stops[i - 1]?.geliefert_am);
                  return (
                    <div
                      key={stop.id}
                      className={cn(
                        'flex-none min-w-[100px] max-w-[130px] rounded-lg border p-2 text-[10px]',
                        isDelivered ? 'bg-matcha-50 border-matcha-200' :
                        isCurrent ? 'bg-saffron/10 border-saffron/30' :
                        'bg-stone-50 border-stone-200'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn('font-semibold', isDelivered ? 'text-matcha-600' : isCurrent ? 'text-saffron-dark' : 'text-stone-500')}>
                          Stop {stop.reihenfolge}
                        </span>
                        {isDelivered && <CheckCircle2 className="w-3 h-3 text-matcha-500" />}
                        {isCurrent && <div className="w-2 h-2 rounded-full bg-saffron animate-pulse" />}
                      </div>
                      <div className="text-stone-600 truncate">{stop.order?.bestellnummer ?? '–'}</div>
                      <div className="text-stone-400 truncate">{stop.order?.kunde_name ?? '–'}</div>
                    </div>
                  );
                })}
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-3 mt-2 text-[10px] text-stone-500">
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  {completedStops}/{totalStops} Stops
                </span>
                {batch.zone && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Zone {batch.zone}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

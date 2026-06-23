'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, Car, CheckCircle2, Clock, MapPin, Navigation2, Package, Star, Target, TrendingUp, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';

type ActiveTour = {
  batch_id: string;
  driver_name: string;
  driver_vehicle: string | null;
  status: string;
  stops_total: number;
  stops_done: number;
  started_at: string | null;
  eta_min: number | null;
  score: number | null;
  orders: { bestellnummer: string; kunde_name: string; geliefert_am: string | null }[];
};

function ScoreBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const color = score >= 80 ? 'bg-matcha-500' : score >= 60 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn('text-xs font-bold tabular-nums', score >= 80 ? 'text-matcha-700' : score >= 60 ? 'text-amber-600' : 'text-red-600')}>
        {score.toFixed(0)}
      </span>
    </div>
  );
}

function ElapsedTime({ startedAt }: { startedAt: string }) {
  const [secs, setSecs] = useState(() => Math.round((Date.now() - new Date(startedAt).getTime()) / 1000));
  useEffect(() => {
    const t = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const m = Math.floor(secs / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return <span className="tabular-nums">{h}h {m % 60}m</span>;
  return <span className="tabular-nums">{m}m {secs % 60}s</span>;
}

export function DispatchTourAktuelleUebersicht({ locationId }: { locationId: string | null }) {
  const [tours, setTours] = useState<ActiveTour[]>([]);

  useEffect(() => {
    const sb = createClient();

    async function load() {
      // Fetch active mise batches with driver + stops
      const { data: batches } = await sb
        .from('mise_delivery_batches')
        .select(`
          id, state, started_at, total_eta_min,
          driver:mise_drivers(id, name, vehicle),
          stops:mise_delivery_batch_stops(
            id, sequence, completed_at, type,
            order:customer_orders(id, bestellnummer, kunde_name, geliefert_am)
          )
        `)
        .in('state', ['at_restaurant', 'on_route'])
        .order('started_at', { ascending: true });

      if (!batches) return;

      // Fetch driver scores
      const driverIds = ((batches as any[]).map((b: any) => {
        const d = Array.isArray(b.driver) ? b.driver[0] : b.driver;
        return d?.id;
      }).filter(Boolean));

      const scoreMap = new Map<string, number>();
      if (driverIds.length > 0) {
        const { data: scores } = await sb
          .from('driver_score_daily')
          .select('driver_id, composite_score')
          .in('driver_id', driverIds)
          .eq('score_date', new Date().toISOString().split('T')[0]);
        (scores ?? []).forEach((s: any) => scoreMap.set(s.driver_id, s.composite_score ?? 0));
      }

      const mapped: ActiveTour[] = (batches as any[]).map((b: any) => {
        const driver = Array.isArray(b.driver) ? b.driver[0] : b.driver;
        const stops = (b.stops ?? []).filter((s: any) => s.type === 'dropoff');
        const stopsDone = stops.filter((s: any) => s.completed_at != null).length;
        const driverId = driver?.id;

        return {
          batch_id: b.id,
          driver_name: driver?.name ?? 'Fahrer',
          driver_vehicle: driver?.vehicle ?? null,
          status: b.state,
          stops_total: stops.length,
          stops_done: stopsDone,
          started_at: b.started_at ?? null,
          eta_min: b.total_eta_min ?? null,
          score: driverId ? (scoreMap.get(driverId) ?? null) : null,
          orders: stops.map((s: any) => ({
            bestellnummer: s.order?.bestellnummer ?? '—',
            kunde_name: s.order?.kunde_name ?? '—',
            geliefert_am: s.completed_at ?? null,
          })),
        };
      });

      setTours(mapped);
    }

    load();
    const ch = sb.channel('dispatch-tour-overview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mise_delivery_batches' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mise_delivery_batch_stops' }, load)
      .subscribe();
    const iv = setInterval(load, 30_000);
    return () => { sb.removeChannel(ch); clearInterval(iv); };
  }, [locationId]);

  if (tours.length === 0) return null;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation2 className="w-4 h-4 text-blue-600" />
          <span className="font-semibold text-sm text-gray-800">Aktive Touren</span>
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">{tours.length}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Zap className="w-3 h-3 text-matcha-600" />
          Live
        </div>
      </div>

      <div className="space-y-3">
        {tours.map(tour => {
          const progressPct = tour.stops_total > 0 ? (tour.stops_done / tour.stops_total) * 100 : 0;
          const isOnRoute = tour.status === 'on_route';
          const remainingStops = tour.stops_total - tour.stops_done;

          return (
            <div key={tour.batch_id} className={cn(
              'p-3 rounded-xl border space-y-2',
              isOnRoute ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'
            )}>
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {tour.driver_vehicle === 'car' ? <Car className="w-4 h-4 text-gray-600" /> : <Bike className="w-4 h-4 text-blue-600" />}
                  <span className="font-semibold text-sm text-gray-800">{tour.driver_name}</span>
                  <span className={cn('px-2 py-0.5 text-[10px] font-bold rounded-full',
                    isOnRoute ? 'bg-blue-500 text-white' : 'bg-orange-500 text-white')}>
                    {isOnRoute ? 'Unterwegs' : 'Restaurant'}
                  </span>
                </div>
                {tour.started_at && (
                  <span className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0">
                    <Clock className="w-3 h-3" />
                    <ElapsedTime startedAt={tour.started_at} />
                  </span>
                )}
              </div>

              {/* Progress */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span className="flex items-center gap-1"><Package className="w-3 h-3" />{tour.stops_done}/{tour.stops_total} Stops</span>
                  {remainingStops > 0 && <span className="text-blue-700 font-semibold">{remainingStops} verbleibend</span>}
                  {remainingStops === 0 && <span className="text-matcha-700 font-semibold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Fertig</span>}
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all duration-500', progressPct >= 100 ? 'bg-matcha-500' : 'bg-blue-500')}
                    style={{ width: `${progressPct}%` }} />
                </div>
              </div>

              {/* Score */}
              {tour.score != null && (
                <div className="flex items-center gap-2">
                  <Star className="w-3 h-3 text-amber-500 flex-shrink-0" />
                  <ScoreBar score={tour.score} />
                </div>
              )}

              {/* Order list */}
              <div className="space-y-1">
                {tour.orders.map((o, i) => (
                  <div key={i} className={cn('flex items-center gap-2 text-xs py-0.5', o.geliefert_am ? 'opacity-50' : '')}>
                    <span className={cn('w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0',
                      o.geliefert_am ? 'bg-matcha-500 text-white' : 'bg-white border-2 border-blue-300 text-blue-700')}>
                      {o.geliefert_am ? '✓' : i + 1}
                    </span>
                    <span className="font-mono text-gray-600">#{o.bestellnummer}</span>
                    <span className="truncate text-gray-700">{o.kunde_name}</span>
                    {o.geliefert_am && <span className="ml-auto text-matcha-600 font-semibold flex-shrink-0">Geliefert</span>}
                  </div>
                ))}
              </div>

              {tour.eta_min != null && tour.stops_done < tour.stops_total && (
                <p className="text-xs text-gray-500 flex items-center gap-1 border-t border-gray-200 pt-1.5">
                  <Target className="w-3 h-3 text-blue-500" />
                  ETA gesamt: <span className="font-semibold text-blue-700">{tour.eta_min} Min</span>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

'use client';

/**
 * TourRueckkehrOptimierung — Phase 403
 *
 * Zeigt für alle aktiven Touren:
 *  - Geschätzte Rückkehrzeit zum Restaurant
 *  - Anzahl verbleibender Stopps
 *  - Kapazität für nächste Zuweisung
 *  - Farbkodierung: wer steht bald wieder zur Verfügung
 *
 * Hilft Dispatch, die nächste Tour-Zuweisung vorzubereiten.
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Bike, Clock, CheckCircle2, RefreshCw, Star } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface DriverReturn {
  batchId: string;
  driverName: string;
  driverPhone: string | null;
  remainingStops: number;
  totalStops: number;
  etaReturnMin: number | null;
  zone: string | null;
  score: number | null;
  state: string;
}

interface Props {
  locationId: string | null;
}

function availabilityLabel(etaMin: number | null, remaining: number): {
  label: string; color: string; priority: number;
} {
  if (remaining === 0) return { label: 'Sofort verfügbar', color: 'text-matcha-600', priority: 0 };
  if (etaMin === null)  return { label: 'ETA unbekannt',   color: 'text-muted-foreground', priority: 99 };
  if (etaMin <= 5)      return { label: `~${etaMin} Min`,  color: 'text-matcha-600', priority: 1 };
  if (etaMin <= 15)     return { label: `~${etaMin} Min`,  color: 'text-amber-600', priority: 2 };
  return                       { label: `~${etaMin} Min`,  color: 'text-red-500',   priority: 3 };
}

export function TourRueckkehrOptimierung({ locationId }: Props) {
  const supabase = createClient();
  const [drivers, setDrivers] = useState<DriverReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  async function load() {
    if (!locationId) { setLoading(false); return; }

    const { data: batches, error } = await supabase
      .from('mise_delivery_batches')
      .select(`
        id, state, zone, dispatch_score, total_eta_min, created_at,
        mise_drivers!driver_id(name, phone),
        mise_batch_stops(id, state, stop_type)
      `)
      .eq('location_id', locationId)
      .in('state', ['on_route', 'at_restaurant', 'assigned'])
      .order('created_at', { ascending: true });

    if (error || !batches) { setLoading(false); return; }

    const rows: DriverReturn[] = (batches as unknown as {
      id: string; state: string; zone: string | null; dispatch_score: number | null;
      total_eta_min: number | null; created_at: string;
      mise_drivers: { name: string | null; phone: string | null } | null;
      mise_batch_stops: { id: string; state: string; stop_type: string }[];
    }[]).map(b => {
      const driver = b.mise_drivers;
      const stops = (b.mise_batch_stops ?? []).filter(s => s.stop_type === 'dropoff');
      const totalStops = stops.length;
      const remaining = stops.filter(s => s.state !== 'delivered').length;
      const completed = totalStops - remaining;

      const elapsedMin = (Date.now() - new Date(b.created_at).getTime()) / 60_000;
      const totalEta = b.total_eta_min ?? null;
      let etaReturnMin: number | null = null;
      if (totalEta !== null) {
        etaReturnMin = Math.max(0, Math.round(totalEta - elapsedMin + (remaining * 3)));
      }

      return {
        batchId: b.id,
        driverName: driver?.name ?? 'Fahrer',
        driverPhone: driver?.phone ?? null,
        remainingStops: remaining,
        totalStops,
        etaReturnMin,
        zone: b.zone,
        score: b.dispatch_score,
        state: b.state,
      };
    });

    const sorted = rows.sort((a, b) => {
      const pa = availabilityLabel(a.etaReturnMin, a.remainingStops).priority;
      const pb = availabilityLabel(b.etaReturnMin, b.remainingStops).priority;
      return pa - pb;
    });

    setDrivers(sorted);
    setLoading(false);
    setLastRefresh(new Date());
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (loading) return null;
  if (drivers.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <RefreshCw className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Rückkehr-Optimierung
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {lastRefresh ? lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : ''}
        </span>
      </div>

      <div className="divide-y">
        {drivers.map(driver => {
          const avail = availabilityLabel(driver.etaReturnMin, driver.remainingStops);
          const progressPct = driver.totalStops > 0
            ? Math.round(((driver.totalStops - driver.remainingStops) / driver.totalStops) * 100)
            : 0;

          return (
            <div key={driver.batchId} className="flex items-center gap-3 px-4 py-3">
              {/* Icon */}
              <div className="shrink-0">
                {driver.remainingStops === 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-matcha-500" />
                ) : (
                  <Bike className="h-5 w-5 text-amber-500" />
                )}
              </div>

              {/* Driver info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-foreground truncate">{driver.driverName}</span>
                  {driver.zone && (
                    <span className="text-[9px] rounded-full bg-muted px-1.5 py-0.5 font-bold">
                      Zone {driver.zone}
                    </span>
                  )}
                  {driver.score !== null && (
                    <span className="flex items-center gap-0.5 text-[9px] text-amber-600 font-bold">
                      <Star className="h-2.5 w-2.5" />
                      {driver.score}
                    </span>
                  )}
                </div>
                {/* Progress bar */}
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-matcha-500 transition-all duration-700"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-bold tabular-nums shrink-0 text-muted-foreground">
                    {driver.remainingStops} verbleibend
                  </span>
                </div>
              </div>

              {/* ETA label */}
              <div className="shrink-0 text-right">
                <div className={cn('text-sm font-black tabular-nums', avail.color)}>
                  {avail.label}
                </div>
                <div className="text-[9px] text-muted-foreground flex items-center gap-0.5 justify-end">
                  <Clock className="h-2.5 w-2.5" />
                  Rückkehr
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

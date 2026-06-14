'use client';

/**
 * FahrerZeitplanPanel
 *
 * Zeigt eine visuelle Timeline für alle aktiven Fahrer mit:
 * - Geschätzter Rückkehrzeit (basierend auf aktiver Tour-ETA)
 * - Aktuellem Touren-Fortschritt
 * - Wann der Fahrer für eine neue Tour verfügbar ist
 *
 * Hilft dem Dispatcher, eingehende Bestellungen optimal vorzuplanen.
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Bike, CheckCircle2, Clock, MapPin, Package, User, Zap } from 'lucide-react';

interface DriverTourState {
  driverId: string;
  vorname: string;
  nachname: string;
  fahrzeug: string | null;
  batchId: string | null;
  batchStatus: string | null;
  batchStartedAt: string | null;
  totalEtaMin: number | null;
  stopsTotal: number;
  stopsDelivered: number;
  onlineSeit: string | null;
  istOnline: boolean;
}

interface Props {
  locationId: string;
}

function vehicleIcon(v: string | null): string {
  switch (v) {
    case 'bike':   return '🚲';
    case 'ebike':  return '🛵';
    case 'scooter':return '🛴';
    case 'auto':   return '🚗';
    default:       return '🚲';
  }
}

function AvailabilityBadge({
  returnInMin,
  isFrei,
}: {
  returnInMin: number | null;
  isFrei: boolean;
}) {
  if (isFrei) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-matcha-100 text-matcha-700 px-2 py-0.5 text-[10px] font-black">
        <CheckCircle2 className="h-3 w-3" />
        Verfügbar
      </span>
    );
  }
  if (returnInMin == null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-bold">
        <Clock className="h-3 w-3" />
        Unterwegs
      </span>
    );
  }
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black',
      returnInMin <= 5 ? 'bg-matcha-100 text-matcha-700' :
      returnInMin <= 15 ? 'bg-amber-100 text-amber-800' :
      'bg-blue-100 text-blue-700',
    )}>
      <Clock className="h-3 w-3" />
      ~{returnInMin} Min
    </span>
  );
}

export function FahrerZeitplanPanel({ locationId }: Props) {
  const [drivers, setDrivers] = useState<DriverTourState[]>([]);
  const [now, setNow] = useState(new Date());
  const supabase = createClient();

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    async function load() {
      try {
        const { data: statusRows } = await supabase
          .from('driver_status')
          .select(`
            employee_id,
            ist_online,
            fahrzeug,
            aktueller_batch_id,
            online_seit,
            employee:employees(id, vorname, nachname, location_id)
          `)
          .eq('ist_online', true);

        if (cancelled) return;

        const locationDrivers = (statusRows ?? []).filter((s: any) =>
          s.employee?.location_id === locationId
        );

        const results: DriverTourState[] = [];

        for (const s of locationDrivers) {
          let batchId: string | null = s.aktueller_batch_id;
          let batchStatus: string | null = null;
          let batchStartedAt: string | null = null;
          let totalEtaMin: number | null = null;
          let stopsTotal = 0;
          let stopsDelivered = 0;

          if (batchId) {
            const { data: batch } = await supabase
              .from('delivery_batches')
              .select('id, status, started_at, total_eta_min')
              .eq('id', batchId)
              .maybeSingle();

            if (batch) {
              batchStatus = batch.status;
              batchStartedAt = batch.started_at;
              totalEtaMin = batch.total_eta_min;

              const { data: stops } = await supabase
                .from('batch_stops')
                .select('id, geliefert_am')
                .eq('batch_id', batchId);

              stopsTotal = stops?.length ?? 0;
              stopsDelivered = stops?.filter((st: any) => !!st.geliefert_am).length ?? 0;
            }
          }

          results.push({
            driverId: s.employee_id,
            vorname: s.employee?.vorname ?? 'Fahrer',
            nachname: s.employee?.nachname ?? '',
            fahrzeug: s.fahrzeug,
            batchId,
            batchStatus,
            batchStartedAt,
            totalEtaMin,
            stopsTotal,
            stopsDelivered,
            onlineSeit: s.online_seit,
            istOnline: s.ist_online,
          });
        }

        if (!cancelled) setDrivers(results);
      } catch {
        if (!cancelled) setDrivers([]);
      }
    }

    void load();

    const ch = supabase
      .channel(`fahrer-zeitplan-${locationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_status' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'batch_stops' }, () => void load())
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [locationId]);

  if (drivers.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-4 text-center text-sm text-muted-foreground">
        <Bike className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
        Keine Fahrer online
      </div>
    );
  }

  // Sortierung: Freieste Fahrer zuerst, dann nach Rückkehrzeit
  const getReturnMin = (d: DriverTourState): number => {
    if (!d.batchId || !d.batchStartedAt || !d.totalEtaMin) return 0;
    const startMs = new Date(d.batchStartedAt).getTime();
    const endMs = startMs + d.totalEtaMin * 60_000;
    return Math.max(0, Math.round((endMs - now.getTime()) / 60_000));
  };

  const sorted = [...drivers].sort((a, b) => {
    const isFrA = !a.batchId || a.batchStatus === 'abgeschlossen';
    const isFrB = !b.batchId || b.batchStatus === 'abgeschlossen';
    if (isFrA && !isFrB) return -1;
    if (!isFrA && isFrB) return 1;
    return getReturnMin(a) - getReturnMin(b);
  });

  const freeCount = sorted.filter((d) => !d.batchId || d.batchStatus === 'abgeschlossen').length;
  const busyCount = sorted.length - freeCount;

  return (
    <div className="rounded-xl border bg-card p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Bike className="h-4 w-4 text-blue-500 shrink-0" />
        <span className="text-sm font-bold">Fahrer-Zeitplan</span>
        <span className="rounded-full bg-matcha-100 text-matcha-700 px-2 py-0.5 text-[10px] font-black">
          {freeCount} frei
        </span>
        {busyCount > 0 && (
          <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-[10px] font-bold">
            {busyCount} unterwegs
          </span>
        )}
        <span className="ml-auto text-[9px] text-muted-foreground">Rückkehr-ETA</span>
      </div>

      {/* Fahrer-Liste */}
      <div className="space-y-2">
        {sorted.map((d) => {
          const isFrei = !d.batchId || d.batchStatus === 'abgeschlossen';
          const returnMin = isFrei ? null : getReturnMin(d);
          const progressPct = d.stopsTotal > 0 ? (d.stopsDelivered / d.stopsTotal) * 100 : 0;
          const onlineDurationMin = d.onlineSeit
            ? Math.floor((now.getTime() - new Date(d.onlineSeit).getTime()) / 60_000)
            : null;

          return (
            <div
              key={d.driverId}
              className={cn(
                'rounded-xl border p-2.5 transition-all',
                isFrei
                  ? 'border-matcha-300/50 bg-matcha-50/50'
                  : returnMin != null && returnMin <= 5
                  ? 'border-matcha-300/40 bg-matcha-50/30'
                  : 'border-white/10 bg-muted/30',
              )}
            >
              <div className="flex items-center gap-2">
                {/* Avatar */}
                <div className={cn(
                  'h-8 w-8 rounded-full flex items-center justify-center text-sm font-black shrink-0',
                  isFrei ? 'bg-matcha-200 text-matcha-800' : 'bg-blue-100 text-blue-700',
                )}>
                  {d.vorname[0]?.toUpperCase() ?? '?'}
                </div>

                {/* Name + Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold truncate">{d.vorname} {d.nachname[0]}.</span>
                    <span className="text-sm">{vehicleIcon(d.fahrzeug)}</span>
                    {onlineDurationMin != null && onlineDurationMin > 0 && (
                      <span className="text-[9px] text-muted-foreground tabular-nums">
                        {onlineDurationMin >= 60
                          ? `${Math.floor(onlineDurationMin / 60)}h${onlineDurationMin % 60}m`
                          : `${onlineDurationMin}m`} online
                      </span>
                    )}
                  </div>
                  {!isFrei && d.stopsTotal > 0 && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-blue-400 rounded-full transition-all duration-700"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-muted-foreground tabular-nums shrink-0">
                        {d.stopsDelivered}/{d.stopsTotal}
                      </span>
                    </div>
                  )}
                </div>

                {/* ETA Badge */}
                <AvailabilityBadge returnInMin={returnMin} isFrei={isFrei} />
              </div>

              {/* Nächste-Zuweisung Hinweis */}
              {isFrei && (
                <div className="mt-1.5 flex items-center gap-1 text-[9px] text-matcha-600 font-bold">
                  <Zap className="h-2.5 w-2.5" />
                  Bereit für neue Tour
                </div>
              )}
              {!isFrei && returnMin != null && returnMin <= 10 && (
                <div className="mt-1.5 flex items-center gap-1 text-[9px] text-amber-600 font-bold">
                  <MapPin className="h-2.5 w-2.5" />
                  Kommt bald zurück — nächste Tour vorplanen!
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Zusammenfassung */}
      <div className="flex items-center justify-between text-[9px] text-muted-foreground pt-1 border-t">
        <span className="flex items-center gap-1">
          <User className="h-2.5 w-2.5" />
          {drivers.length} Fahrer online
        </span>
        <span className="flex items-center gap-1">
          <Package className="h-2.5 w-2.5" />
          {drivers.reduce((s, d) => s + (d.stopsTotal - d.stopsDelivered), 0)} offene Stopps
        </span>
      </div>
    </div>
  );
}

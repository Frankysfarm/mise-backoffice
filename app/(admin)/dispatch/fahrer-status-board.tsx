'use client';

import { useMemo, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Phone, Bike, Clock, CheckCircle2, MapPin, Zap, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type Driver = {
  employee_id: string;
  ist_online: boolean;
  fahrzeug: string;
  aktueller_batch_id: string | null;
  last_update: string | null;
  employee: { id: string; vorname: string; nachname: string; telefon: string | null } | null;
};

type Batch = {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  total_eta_min: number | null;
  stops: {
    id: string;
    order_id: string;
    reihenfolge: number;
    geliefert_am: string | null;
    order: { bestellnummer: string; kunde_adresse: string | null } | null;
  }[];
};

function useTick() {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT((n) => n + 1), 30_000);
    return () => clearInterval(iv);
  }, []);
}

export function DispatchFahrerStatusBoard({
  drivers,
  batches,
}: {
  drivers: Driver[];
  batches: Batch[];
}) {
  useTick();
  const now = Date.now();

  const onlineDrivers = useMemo(
    () => drivers.filter((d) => d.ist_online),
    [drivers],
  );

  const rows = useMemo(() => {
    return onlineDrivers.map((driver) => {
      const batch = driver.aktueller_batch_id
        ? batches.find((b) => b.id === driver.aktueller_batch_id)
        : null;

      let status: 'frei' | 'unterwegs' | 'zurueck' = 'frei';
      let remainMin: number | null = null;
      let stopsLeft = 0;
      let stopsTotal = 0;
      let nextAddress: string | null = null;

      if (batch) {
        stopsTotal = batch.stops.length;
        stopsLeft = batch.stops.filter((s) => !s.geliefert_am).length;

        if (batch.status === 'unterwegs' || batch.status === 'on_route') {
          status = stopsLeft > 0 ? 'unterwegs' : 'zurueck';
          if (batch.startzeit && batch.total_eta_min != null) {
            const eta = new Date(batch.startzeit).getTime() + batch.total_eta_min * 60_000;
            remainMin = Math.max(0, Math.round((eta - now) / 60_000));
          }
          const nextStop = batch.stops
            .filter((s) => !s.geliefert_am)
            .sort((a, b) => a.reihenfolge - b.reihenfolge)[0];
          nextAddress = nextStop?.order?.kunde_adresse ?? null;
        } else if (batch.status === 'bereit' || batch.status === 'pending') {
          status = 'frei';
        }
      }

      return { driver, status, remainMin, stopsLeft, stopsTotal, nextAddress, batch };
    }).sort((a, b) => {
      const order = { unterwegs: 0, zurueck: 1, frei: 2 };
      return order[a.status] - order[b.status];
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlineDrivers, batches, now]);

  if (onlineDrivers.length === 0) return null;

  const statusStyle = {
    frei:      { bg: 'bg-matcha-50 border-matcha-200',  badge: 'bg-matcha-500 text-white',      label: 'Frei',       dot: 'bg-matcha-500' },
    unterwegs: { bg: 'bg-blue-50 border-blue-200',       badge: 'bg-blue-500 text-white',        label: 'Unterwegs',  dot: 'bg-blue-500'   },
    zurueck:   { bg: 'bg-amber-50 border-amber-200',     badge: 'bg-amber-400 text-white',       label: 'Rückkehr',   dot: 'bg-amber-500'  },
  };

  const freeCount = rows.filter((r) => r.status === 'frei').length;
  const busyCount = rows.filter((r) => r.status !== 'frei').length;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <Users className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Fahrer-Status
        </span>
        <Badge variant="secondary" className="bg-matcha-100 text-matcha-800 ml-1">
          {freeCount} frei
        </Badge>
        {busyCount > 0 && (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            {busyCount} unterwegs
          </Badge>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">
          {onlineDrivers.length} online
        </span>
      </div>

      <div className="divide-y">
        {rows.map(({ driver, status, remainMin, stopsLeft, stopsTotal, nextAddress }) => {
          const s = statusStyle[status];
          const name = driver.employee ? `${driver.employee.vorname} ${driver.employee.nachname}` : driver.employee_id.slice(0, 8);
          const phone = driver.employee?.telefon;

          return (
            <div key={driver.employee_id} className={cn('flex items-start gap-3 px-4 py-3', s.bg)}>
              {/* Status dot */}
              <div className={cn('mt-1 h-2.5 w-2.5 rounded-full shrink-0 ring-2 ring-white', s.dot)} />

              {/* Driver info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-foreground truncate">{name}</span>
                  <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-black', s.badge)}>
                    {s.label}
                  </span>
                  {driver.fahrzeug && (
                    <span className="text-[9px] rounded-full border bg-white/60 px-1.5 py-0.5 font-semibold uppercase">
                      {driver.fahrzeug}
                    </span>
                  )}
                </div>

                {status === 'unterwegs' && stopsTotal > 0 && (
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Bike className="h-3 w-3 shrink-0" />
                      {stopsLeft} von {stopsTotal} Stopps verbleibend
                    </span>
                    {remainMin !== null && (
                      <span className={cn('flex items-center gap-1 text-[11px] font-bold',
                        remainMin <= 5 ? 'text-red-600' : remainMin <= 15 ? 'text-amber-600' : 'text-matcha-600',
                      )}>
                        <Clock className="h-3 w-3 shrink-0" />
                        ~{remainMin} Min
                      </span>
                    )}
                  </div>
                )}

                {status === 'zurueck' && (
                  <div className="flex items-center gap-1 mt-1 text-[11px] text-amber-600 font-bold">
                    <CheckCircle2 className="h-3 w-3 shrink-0" />
                    Alle Stopps erledigt · Rückkehr
                    {remainMin !== null && ` in ~${remainMin} Min`}
                  </div>
                )}

                {status === 'frei' && (
                  <div className="flex items-center gap-1 mt-1 text-[11px] text-matcha-600 font-semibold">
                    <Zap className="h-3 w-3 shrink-0" />
                    Bereit für nächste Tour
                  </div>
                )}

                {nextAddress && (
                  <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground truncate">
                    <MapPin className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate">{nextAddress}</span>
                  </div>
                )}
              </div>

              {/* Phone button */}
              {phone && (
                <a
                  href={`tel:${phone}`}
                  className="shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-white border border-border text-matcha-700 hover:bg-matcha-50 transition"
                  title={`${name} anrufen`}
                >
                  <Phone className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

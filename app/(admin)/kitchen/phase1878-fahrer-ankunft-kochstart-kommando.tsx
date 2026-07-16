'use client';

/**
 * Phase 1878 — Fahrer-Ankunft-Kochstart-Kommando
 * Zeigt für jede aktive Tour: Fahrername, verbleibende Minuten bis Rückkehr
 * und empfiehlt konkret, welche wartenden Bestellungen JETZT gestartet werden sollen.
 * Polling alle 30 s gegen /api/delivery/tours.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, ChefHat, Clock, AlertTriangle, CheckCircle2, Loader2, Zap } from 'lucide-react';

type Stop = {
  id: string;
  sequence: number;
  geliefert_am: string | null;
};

type Batch = {
  id: string;
  state: string;
  total_eta_min: number | null;
  startzeit?: string | null;
  started_at?: string | null;
  driver: { id: string; name: string; vehicle: string | null } | null;
  stops: Stop[];
};

type WaitingOrder = {
  id: string;
  bestellnummer: string;
  geschaetzte_zubereitung_min: number | null;
};

type Row = {
  batch: Batch;
  driverName: string;
  returnInMin: number | null;
  startNow: boolean;
  minutesAhead: number | null;
};

export function KitchenPhase1878FahrerAnkunftKochstartKommando({
  locationId,
  waitingOrders,
}: {
  locationId: string | null;
  waitingOrders: WaitingOrder[];
}) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) return;

    const load = () => {
      setLoading(true);
      fetch(`/api/delivery/tours?location_id=${locationId}&state=active`, { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .then(d => {
          if (Array.isArray(d?.batches)) setBatches(d.batches);
          else if (Array.isArray(d)) setBatches(d);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    };

    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const now = Date.now();
  const avgPrepMin =
    waitingOrders.length > 0
      ? waitingOrders.reduce((s, o) => s + (o.geschaetzte_zubereitung_min ?? 15), 0) /
        waitingOrders.length
      : 15;

  const rows: Row[] = batches
    .filter(b => b.state !== 'delivered' && b.state !== 'cancelled')
    .map(b => {
      const startMs = b.started_at
        ? new Date(b.started_at).getTime()
        : b.startzeit
          ? new Date(b.startzeit).getTime()
          : null;
      const etaMin = b.total_eta_min ?? null;
      const elapsedMin = startMs ? (now - startMs) / 60_000 : 0;
      const returnInMin = etaMin !== null ? Math.max(0, etaMin - elapsedMin) : null;
      const minutesAhead = returnInMin !== null ? returnInMin - avgPrepMin : null;
      const startNow = minutesAhead !== null && minutesAhead <= 2;

      return {
        batch: b,
        driverName: b.driver
          ? b.driver.name
          : 'Fahrer',
        returnInMin: returnInMin !== null ? Math.round(returnInMin) : null,
        startNow,
        minutesAhead: minutesAhead !== null ? Math.round(minutesAhead) : null,
      };
    })
    .sort((a, b) => (a.returnInMin ?? 999) - (b.returnInMin ?? 999));

  if (!locationId || (rows.length === 0 && !loading)) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
        <Zap className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">
          Kochstart-Synchronisation · Fahrer-Rückkehr
        </span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />}
      </div>

      {/* Rows */}
      <div className="divide-y">
        {rows.map(row => {
          const urgent = row.startNow;
          const tight = !urgent && row.minutesAhead !== null && row.minutesAhead <= 5;
          const bg = urgent
            ? 'bg-red-50 dark:bg-red-950/30'
            : tight
              ? 'bg-amber-50 dark:bg-amber-950/30'
              : 'bg-matcha-50/50 dark:bg-matcha-950/20';

          return (
            <div key={row.batch.id} className={cn('flex items-center gap-3 px-4 py-3', bg)}>
              {/* Icon */}
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                  urgent
                    ? 'bg-red-500 text-white animate-pulse'
                    : tight
                      ? 'bg-amber-400 text-white'
                      : 'bg-matcha-500 text-white',
                )}
              >
                {urgent ? (
                  <ChefHat className="h-4 w-4" />
                ) : (
                  <Bike className="h-4 w-4" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold truncate">{row.driverName}</span>
                  {row.returnInMin !== null && (
                    <span
                      className={cn(
                        'text-xs font-bold tabular-nums',
                        urgent
                          ? 'text-red-600'
                          : tight
                            ? 'text-amber-600'
                            : 'text-matcha-600',
                      )}
                    >
                      ~{row.returnInMin} Min bis Rückkehr
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-[11px] text-muted-foreground">
                    Ø Zubereitung: {Math.round(avgPrepMin)} Min
                    {row.minutesAhead !== null && (
                      <> ·{' '}
                        <span
                          className={cn(
                            'font-bold',
                            urgent ? 'text-red-600' : tight ? 'text-amber-600' : 'text-matcha-600',
                          )}
                        >
                          {row.minutesAhead >= 0
                            ? `+${row.minutesAhead} Min Vorlauf`
                            : `${row.minutesAhead} Min Nachzügler`}
                        </span>
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Action Badge */}
              <div className="shrink-0">
                {urgent ? (
                  <div className="flex items-center gap-1 rounded-lg bg-red-500 px-2.5 py-1 text-white text-[11px] font-black">
                    <AlertTriangle className="h-3 w-3" />
                    JETZT KOCHEN
                  </div>
                ) : tight ? (
                  <div className="flex items-center gap-1 rounded-lg bg-amber-400 px-2.5 py-1 text-white text-[11px] font-bold">
                    <ChefHat className="h-3 w-3" />
                    Bald starten
                  </div>
                ) : (
                  <div className="flex items-center gap-1 rounded-lg bg-matcha-100 dark:bg-matcha-900/50 px-2.5 py-1 text-matcha-700 dark:text-matcha-300 text-[11px] font-bold">
                    <CheckCircle2 className="h-3 w-3" />
                    Pünktlich
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Wartende Bestellungen Footer */}
      {waitingOrders.length > 0 && (
        <div className="border-t px-4 py-2 flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">
            {waitingOrders.length} wartende Bestellung{waitingOrders.length !== 1 ? 'en' : ''} ·
            Ø Prep {Math.round(avgPrepMin)} Min
          </span>
        </div>
      )}
    </div>
  );
}

'use client';

import { cn } from '@/lib/utils';
import { AlertTriangle, Bike, CheckCircle2 } from 'lucide-react';

type Driver = {
  id: string;
  status: {
    ist_online: boolean;
    aktueller_batch_id: string | null;
  } | null;
};

interface Props {
  drivers: Driver[];
  pendingOrders: number;
}

export function DriverDeckungslücke({ drivers, pendingOrders }: Props) {
  const onlineDrivers = drivers.filter((d) => d.status?.ist_online === true);
  const freeDrivers   = onlineDrivers.filter((d) => !d.status?.aktueller_batch_id);
  const busyDrivers   = onlineDrivers.filter((d) =>  d.status?.aktueller_batch_id);

  const freeCount  = freeDrivers.length;
  const busyCount  = busyDrivers.length;
  const totalCount = onlineDrivers.length;

  const freePct = totalCount > 0 ? (freeCount / totalCount) * 100 : 0;
  const busyPct = totalCount > 0 ? (busyCount / totalCount) * 100 : 0;

  const deckungOk    = freeCount >= pendingOrders && pendingOrders > 0;
  const keineFahrer  = freeCount === 0 && pendingOrders > 0;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
        <Bike className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="font-display text-xs font-bold uppercase tracking-wider">Fahrer-Deckung</span>
        <span className="ml-auto text-[10px] font-bold text-muted-foreground">
          {totalCount} online
        </span>
      </div>

      <div className="p-3 space-y-3">
        {/* Alert-Banner */}
        {keineFahrer && (
          <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            <span className="text-xs font-black text-red-800">
              Keine freien Fahrer!{' '}
              <span className="tabular-nums">{pendingOrders}</span>{' '}
              {pendingOrders === 1 ? 'Bestellung wartet' : 'Bestellungen warten'}
            </span>
          </div>
        )}

        {deckungOk && (
          <div className="flex items-center gap-2 rounded-lg border border-matcha-300 bg-matcha-50 px-3 py-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-matcha-600" />
            <span className="text-xs font-black text-matcha-800">Deckung OK</span>
          </div>
        )}

        {/* Fahrer-Zahlen */}
        <div className="grid grid-cols-2 gap-2">
          <div className={cn(
            'rounded-lg border px-3 py-2 text-center',
            freeCount === 0 && pendingOrders > 0
              ? 'border-red-200 bg-red-50'
              : freeCount > 0
              ? 'border-matcha-200 bg-matcha-50'
              : 'border-border bg-muted/30',
          )}>
            <div className={cn(
              'font-display text-2xl font-black tabular-nums leading-none',
              freeCount === 0 && pendingOrders > 0
                ? 'text-red-700'
                : freeCount > 0
                ? 'text-matcha-700'
                : 'text-muted-foreground',
            )}>
              {freeCount}
            </div>
            <div className="mt-0.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
              Frei
            </div>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-center">
            <div className="font-display text-2xl font-black tabular-nums leading-none text-blue-700">
              {busyCount}
            </div>
            <div className="mt-0.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
              Unterwegs
            </div>
          </div>
        </div>

        {/* Balken frei vs. unterwegs */}
        {totalCount > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>Frei / Unterwegs</span>
              <span className="tabular-nums">{totalCount} gesamt</span>
            </div>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
              {freePct > 0 && (
                <div
                  className="bg-matcha-500 transition-all duration-700"
                  style={{ width: `${freePct}%` }}
                />
              )}
              {busyPct > 0 && (
                <div
                  className="bg-blue-400 transition-all duration-700"
                  style={{ width: `${busyPct}%` }}
                />
              )}
            </div>
            <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-matcha-500" />
                Frei
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400" />
                Unterwegs
              </span>
            </div>
          </div>
        )}

        {/* Ausstehende Bestellungen */}
        {pendingOrders > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-1.5">
            <span className="text-[10px] text-muted-foreground">Wartende Bestellungen</span>
            <span className={cn(
              'text-sm font-black tabular-nums',
              keineFahrer ? 'text-red-600' : 'text-foreground',
            )}>
              {pendingOrders}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

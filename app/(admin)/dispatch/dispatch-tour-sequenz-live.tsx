'use client';

/**
 * DispatchTourSequenzLive — Echtzeit-Tour-Sequenz-Übersicht
 *
 * Zeigt alle aktiven Touren mit:
 *  - Fahrername + Fahrzeug
 *  - Stop-Sequenz als horizontale Kette (1→2→3)
 *  - Farbkodierung: geliefert (grün) / unterwegs (blau/puls) / ausstehend (grau)
 *  - ETA-Gesamt + verbleibende Stops
 *  - Score-Badge je Bestellung (wenn vorhanden)
 *
 * Kein API-Call — nutzt Batch/Stop/Driver-Props direkt.
 */

import { cn } from '@/lib/utils';
import { Bike, Car, Check, Clock, MapPin, Package, Route } from 'lucide-react';

type Stop = {
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

type Driver = {
  employee_id: string;
  ist_online: boolean;
  fahrzeug: string;
  aktueller_batch_id: string | null;
  employee: { id: string; vorname: string; nachname: string } | null;
};

function formatEtaMin(isoStr: string | null): string {
  if (!isoStr) return '–';
  const mins = Math.round((new Date(isoStr).getTime() - Date.now()) / 60_000);
  if (mins < 0) return `+${Math.abs(mins)}m überfällig`;
  if (mins < 60) return `${mins} Min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function vehicleIcon(fahrzeug: string) {
  return fahrzeug === 'auto' ? (
    <Car className="h-3.5 w-3.5" />
  ) : (
    <Bike className="h-3.5 w-3.5" />
  );
}

function StopBadge({ stop, index, isCurrent }: { stop: Stop; index: number; isCurrent: boolean }) {
  const done = !!stop.geliefert_am;
  const order = stop.order;

  const etaMin = order?.eta_latest ? formatEtaMin(order.eta_latest) : null;
  const nr = order?.bestellnummer?.replace('FF-', '').slice(-4) ?? `#${index + 1}`;

  return (
    <div
      className={cn(
        'relative flex flex-col items-center gap-1',
        done ? 'opacity-60' : '',
      )}
    >
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 font-mono text-[11px] font-black transition-all',
          done
            ? 'border-matcha-400 bg-matcha-100 text-matcha-700'
            : isCurrent
            ? 'border-blue-500 bg-blue-500 text-white shadow-lg shadow-blue-500/30 animate-pulse'
            : 'border-stone-300 bg-white text-stone-700',
        )}
        title={order ? `${order.kunde_name}\n${order.kunde_adresse ?? ''}` : `Stop ${index + 1}`}
      >
        {done ? <Check className="h-4 w-4" /> : nr}
      </div>
      {etaMin && !done && (
        <span className={cn('text-[9px] tabular-nums font-bold leading-none whitespace-nowrap', isCurrent ? 'text-blue-600' : 'text-stone-500')}>
          {etaMin}
        </span>
      )}
      {done && (
        <span className="text-[9px] text-matcha-600 font-bold leading-none whitespace-nowrap">✓ fertig</span>
      )}
    </div>
  );
}

function TourRow({ batch, driver }: { batch: Batch; driver: Driver | undefined }) {
  const sortedStops = [...batch.stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const doneCount = sortedStops.filter((s) => !!s.geliefert_am).length;
  const totalCount = sortedStops.length;
  const currentIdx = doneCount < totalCount ? doneCount : totalCount - 1;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const driverName = batch.fahrer
    ? `${batch.fahrer.vorname} ${batch.fahrer.nachname}`
    : driver?.employee
    ? `${driver.employee.vorname} ${driver.employee.nachname}`
    : 'Unbekannt';

  const vehicleType = driver?.fahrzeug ?? 'fahrrad';

  const startedMin = batch.startzeit
    ? Math.round((Date.now() - new Date(batch.startzeit).getTime()) / 60_000)
    : null;

  const statusColor =
    batch.status === 'unterwegs'
      ? 'text-blue-600'
      : batch.status === 'pickup' || batch.status === 'at_restaurant'
      ? 'text-amber-600'
      : 'text-matcha-600';

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      {/* Tour-Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-stone-50 border-b border-stone-100">
        <div className={cn('flex items-center gap-1.5 font-bold text-sm', statusColor)}>
          {vehicleIcon(vehicleType)}
          <span>{driverName}</span>
        </div>
        <div className="flex items-center gap-1.5 ml-2">
          <Route className="h-3.5 w-3.5 text-stone-400" />
          <span className="text-[11px] text-stone-500 tabular-nums">
            {doneCount}/{totalCount} Stops
          </span>
        </div>
        {batch.total_eta_min != null && (
          <div className="flex items-center gap-1 text-[11px] text-stone-500">
            <Clock className="h-3 w-3" />
            <span className="tabular-nums">{batch.total_eta_min} Min gesamt</span>
          </div>
        )}
        {batch.zone && (
          <span className="ml-auto rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-bold text-stone-600">
            {batch.zone}
          </span>
        )}
        {startedMin != null && (
          <span className="text-[10px] text-stone-400 tabular-nums">
            vor {startedMin} Min gestartet
          </span>
        )}
      </div>

      {/* Progress Bar */}
      <div className="h-1 bg-stone-100">
        <div
          className="h-full bg-matcha-500 transition-all duration-700"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Stop Sequence */}
      <div className="flex items-start gap-0 px-4 py-3 overflow-x-auto scrollbar-none">
        {sortedStops.map((stop, idx) => (
          <div key={stop.id} className="flex items-center">
            <StopBadge
              stop={stop}
              index={idx}
              isCurrent={idx === currentIdx && doneCount < totalCount}
            />
            {idx < sortedStops.length - 1 && (
              <div
                className={cn(
                  'h-0.5 w-8 shrink-0 mx-1',
                  idx < doneCount ? 'bg-matcha-400' : 'bg-stone-200',
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DispatchTourSequenzLive({
  batches,
  drivers,
}: {
  batches: Batch[];
  drivers: Driver[];
}) {
  const activeBatches = batches.filter((b) =>
    ['unterwegs', 'pickup', 'aktiv', 'at_restaurant', 'on_route', 'assigned'].includes(b.status)
  );

  if (activeBatches.length === 0) return null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-200 bg-white">
        <Package className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="font-display text-sm font-bold uppercase tracking-wider text-stone-800">
          Tour-Sequenz Live
        </span>
        <span className="ml-1 rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
          {activeBatches.length} aktiv
        </span>
        <div className="ml-auto flex items-center gap-2 text-[11px] text-stone-500">
          <MapPin className="h-3.5 w-3.5" />
          <span>Stop-für-Stop Echtzeit-Tracking</span>
        </div>
      </div>

      {/* Tour Rows */}
      <div className="p-3 space-y-3">
        {activeBatches.map((batch) => {
          const driver = drivers.find((d) => d.employee_id === batch.fahrer_id);
          return <TourRow key={batch.id} batch={batch} driver={driver} />;
        })}
      </div>
    </div>
  );
}

'use client';

/**
 * TourEtaStrip — Kompakter Live-Überblick aller aktiven Touren mit ETA-Countdown.
 * Zeigt jeden Fahrer als Chip: Name, aktueller Stopp, verbleibende Zeit, Farbampel.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, Car, Clock, MapPin, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

type Batch = {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  total_distance_km: number | null;
  total_eta_min: number | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: {
    id: string;
    order_id: string;
    reihenfolge: number;
    geliefert_am: string | null;
    order: { bestellnummer: string; kunde_name: string; kunde_adresse: string | null; eta_earliest: string | null; eta_latest: string | null } | null;
  }[];
};

type Driver = {
  employee_id: string;
  ist_online: boolean;
  fahrzeug: string;
  aktueller_batch_id: string | null;
  employee: { id: string; vorname: string; nachname: string; avatar_url: string | null; telefon: string | null } | null;
};

function useTick() {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT(n => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
}

function fmtCountdown(ms: number): { label: string; level: 'ok' | 'warn' | 'critical' | 'late' } {
  if (ms < -5 * 60_000) return { label: `${Math.floor(-ms / 60_000)} Min überfällig`, level: 'late' };
  if (ms < 0) return { label: 'Jetzt', level: 'critical' };
  const secs = Math.floor(ms / 1000);
  const min = Math.floor(secs / 60);
  const sec = secs % 60;
  const level = min < 5 ? 'critical' : min < 15 ? 'warn' : 'ok';
  return { label: `${min}:${String(sec).padStart(2, '0')}`, level };
}

type TourChip = {
  batchId: string;
  driverName: string;
  vehicle: string;
  completedStops: number;
  totalStops: number;
  etaMs: number | null;
  zone: string | null;
  nextCustomer: string | null;
  status: string;
};

function TourChip({ chip }: { chip: TourChip }) {
  useTick();
  const ctd = chip.etaMs != null ? fmtCountdown(chip.etaMs - Date.now()) : null;
  const pct = chip.totalStops > 0 ? (chip.completedStops / chip.totalStops) * 100 : 0;

  const borderCls = !ctd ? 'border-blue-300 bg-blue-50' :
    ctd.level === 'late' ? 'border-red-400 bg-red-50 animate-pulse' :
    ctd.level === 'critical' ? 'border-orange-400 bg-orange-50' :
    ctd.level === 'warn' ? 'border-amber-300 bg-amber-50' :
    'border-matcha-300 bg-matcha-50';

  const timerCls = !ctd ? 'text-blue-600' :
    ctd.level === 'late' ? 'text-red-700 font-black' :
    ctd.level === 'critical' ? 'text-orange-700 font-black' :
    ctd.level === 'warn' ? 'text-amber-700' :
    'text-matcha-700';

  return (
    <div className={cn('rounded-xl border px-3 py-2 min-w-[160px] max-w-[220px] flex-shrink-0 space-y-1.5', borderCls)}>
      {/* Driver header */}
      <div className="flex items-center gap-1.5">
        {chip.vehicle === 'car' ? <Car className="h-3.5 w-3.5 text-muted-foreground" /> : <Bike className="h-3.5 w-3.5 text-muted-foreground" />}
        <span className="text-xs font-bold text-foreground truncate flex-1">{chip.driverName}</span>
        {chip.zone && (
          <span className="text-[9px] font-bold rounded-full bg-black/8 px-1.5 py-0.5 text-muted-foreground">Z{chip.zone}</span>
        )}
      </div>

      {/* Progress bar */}
      <div className="relative h-1.5 rounded-full bg-black/10 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', pct >= 100 ? 'bg-matcha-500' : 'bg-matcha-400')}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Stop count + ETA */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          {chip.completedStops}/{chip.totalStops} Stopps
        </span>
        {ctd ? (
          <span className={cn('text-[11px] tabular-nums font-bold', timerCls)}>
            {ctd.level === 'late' ? <AlertTriangle className="inline h-3 w-3 mr-0.5" /> : <Clock className="inline h-3 w-3 mr-0.5" />}
            {ctd.label}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground">Keine ETA</span>
        )}
      </div>

      {/* Next customer */}
      {chip.nextCustomer && chip.completedStops < chip.totalStops && (
        <div className="flex items-center gap-1 text-[9px] text-muted-foreground truncate">
          <MapPin className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">{chip.nextCustomer}</span>
        </div>
      )}
    </div>
  );
}

export function TourEtaStrip({
  batches,
  drivers,
}: {
  batches: Batch[];
  drivers: Driver[];
}) {
  const ACTIVE = new Set(['pickup', 'unterwegs', 'pending_acceptance', 'assigned', 'at_restaurant', 'on_route']);
  const activeBatches = batches.filter(b => ACTIVE.has(b.status));
  if (activeBatches.length === 0) return null;

  const chips: TourChip[] = activeBatches.map(b => {
    const driver = drivers.find(d => d.employee_id === b.fahrer_id);
    const driverName = b.fahrer
      ? `${b.fahrer.vorname} ${b.fahrer.nachname[0]}.`
      : driver?.employee
        ? `${driver.employee.vorname} ${driver.employee.nachname[0]}.`
        : 'Fahrer';
    const sortedStops = [...(b.stops ?? [])].sort((a, b) => a.reihenfolge - b.reihenfolge);
    const completedStops = sortedStops.filter(s => !!s.geliefert_am).length;
    const nextStop = sortedStops.find(s => !s.geliefert_am);
    const etaMs = b.startzeit && b.total_eta_min != null
      ? new Date(b.startzeit).getTime() + b.total_eta_min * 60_000
      : null;

    return {
      batchId: b.id,
      driverName,
      vehicle: driver?.fahrzeug ?? 'bike',
      completedStops,
      totalStops: sortedStops.length,
      etaMs,
      zone: b.zone,
      nextCustomer: nextStop?.order?.kunde_name ?? null,
      status: b.status,
    };
  });

  // Sort: most urgent first (lowest ETA remaining)
  chips.sort((a, b) => {
    if (a.etaMs == null && b.etaMs == null) return 0;
    if (a.etaMs == null) return 1;
    if (b.etaMs == null) return -1;
    return a.etaMs - b.etaMs;
  });

  return (
    <div className="rounded-xl border border-matcha-200 bg-matcha-50/40 px-4 py-3">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-[10px] font-black uppercase tracking-widest text-matcha-600">
          Live-Touren · {activeBatches.length} aktiv
        </span>
        <div className="flex-1 h-px bg-matcha-200" />
        <span className="text-[9px] text-muted-foreground">ETA-Countdown</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {chips.map(chip => (
          <TourChip key={chip.batchId} chip={chip} />
        ))}
      </div>
    </div>
  );
}

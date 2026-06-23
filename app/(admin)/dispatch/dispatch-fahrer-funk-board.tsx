'use client';

/**
 * DispatchFahrerFunkBoard — Schnell-Kommunikation mit allen aktiven Fahrern.
 *
 * Zeigt alle Online-Fahrer als kompakte Kacheln:
 *   Name · Fahrzeug · Letzte GPS-Aktualisierung · Schicht-Dauer
 * + Schnell-Aktionen: Anruf · Tour-Status-Badge
 *
 * Hilft dem Dispatcher in Echtzeit zu sehen, welche Fahrer erreichbar sind.
 * Kein API-Aufruf nötig — nutzt übergebene Driver-Daten aus DispatchBoard.
 */

import { useState } from 'react';
import { Phone, Bike, Car, Clock, Wifi, WifiOff, ChevronDown, ChevronUp, Radio, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

type DispatchDriver = {
  employee_id: string;
  ist_online: boolean;
  fahrzeug: string;
  aktueller_batch_id: string | null;
  last_lat: number | null;
  last_lng: number | null;
  last_update: string | null;
  online_seit: string | null;
  employee: { id: string; vorname: string; nachname: string; avatar_url: string | null; telefon: string | null } | null;
};

type DispatchBatch = {
  id: string;
  fahrer_id: string | null;
  status: string;
  startzeit?: string | null;
  total_eta_min: number | null;
};

function minsAgo(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
}

function shiftDurationMin(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
}

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const BATCH_STATUS_LABEL: Record<string, string> = {
  unterwegs: 'Unterwegs',
  on_route: 'On Route',
  gestartet: 'Gestartet',
  pickup: 'Abholung',
  aktiv: 'Aktiv',
  zugewiesen: 'Zugewiesen',
  abgeschlossen: 'Abgeschlossen',
};

export function DispatchFahrerFunkBoard({
  drivers,
  batches,
}: {
  drivers: DispatchDriver[];
  batches: DispatchBatch[];
}) {
  const [open, setOpen] = useState(false);

  const online = drivers.filter((d) => d.ist_online);
  const offline = drivers.filter((d) => !d.ist_online);

  if (drivers.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-muted/40 transition"
      >
        <Radio className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="font-display text-xs font-black uppercase tracking-wider text-foreground flex-1 text-left">
          Fahrer-Funk
        </span>
        <span className="rounded-full bg-matcha-100 text-matcha-700 px-2 py-0.5 text-[10px] font-bold">
          {online.length} online
        </span>
        {offline.length > 0 && (
          <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-medium">
            {offline.length} offline
          </span>
        )}
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {open && (
        <div className="border-t divide-y">
          {/* Online Fahrer */}
          {online.map((d) => {
            const activeBatch = batches.find(
              (b) => b.fahrer_id === d.employee_id &&
              ['unterwegs', 'on_route', 'gestartet', 'pickup', 'aktiv'].includes(b.status),
            );
            const lastUpdate = minsAgo(d.last_update ?? null);
            const shiftMin = shiftDurationMin(d.online_seit ?? null);
            const hasGps = d.last_lat != null && d.last_lng != null;
            const isStale = lastUpdate !== null && lastUpdate > 5;

            return (
              <div key={d.employee_id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition">
                {/* Status-Dot */}
                <div className={cn(
                  'h-2.5 w-2.5 rounded-full shrink-0',
                  activeBatch ? 'bg-blue-500 animate-pulse' : 'bg-matcha-500',
                )} />

                {/* Name + Fahrzeug */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-bold text-foreground">
                      {d.employee?.vorname ?? '—'} {(d.employee?.nachname ?? '')[0]}.
                    </span>
                    <div className={cn(
                      'flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold',
                      activeBatch ? 'bg-blue-100 text-blue-700' : 'bg-matcha-100 text-matcha-700',
                    )}>
                      {d.fahrzeug === 'auto' ? (
                        <Car className="h-2.5 w-2.5" />
                      ) : (
                        <Bike className="h-2.5 w-2.5" />
                      )}
                      {d.fahrzeug ?? 'Rad'}
                    </div>
                    {activeBatch && (
                      <span className="rounded-full bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">
                        {BATCH_STATUS_LABEL[activeBatch.status] ?? activeBatch.status}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {shiftMin != null && (
                      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <Clock className="h-2.5 w-2.5" />
                        {fmtDuration(shiftMin)}
                      </span>
                    )}
                    {hasGps && (
                      <span className={cn(
                        'flex items-center gap-0.5 text-[10px]',
                        isStale ? 'text-amber-600' : 'text-matcha-600',
                      )}>
                        <MapPin className="h-2.5 w-2.5" />
                        {lastUpdate !== null ? (lastUpdate === 0 ? 'Jetzt' : `vor ${lastUpdate}m`) : 'GPS'}
                      </span>
                    )}
                    {!hasGps && (
                      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <WifiOff className="h-2.5 w-2.5" />
                        Kein GPS
                      </span>
                    )}
                  </div>
                </div>

                {/* Anruf-Button */}
                {d.employee?.telefon && (
                  <a
                    href={`tel:${d.employee.telefon}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-center h-8 w-8 rounded-full border border-matcha-300 bg-matcha-50 text-matcha-700 hover:bg-matcha-100 transition shrink-0"
                    title={`Anruf ${d.employee.vorname}`}
                  >
                    <Phone className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            );
          })}

          {/* Offline Fahrer */}
          {offline.length > 0 && (
            <div className="px-4 py-2 bg-muted/20">
              <div className="flex flex-wrap gap-2">
                {offline.map((d) => (
                  <div key={d.employee_id} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <WifiOff className="h-2.5 w-2.5" />
                    {d.employee?.vorname ?? '—'} {(d.employee?.nachname ?? '')[0]}.
                    {d.employee?.telefon && (
                      <a href={`tel:${d.employee.telefon}`} className="ml-0.5 text-blue-500 hover:underline">
                        <Phone className="h-2.5 w-2.5 inline" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Keine Fahrer online */}
          {online.length === 0 && (
            <div className="px-4 py-4 text-center text-sm text-muted-foreground">
              <Wifi className="h-5 w-5 mx-auto mb-1 text-muted-foreground/40" />
              Aktuell kein Fahrer online
            </div>
          )}
        </div>
      )}
    </div>
  );
}

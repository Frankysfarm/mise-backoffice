'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Check, ChevronDown, ChevronUp, Clock, MapPin, Navigation, Package, Phone,
} from 'lucide-react';

/**
 * Tour-Stopp-Navi-Panel (Fahrer)
 *
 * Zeigt alle Tour-Stopps mit:
 *  - Stopp-Nummer + Kundename + Adresse
 *  - Status (ausstehend / aktuell / erledigt)
 *  - Geschätzte Ankunftszeit
 *  - Quick-Navigation-Buttons (Google Maps / Apple Maps)
 *  - Telefon-Link
 * Mobile-first, Matcha-Theme.
 */

export interface TourStop {
  id: string;
  sequence: number | null;
  status: string;
  kunde_name?: string | null;
  adresse?: string | null;
  lat?: number | null;
  lng?: number | null;
  telefon?: string | null;
  estimated_arrival?: string | null;
  notizen?: string | null;
  order_id?: string | null;
  bestellnummer?: string | null;
}

function fmtTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function googleMapsUrl(adresse: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`;
}

function appleMapsUrl(adresse: string): string {
  return `http://maps.apple.com/?q=${encodeURIComponent(adresse)}`;
}

function wazeMapsUrl(lat: number, lng: number): string {
  return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; ring: string }> = {
  geliefert:    { label: 'Erledigt',   bg: 'bg-matcha-50 dark:bg-matcha-950/30',  text: 'text-matcha-600 dark:text-matcha-400', border: 'border-matcha-200 dark:border-matcha-800', ring: 'bg-matcha-500' },
  abgeschlossen:{ label: 'Erledigt',   bg: 'bg-matcha-50 dark:bg-matcha-950/30',  text: 'text-matcha-600 dark:text-matcha-400', border: 'border-matcha-200 dark:border-matcha-800', ring: 'bg-matcha-500' },
  unterwegs:    { label: 'Aktuell',    bg: 'bg-blue-50 dark:bg-blue-950/30',       text: 'text-blue-700 dark:text-blue-300',     border: 'border-blue-200 dark:border-blue-700',    ring: 'bg-blue-500 animate-pulse' },
  bereit:       { label: 'Nächster',   bg: 'bg-amber-50 dark:bg-amber-950/30',     text: 'text-amber-700 dark:text-amber-300',   border: 'border-amber-200 dark:border-amber-700',  ring: 'bg-amber-400' },
  neu:          { label: 'Ausstehend', bg: 'bg-card',                              text: 'text-muted-foreground',                border: 'border-border',                           ring: 'bg-muted-foreground/30' },
};

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG['neu'];
}

interface Props {
  stops: TourStop[];
  currentStopId?: string | null;
  className?: string;
}

export function TourStoppNaviPanel({ stops, currentStopId, className }: Props) {
  const [open, setOpen] = useState(true);

  const sorted = useMemo(
    () => [...stops].sort((a, b) => (a.sequence ?? 99) - (b.sequence ?? 99)),
    [stops],
  );

  const done   = sorted.filter((s) => s.status === 'geliefert' || s.status === 'abgeschlossen').length;
  const total  = sorted.length;
  const pct    = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 border-b hover:bg-muted/30 transition-colors active:bg-muted/50"
      >
        <Package className="h-4 w-4 shrink-0 text-matcha-600" />
        <span className="text-sm font-bold">Tour-Stopps</span>
        <span className="ml-1 rounded-full bg-matcha-100 dark:bg-matcha-900/40 text-matcha-700 dark:text-matcha-300 px-2 py-0.5 text-[10px] font-black">
          {done}/{total}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-matcha-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="divide-y">
          {sorted.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Keine Stopps in dieser Tour
            </div>
          )}

          {sorted.map((stop, idx) => {
            const isCurrent = stop.id === currentStopId || stop.status === 'unterwegs';
            const isDone    = stop.status === 'geliefert' || stop.status === 'abgeschlossen';
            const cfg       = getStatusConfig(stop.status);
            const arrTime   = fmtTime(stop.estimated_arrival);

            return (
              <div
                key={stop.id}
                className={cn(
                  'px-4 py-3 transition-colors',
                  cfg.bg,
                  isCurrent && 'border-l-4 border-l-blue-500',
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Sequence ring */}
                  <div className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white',
                    cfg.ring,
                    isDone ? 'bg-matcha-500' : '',
                  )}>
                    {isDone ? <Check className="h-3.5 w-3.5" /> : (stop.sequence ?? idx + 1)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Name + status badge */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('text-sm font-bold truncate', isDone && 'line-through text-muted-foreground')}>
                        {stop.kunde_name ?? `Stopp ${stop.sequence ?? idx + 1}`}
                      </span>
                      <span className={cn('rounded-full px-1.5 py-0.5 text-[8px] font-bold border', cfg.text, cfg.border)}>
                        {cfg.label}
                      </span>
                      {stop.bestellnummer && (
                        <span className="text-[9px] text-muted-foreground font-mono">
                          #{stop.bestellnummer.slice(-4)}
                        </span>
                      )}
                    </div>

                    {/* Address */}
                    {stop.adresse && (
                      <div className="flex items-start gap-1 mt-0.5">
                        <MapPin className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                        <span className={cn('text-xs text-muted-foreground leading-snug', isDone && 'line-through')}>
                          {stop.adresse}
                        </span>
                      </div>
                    )}

                    {/* ETA + notes */}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {arrTime && !isDone && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[10px] font-semibold text-foreground">ETA {arrTime}</span>
                        </div>
                      )}
                      {stop.notizen && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                          ⚠ {stop.notizen}
                        </span>
                      )}
                    </div>

                    {/* Navigation buttons — only for non-done stops */}
                    {!isDone && (stop.adresse || (stop.lat && stop.lng)) && (
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {stop.adresse && (
                          <a
                            href={googleMapsUrl(stop.adresse)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 px-2.5 py-1.5 text-[10px] font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-100 active:scale-95 transition-transform"
                          >
                            <Navigation className="h-3 w-3" />
                            Google Maps
                          </a>
                        )}
                        {stop.lat && stop.lng && (
                          <a
                            href={wazeMapsUrl(stop.lat, stop.lng)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 rounded-lg bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 px-2.5 py-1.5 text-[10px] font-bold text-teal-700 dark:text-teal-300 hover:bg-teal-100 active:scale-95 transition-transform"
                          >
                            <Navigation className="h-3 w-3" />
                            Waze
                          </a>
                        )}
                        {stop.adresse && (
                          <a
                            href={appleMapsUrl(stop.adresse)}
                            className="flex items-center gap-1 rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-[10px] font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 active:scale-95 transition-transform"
                          >
                            <Navigation className="h-3 w-3" />
                            Apple Maps
                          </a>
                        )}
                        {stop.telefon && (
                          <a
                            href={`tel:${stop.telefon}`}
                            className="flex items-center gap-1 rounded-lg bg-matcha-50 dark:bg-matcha-950/40 border border-matcha-200 dark:border-matcha-800 px-2.5 py-1.5 text-[10px] font-bold text-matcha-700 dark:text-matcha-300 hover:bg-matcha-100 active:scale-95 transition-transform"
                          >
                            <Phone className="h-3 w-3" />
                            Anrufen
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

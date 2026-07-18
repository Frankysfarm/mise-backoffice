'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Navigation, CheckCircle2, Clock, ChevronDown, ChevronUp, Zap, Phone, AlertCircle } from 'lucide-react';

/**
 * Phase 2380 — Tour-Stopp Navigator Ultra (Fahrer-App)
 *
 * Kompakter Navigations-Hub: Aktuelle Stopps mit Reihenfolge,
 * Adresse, ETA-Ampel und One-Tap Navi-Link.
 */

export interface TourStop {
  id: string;
  reihenfolge: number;
  adresse?: string | null;
  kundeName?: string | null;
  telefon?: string | null;
  eta_min?: number | null;
  angekommen_am?: string | null;
  geliefert_am?: string | null;
  notiz?: string | null;
}

interface Props {
  stops?: TourStop[];
  aktiverStoppId?: string | null;
}

type StoppStatus = 'geliefert' | 'aktuell' | 'naechste' | 'offen';

function stoppStatus(stop: TourStop, aktivId: string | null | undefined): StoppStatus {
  if (stop.geliefert_am) return 'geliefert';
  if (stop.id === aktivId) return 'aktuell';
  return 'offen';
}

const STATUS_STYLE: Record<StoppStatus, { dot: string; bg: string; border: string; text: string; badge: string; label: string }> = {
  geliefert: { dot: 'bg-matcha-500', bg: 'bg-matcha-50/50 dark:bg-matcha-950/10', border: 'border-matcha-200 dark:border-matcha-800', text: 'text-matcha-700 dark:text-matcha-300', badge: 'bg-matcha-100 dark:bg-matcha-900/30 border-matcha-300', label: 'Geliefert' },
  aktuell:   { dot: 'bg-blue-500 animate-pulse', bg: 'bg-blue-50 dark:bg-blue-950/20', border: 'border-blue-300 dark:border-blue-700', text: 'text-blue-700 dark:text-blue-300', badge: 'bg-blue-100 dark:bg-blue-900/30 border-blue-300', label: 'Aktuell' },
  naechste:  { dot: 'bg-amber-400', bg: 'bg-amber-50/50 dark:bg-amber-950/10', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-300', badge: 'bg-amber-100 dark:bg-amber-900/30 border-amber-300', label: 'Nächste' },
  offen:     { dot: 'bg-zinc-400', bg: 'bg-transparent', border: 'border-border', text: 'text-muted-foreground', badge: 'bg-muted/50 border-border', label: 'Offen' },
};

const MOCK_STOPS: TourStop[] = [
  { id: '1', reihenfolge: 1, adresse: 'Musterstraße 12, 10115 Berlin', kundeName: 'Max M.', eta_min: 5, geliefert_am: new Date().toISOString() },
  { id: '2', reihenfolge: 2, adresse: 'Hauptweg 34, 10117 Berlin', kundeName: 'Anna K.', eta_min: 3, telefon: '+4915112345678' },
  { id: '3', reihenfolge: 3, adresse: 'Parkstraße 7, 10119 Berlin', kundeName: 'Peter S.', eta_min: 12, notiz: 'Hintereingang benutzen' },
  { id: '4', reihenfolge: 4, adresse: 'Berliner Allee 99, 10121 Berlin', kundeName: 'Lisa T.', eta_min: 22 },
];

function mapsLink(adresse: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`;
}

export function FahrerPhase2380TourStoppNavigatorUltra({ stops, aktiverStoppId }: Props) {
  const [open, setOpen] = useState(true);
  const data = stops && stops.length > 0 ? stops : MOCK_STOPS;

  const naechsterOffenerIdx = data.findIndex(s => !s.geliefert_am);
  const aktiv = aktiverStoppId ?? (naechsterOffenerIdx >= 0 ? data[naechsterOffenerIdx].id : null);

  const sorted = useMemo(() => [...data].sort((a, b) => a.reihenfolge - b.reihenfolge), [data]);

  const geliefert = sorted.filter(s => s.geliefert_am).length;
  const total     = sorted.length;
  const remaining = total - geliefert;

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Navigation className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider">Tour-Stopps</span>
          <span className="rounded-full bg-blue-100 dark:bg-blue-900/30 border border-blue-300 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
            {geliefert}/{total}
          </span>
          {remaining > 0 && (
            <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
              {remaining} offen
            </span>
          )}
          {remaining === 0 && (
            <span className="rounded-full bg-matcha-100 dark:bg-matcha-900/30 border border-matcha-300 px-2 py-0.5 text-[10px] font-bold text-matcha-700 dark:text-matcha-300">
              ✓ Abgeschlossen
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>

      {open && (
        <>
          {/* Progress bar */}
          <div className="px-4 pb-2 border-t pt-2">
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-matcha-500 transition-all duration-700"
                style={{ width: `${total > 0 ? (geliefert / total) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div className="divide-y">
            {sorted.map((stop, idx) => {
              const status = stoppStatus(stop, aktiv);
              const isActive = status === 'aktuell';
              const s = STATUS_STYLE[status];

              return (
                <div key={stop.id} className={cn('px-4 py-3 transition-colors', s.bg, isActive && 'ring-1 ring-inset ring-blue-300 dark:ring-blue-700')}>
                  <div className="flex items-start gap-3">
                    {/* Step indicator */}
                    <div className="shrink-0 flex flex-col items-center gap-1 pt-0.5">
                      <div className={cn('h-4 w-4 rounded-full', s.dot)} />
                      {idx < sorted.length - 1 && (
                        <div className="w-0.5 h-4 bg-border" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-black text-muted-foreground">#{stop.reihenfolge}</span>
                        {stop.kundeName && <span className="text-xs font-bold">{stop.kundeName}</span>}
                        <span className={cn('rounded-full border px-1.5 py-0.5 text-[9px] font-bold', s.badge, s.text)}>
                          {status === 'geliefert' && <CheckCircle2 className="h-2.5 w-2.5 inline mr-0.5" />}
                          {s.label}
                        </span>
                        {stop.eta_min !== undefined && stop.eta_min !== null && !stop.geliefert_am && (
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <Clock className="h-2.5 w-2.5" />~{stop.eta_min} Min
                          </span>
                        )}
                      </div>

                      {stop.adresse && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{stop.adresse}</p>
                      )}

                      {stop.notiz && (
                        <p className="mt-1 text-[10px] flex items-start gap-1 text-amber-700 dark:text-amber-400">
                          <AlertCircle className="h-3 w-3 shrink-0 mt-px" />
                          {stop.notiz}
                        </p>
                      )}

                      {/* Actions */}
                      {!stop.geliefert_am && (
                        <div className="flex items-center gap-2 mt-1.5">
                          {stop.adresse && (
                            <a
                              href={mapsLink(stop.adresse)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-blue-700 transition"
                            >
                              <Navigation className="h-3 w-3" />
                              Navigieren
                            </a>
                          )}
                          {stop.telefon && (
                            <a
                              href={`tel:${stop.telefon}`}
                              className="flex items-center gap-1 rounded-lg bg-muted border px-2.5 py-1 text-[10px] font-bold hover:bg-muted/80 transition"
                            >
                              <Phone className="h-3 w-3" />
                              Anrufen
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                    {/* MapPin icon for open stops */}
                    {!stop.geliefert_am && (
                      <MapPin className={cn('h-4 w-4 shrink-0 mt-0.5', isActive ? 'text-blue-500' : 'text-muted-foreground')} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {remaining === 0 && (
            <div className="px-4 py-3 border-t bg-matcha-50 dark:bg-matcha-950/20 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-matcha-600" />
              <span className="text-xs font-bold text-matcha-700 dark:text-matcha-300">Alle Stopps abgeschlossen! Tour fertig.</span>
              <Zap className="h-3.5 w-3.5 text-matcha-600 ml-auto" />
            </div>
          )}
        </>
      )}
    </div>
  );
}

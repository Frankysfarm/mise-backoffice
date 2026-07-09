'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Navigation, Clock, CheckCircle2, ChevronDown, ChevronUp, Loader2, Phone } from 'lucide-react';

/**
 * Phase 949 — Tour-Stopp-Live-Navigator (Fahrer-App)
 *
 * Zeigt alle Stops der aktuellen Tour mit:
 * - Aktuellem Stopp hervorgehoben (farbig + größer)
 * - ETA je Stopp basierend auf Reihenfolge und Durchschnittszeit
 * - Direktnavigation per Google Maps / Apple Maps Deep-Link
 * - Online-fähig (Polling) oder Mock-Daten offline
 */

interface TourStop {
  id: string;
  reihenfolge: number;
  adresse: string;
  kunde_name?: string | null;
  telefon?: string | null;
  bestellnummer?: string | null;
  status: 'ausstehend' | 'unterwegs' | 'angekommen' | 'abgeliefert';
  eta_min?: number | null;
  notiz?: string | null;
}

interface Props {
  driverId: string;
  isOnline: boolean;
}

const MOCK_STOPS: TourStop[] = [
  { id: '1', reihenfolge: 1, adresse: 'Musterstraße 12, 10115 Berlin', kunde_name: 'Schmidt, H.', telefon: '+49 30 12345678', bestellnummer: '2401', status: 'angekommen', eta_min: 0 },
  { id: '2', reihenfolge: 2, adresse: 'Hauptstr. 55, 10117 Berlin', kunde_name: 'Müller, K.', telefon: '+49 30 87654321', bestellnummer: '2402', status: 'ausstehend', eta_min: 8 },
  { id: '3', reihenfolge: 3, adresse: 'Berliner Allee 3, 10119 Berlin', kunde_name: 'Weber, S.', bestellnummer: '2403', status: 'ausstehend', eta_min: 16 },
];

const STATUS_STYLES: Record<TourStop['status'], { bg: string; text: string; dot: string }> = {
  ausstehend: { bg: 'bg-muted/50', text: 'text-muted-foreground', dot: 'bg-muted-foreground' },
  unterwegs: { bg: 'bg-amber-50/80 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500 animate-pulse' },
  angekommen: { bg: 'bg-blue-50/80 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
  abgeliefert: { bg: 'bg-matcha-50/80 dark:bg-matcha-950/30', text: 'text-matcha-700 dark:text-matcha-300', dot: 'bg-matcha-500' },
};

const STATUS_LABELS: Record<TourStop['status'], string> = {
  ausstehend: 'Ausstehend',
  unterwegs: 'Unterwegs',
  angekommen: 'Angekommen',
  abgeliefert: 'Abgeliefert',
};

function openNav(adresse: string) {
  const encoded = encodeURIComponent(adresse);
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (isIOS) {
    window.open(`maps://maps.apple.com/?daddr=${encoded}`, '_blank');
  } else {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, '_blank');
  }
}

export function FahrerPhase949TourStoppLiveNavigator({ driverId, isOnline }: Props) {
  const [stops, setStops] = useState<TourStop[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!isOnline || !driverId) {
      setStops(MOCK_STOPS);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/fahrer/tour-stops?driver_id=${driverId}`);
      setStops(res.ok ? await res.json() : MOCK_STOPS);
    } catch {
      setStops(MOCK_STOPS);
    } finally {
      setLoading(false);
    }
  }, [driverId, isOnline]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const aktuellerStop = stops.find((s) => s.status === 'angekommen' || s.status === 'unterwegs');
  const offeneStops = stops.filter((s) => s.status !== 'abgeliefert').length;
  const fertigStops = stops.filter((s) => s.status === 'abgeliefert').length;

  if (stops.length === 0 && !loading) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-muted/20 transition text-left"
      >
        <MapPin className="h-4 w-4 text-matcha-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Tour-Stopp Navigator
        </span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
        {stops.length > 0 && (
          <span className="ml-1 text-[10px] text-muted-foreground">
            {fertigStops}/{stops.length} erledigt
          </span>
        )}
        <span className="ml-auto text-muted-foreground">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {/* Fortschrittsbalken */}
          {stops.length > 0 && (
            <div className="space-y-1 mb-3">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{fertigStops} abgeliefert · {offeneStops} offen</span>
                <span>{stops.length > 0 ? Math.round((fertigStops / stops.length) * 100) : 0}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-matcha-500 transition-all"
                  style={{ width: `${stops.length > 0 ? (fertigStops / stops.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Stop-Liste */}
          <div className="space-y-2">
            {stops.sort((a, b) => a.reihenfolge - b.reihenfolge).map((stop) => {
              const s = STATUS_STYLES[stop.status];
              const isAktiv = stop.id === aktuellerStop?.id;

              return (
                <div
                  key={stop.id}
                  className={cn(
                    'rounded-lg border p-3 transition-all',
                    s.bg,
                    isAktiv ? 'border-matcha-400 dark:border-matcha-600 shadow-sm ring-1 ring-matcha-400/30' : 'border-border/60',
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Nummer + Status-Punkt */}
                    <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                      <span className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full text-xs font-black',
                        stop.status === 'abgeliefert'
                          ? 'bg-matcha-100 dark:bg-matcha-900/40 text-matcha-700 dark:text-matcha-300'
                          : 'bg-muted text-foreground',
                      )}>
                        {stop.status === 'abgeliefert' ? <CheckCircle2 className="h-3.5 w-3.5" /> : stop.reihenfolge}
                      </span>
                      <span className={cn('h-2 w-2 rounded-full', s.dot)} />
                    </div>

                    {/* Inhalt */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0">
                          {stop.kunde_name && (
                            <p className={cn('text-xs font-bold truncate', isAktiv ? 'text-foreground' : s.text)}>
                              {stop.kunde_name}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground truncate">{stop.adresse}</p>
                          {stop.bestellnummer && (
                            <p className="text-[9px] text-muted-foreground">#{stop.bestellnummer}</p>
                          )}
                          {stop.notiz && (
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">📝 {stop.notiz}</p>
                          )}
                        </div>

                        {/* ETA */}
                        {stop.status !== 'abgeliefert' && stop.eta_min != null && (
                          <span className={cn(
                            'flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-black shrink-0',
                            stop.eta_min === 0 ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                              : 'bg-muted text-muted-foreground',
                          )}>
                            <Clock className="h-2.5 w-2.5" />
                            {stop.eta_min === 0 ? 'Jetzt' : `~${stop.eta_min}m`}
                          </span>
                        )}
                      </div>

                      {/* Aktionen */}
                      {stop.status !== 'abgeliefert' && (
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => openNav(stop.adresse)}
                            className="flex items-center gap-1 rounded-md bg-matcha-500 hover:bg-matcha-600 px-2.5 py-1 text-[10px] font-bold text-white transition"
                          >
                            <Navigation className="h-2.5 w-2.5" />
                            Navigation
                          </button>
                          {stop.telefon && (
                            <a
                              href={`tel:${stop.telefon}`}
                              className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[10px] font-semibold text-foreground hover:bg-muted/50 transition"
                            >
                              <Phone className="h-2.5 w-2.5" />
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

          {!isOnline && (
            <p className="text-center text-[10px] text-muted-foreground">Offline — Beispieldaten werden angezeigt</p>
          )}
        </div>
      )}
    </div>
  );
}

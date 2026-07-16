'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Navigation, MapPin, Clock, CheckCircle2, Circle, Zap, Phone, ExternalLink } from 'lucide-react';

/**
 * Phase 1849 — Smart-Tour-Stopp-Navigations-Hub Ultra (Fahrer-App)
 *
 * Zeigt alle Tour-Stopps mit:
 *  - Fortschritts-Zeitlinie (erledigt / aktuell / ausstehend)
 *  - ETA je Stopp (kumulativ berechnet)
 *  - Ein-Tipp-Navigation (Google Maps / Apple Maps / Waze)
 *  - Kundentelefon-Schnellzugriff
 *  - Score-Vorschau: wie viele Punkte bringt pünktliche Lieferung?
 */

interface TourStopp {
  id: string;
  stopp_nr: number;
  adresse: string;
  kundename: string | null;
  telefon: string | null;
  lat: number | null;
  lng: number | null;
  eta_min_ab_jetzt: number;
  erledigt: boolean;
  aktuell: boolean;
  punkte_wenn_puenktlich: number;
}

const MOCK_STOPPS: TourStopp[] = [
  { id: 's1', stopp_nr: 1, adresse: 'Hauptstraße 12, Aachen', kundename: 'Thomas M.', telefon: '+49 241 5551234', lat: 50.776, lng: 6.084, eta_min_ab_jetzt: 0, erledigt: true, aktuell: false, punkte_wenn_puenktlich: 15 },
  { id: 's2', stopp_nr: 2, adresse: 'Jakobstraße 5, Aachen', kundename: 'Sabine L.', telefon: '+49 241 5555678', lat: 50.773, lng: 6.090, eta_min_ab_jetzt: 8, erledigt: false, aktuell: true, punkte_wenn_puenktlich: 15 },
  { id: 's3', stopp_nr: 3, adresse: 'Pontstraße 22, Aachen', kundename: 'Klaus R.', telefon: null, lat: 50.780, lng: 6.086, eta_min_ab_jetzt: 16, erledigt: false, aktuell: false, punkte_wenn_puenktlich: 10 },
  { id: 's4', stopp_nr: 4, adresse: 'Adalbertsteinweg 8, Aachen', kundename: 'Petra K.', telefon: '+49 241 5559999', lat: 50.768, lng: 6.095, eta_min_ab_jetzt: 25, erledigt: false, aktuell: false, punkte_wenn_puenktlich: 10 },
];

function naviLink(app: 'google' | 'apple' | 'waze', lat: number, lng: number, adresse: string): string {
  const enc = encodeURIComponent(adresse);
  if (app === 'google') return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  if (app === 'waze') return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  return `maps://maps.apple.com/?daddr=${lat},${lng}&q=${enc}`;
}

interface Props {
  stopps?: TourStopp[];
  tourId?: string | null;
  className?: string;
}

export function FahrerPhase1849SmartTourStoppNavigationsHubUltra({ stopps: propStopps, className }: Props) {
  const [offen, setOffen] = useState(true);
  const [naviApp, setNaviApp] = useState<'google' | 'apple' | 'waze'>('google');
  const [stopps, setStopps] = useState<TourStopp[]>(propStopps ?? MOCK_STOPPS);

  useEffect(() => {
    if (propStopps) setStopps(propStopps);
  }, [propStopps]);

  const aktuelleStopp = useMemo(() => stopps.find((s) => s.aktuell), [stopps]);
  const erledigt = useMemo(() => stopps.filter((s) => s.erledigt).length, [stopps]);
  const gesamt = stopps.length;
  const fortschritt = gesamt > 0 ? Math.round((erledigt / gesamt) * 100) : 0;
  const gesamtPunkte = useMemo(
    () => stopps.filter((s) => !s.erledigt).reduce((sum, s) => sum + s.punkte_wenn_puenktlich, 0),
    [stopps],
  );

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      {/* Header */}
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <Navigation className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Tour-Stopps</span>
        <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">
          {erledigt}/{gesamt}
        </span>
        {gesamtPunkte > 0 && (
          <span className="flex items-center gap-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
            <Zap className="h-2.5 w-2.5" /> +{gesamtPunkte} Punkte möglich
          </span>
        )}
        {offen ? (
          <ChevronUp className="ml-auto h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {offen && (
        <div className="px-4 py-3 space-y-3">
          {/* Fortschrittsbalken */}
          <div>
            <div className="flex justify-between text-[10px] font-semibold text-muted-foreground mb-1">
              <span>Tour-Fortschritt</span>
              <span>{fortschritt}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-matcha-500 transition-all duration-700"
                style={{ width: `${fortschritt}%` }}
              />
            </div>
          </div>

          {/* Navi-App-Auswahl */}
          <div className="flex gap-1.5">
            {(['google', 'apple', 'waze'] as const).map((app) => (
              <button
                key={app}
                onClick={() => setNaviApp(app)}
                className={cn(
                  'flex-1 rounded-lg border px-2 py-1.5 text-[10px] font-bold transition-colors capitalize',
                  naviApp === app
                    ? 'border-matcha-400 bg-matcha-50 dark:bg-matcha-950/30 text-matcha-700 dark:text-matcha-300'
                    : 'border-muted bg-transparent text-muted-foreground hover:bg-muted/30',
                )}
              >
                {app === 'google' ? 'Google' : app === 'apple' ? 'Apple' : 'Waze'}
              </button>
            ))}
          </div>

          {/* Stopp-Liste */}
          <div className="space-y-2">
            {stopps.map((stopp, idx) => {
              const istErledigt = stopp.erledigt;
              const istAktuell = stopp.aktuell;
              const istAusstehend = !istErledigt && !istAktuell;
              const kannNavigieren = stopp.lat !== null && stopp.lng !== null;

              return (
                <div
                  key={stopp.id}
                  className={cn(
                    'rounded-xl border px-3 py-2.5 transition-colors',
                    istErledigt && 'bg-muted/30 border-muted opacity-60',
                    istAktuell && 'border-matcha-400 bg-matcha-50 dark:bg-matcha-950/20 ring-1 ring-matcha-300',
                    istAusstehend && 'border-muted bg-card',
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Status-Icon */}
                    <div className="shrink-0 pt-0.5">
                      {istErledigt ? (
                        <CheckCircle2 className="h-4 w-4 text-matcha-500" />
                      ) : istAktuell ? (
                        <MapPin className="h-4 w-4 text-matcha-600 animate-bounce" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn(
                          'text-xs font-bold',
                          istErledigt && 'line-through text-muted-foreground',
                          istAktuell && 'text-matcha-700 dark:text-matcha-300',
                        )}>
                          {stopp.stopp_nr}. {stopp.kundename ?? 'Kunde'}
                        </span>
                        {istAktuell && (
                          <span className="rounded-full bg-matcha-500 px-1.5 py-0.5 text-[9px] font-black text-white">
                            Aktuell
                          </span>
                        )}
                        {!istErledigt && (
                          <span className="ml-auto shrink-0 flex items-center gap-0.5 text-[9px] font-bold text-amber-600">
                            <Zap className="h-2.5 w-2.5" /> +{stopp.punkte_wenn_puenktlich} Pkt
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                        {stopp.adresse}
                      </p>
                      {!istErledigt && (
                        <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>
                            {stopp.eta_min_ab_jetzt === 0
                              ? 'Jetzt'
                              : `in ~${stopp.eta_min_ab_jetzt} Min`}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Aktionen */}
                    {!istErledigt && (
                      <div className="shrink-0 flex items-center gap-1">
                        {stopp.telefon && (
                          <a
                            href={`tel:${stopp.telefon}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-600 hover:bg-blue-100 transition-colors"
                            aria-label="Anrufen"
                          >
                            <Phone className="h-3 w-3" />
                          </a>
                        )}
                        {kannNavigieren && (
                          <a
                            href={naviLink(naviApp, stopp.lat!, stopp.lng!, stopp.adresse)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
                              istAktuell
                                ? 'bg-matcha-500 text-white hover:bg-matcha-600'
                                : 'bg-muted text-muted-foreground hover:bg-muted/70',
                            )}
                            aria-label="Navigation starten"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Nächster Stopp CTA */}
          {aktuelleStopp && aktuelleStopp.lat !== null && aktuelleStopp.lng !== null && (
            <a
              href={naviLink(naviApp, aktuelleStopp.lat!, aktuelleStopp.lng!, aktuelleStopp.adresse)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-matcha-600 px-4 py-3 text-sm font-black text-white hover:bg-matcha-700 active:bg-matcha-800 transition-colors"
            >
              <Navigation className="h-4 w-4" />
              Nächster Stopp navigieren
            </a>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, CheckCircle2, Circle, Navigation, ChevronDown, ChevronUp, Phone, Package } from 'lucide-react';

/**
 * Phase 1001 — Tour-Stopp-Navigator Final (Fahrer-App)
 *
 * Kompakter Tour-Stop-Navigator: Sequenzierte Stopp-Liste mit Status,
 * Direktnavigation per externem Karten-Link (Google Maps / Waze),
 * und Ein-Klick-Ablieferung.
 */

export interface TourStopp {
  id: string;
  nr: number;
  adresse: string;
  kundenName?: string;
  telefon?: string;
  etaMin?: number | null;
  erledigt: boolean;
  aktuell: boolean;
  bestellnummer?: string | number;
}

interface Props {
  stopps: TourStopp[];
  onStopp?: (id: string) => void;
}

const DEMO_STOPPS: TourStopp[] = [
  { id: 's1', nr: 1, adresse: 'Musterstr. 12, 10115 Berlin',     kundenName: 'Anna B.',    telefon: '+4917612345678', etaMin: 6,  erledigt: false, aktuell: true,  bestellnummer: '4471' },
  { id: 's2', nr: 2, adresse: 'Hauptallee 33, 10435 Berlin',     kundenName: 'Jonas K.',   telefon: '+4917698765432', etaMin: 14, erledigt: false, aktuell: false, bestellnummer: '4472' },
  { id: 's3', nr: 3, adresse: 'Ringstraße 7, 10829 Berlin',      kundenName: 'Maria S.',   telefon: undefined,        etaMin: 22, erledigt: false, aktuell: false, bestellnummer: '4473' },
];

function googleMapsLink(adresse: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adresse)}`;
}

function wazeLink(adresse: string): string {
  return `https://waze.com/ul?q=${encodeURIComponent(adresse)}&navigate=yes`;
}

export function FahrerPhase1001TourStoppNavigatorFinal({ stopps: propStopps, onStopp }: Props) {
  const stopps = propStopps && propStopps.length > 0 ? propStopps : DEMO_STOPPS;
  const [expanded, setExpanded] = useState<string | null>(stopps.find(s => s.aktuell)?.id ?? null);
  const [erledigtLocal, setErledigtLocal] = useState<Set<string>>(new Set(stopps.filter(s => s.erledigt).map(s => s.id)));

  const rows = useMemo(() => stopps.map(s => ({
    ...s,
    erledigt: erledigtLocal.has(s.id),
  })), [stopps, erledigtLocal]);

  const doneCount  = rows.filter(r => r.erledigt).length;
  const totalCount = rows.length;
  const pct        = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  function markDone(id: string) {
    setErledigtLocal(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    onStopp?.(id);
  }

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-gradient-to-r from-matcha-50/60 dark:from-matcha-950/20 to-transparent">
        <Navigation className="h-4 w-4 text-matcha-600" />
        <span className="text-sm font-bold">Tour-Navigator</span>
        <span className="ml-auto text-[11px] font-bold tabular-nums text-muted-foreground">
          {doneCount}/{totalCount} Stopps
        </span>
      </div>

      {/* Progress bar */}
      <div className="px-4 pt-2 pb-1">
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-matcha-500 rounded-full transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Stop list */}
      <div className="divide-y">
        {rows.map(stopp => {
          const isOpen = expanded === stopp.id;
          return (
            <div
              key={stopp.id}
              className={cn(
                'transition-colors',
                stopp.erledigt ? 'opacity-50' : '',
                stopp.aktuell && !stopp.erledigt ? 'bg-matcha-50 dark:bg-matcha-950/20' : '',
              )}
            >
              <button
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 text-left"
                onClick={() => setExpanded(isOpen ? null : stopp.id)}
              >
                {/* Status icon */}
                <div className="shrink-0">
                  {stopp.erledigt
                    ? <CheckCircle2 className="h-5 w-5 text-matcha-500" />
                    : stopp.aktuell
                      ? <MapPin className="h-5 w-5 text-blue-500 animate-pulse" />
                      : <Circle className="h-5 w-5 text-muted-foreground/50" />
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-[10px] font-black rounded-full h-5 w-5 flex items-center justify-center border',
                      stopp.aktuell && !stopp.erledigt
                        ? 'bg-blue-500 border-blue-600 text-white'
                        : stopp.erledigt
                          ? 'bg-matcha-500 border-matcha-600 text-white'
                          : 'bg-muted border-border text-muted-foreground',
                    )}>
                      {stopp.nr}
                    </span>
                    {stopp.kundenName && (
                      <span className="text-xs font-bold truncate">{stopp.kundenName}</span>
                    )}
                    {stopp.bestellnummer && (
                      <span className="text-[9px] text-muted-foreground">#{stopp.bestellnummer}</span>
                    )}
                    {stopp.etaMin !== null && stopp.etaMin !== undefined && !stopp.erledigt && (
                      <span className="ml-auto text-[10px] font-bold tabular-nums text-muted-foreground">
                        ~{stopp.etaMin} Min
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {stopp.adresse}
                  </div>
                </div>

                {isOpen
                  ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                  : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                }
              </button>

              {/* Expanded: nav + confirm */}
              {isOpen && !stopp.erledigt && (
                <div className="px-4 pb-3 space-y-2">
                  {/* Navigation links */}
                  <div className="flex gap-2">
                    <a
                      href={googleMapsLink(stopp.adresse)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-700 py-2 text-[11px] font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition"
                    >
                      <Navigation className="h-3.5 w-3.5" />
                      Google Maps
                    </a>
                    <a
                      href={wazeLink(stopp.adresse)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-700 py-2 text-[11px] font-bold text-purple-700 dark:text-purple-300 hover:bg-purple-100 transition"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      Waze
                    </a>
                  </div>

                  {/* Phone */}
                  {stopp.telefon && (
                    <a
                      href={`tel:${stopp.telefon}`}
                      className="flex items-center gap-2 rounded-lg bg-muted/30 border border-border px-3 py-2 text-xs font-medium hover:bg-muted/60 transition"
                    >
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">{stopp.telefon}</span>
                    </a>
                  )}

                  {/* Confirm delivery */}
                  <button
                    onClick={() => markDone(stopp.id)}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-matcha-600 hover:bg-matcha-700 text-white py-2.5 text-sm font-bold transition"
                  >
                    <Package className="h-4 w-4" />
                    Abgeliefert ✓
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {doneCount === totalCount && totalCount > 0 && (
        <div className="px-4 py-3 bg-matcha-50 dark:bg-matcha-950/30 border-t border-matcha-200 text-center">
          <span className="text-sm font-bold text-matcha-700 dark:text-matcha-300">
            ✓ Alle Stopps abgeschlossen!
          </span>
        </div>
      )}
    </div>
  );
}

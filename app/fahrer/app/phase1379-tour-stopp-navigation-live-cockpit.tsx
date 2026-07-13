'use client';

import { useMemo, useState } from 'react';
import {
  CheckCircle2, Clock, ExternalLink, Footprints, MapPin, Navigation,
  Phone, Package, Route, Zap,
} from 'lucide-react';
import { cn, euro } from '@/lib/utils';

/**
 * Phase 1379 — Tour-Stopp Navigation Live-Cockpit (Fahrer-App)
 *
 * Vollständige Tour-Übersicht mit:
 *   • Aktiver Stopp hervorgehoben mit Google Maps / Waze Links
 *   • Countdown bis ETA je Stopp
 *   • Lieferbestätigung-Buttons direkt in der Liste
 *   • Fortschrittsleiste + Restzeit-Schätzung
 *
 * Props-basiert — kein eigener API-Aufruf. Nach Phase1374.
 */

interface Stop {
  id: string;
  position: number;
  status: 'ausstehend' | 'unterwegs' | 'geliefert' | string;
  kunde_name: string | null;
  kunde_adresse: string | null;
  kunde_plz: string | null;
  kunde_lat: number | null;
  kunde_lng: number | null;
  kunde_telefon: string | null;
  bestellnummer: string | null;
  gesamtbetrag: number | null;
  zahlungsart: string | null;
  notiz: string | null;
}

interface Props {
  stops: Stop[];
  batchId: string | null;
  totalEtaMin?: number | null;
  batchStartedAt?: string | null;
  onMarkDelivered?: (stopId: string) => void;
}

function navUrl(platform: 'google' | 'waze', lat: number | null, lng: number | null, adresse: string | null): string {
  if (lat && lng) {
    if (platform === 'waze') return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  if (adresse) {
    const q = encodeURIComponent(adresse);
    if (platform === 'waze') return `https://waze.com/ul?q=${q}&navigate=yes`;
    return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
  }
  return '#';
}

type StopStatus = 'geliefert' | 'aktiv' | 'ausstehend';

function getStopStatus(stop: Stop, activeIdx: number, idx: number): StopStatus {
  if (stop.status === 'geliefert') return 'geliefert';
  if (idx === activeIdx) return 'aktiv';
  return 'ausstehend';
}

export function FahrerPhase1379TourStoppNavigationLiveCockpit({
  stops, batchId, totalEtaMin, batchStartedAt, onMarkDelivered,
}: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...stops].sort((a, b) => a.position - b.position),
    [stops],
  );

  const delivered = sorted.filter((s) => s.status === 'geliefert').length;
  const total = sorted.length;
  const activeIdx = delivered < total ? delivered : -1;
  const pct = total > 0 ? Math.round((delivered / total) * 100) : 0;

  const elapsedMin = batchStartedAt
    ? Math.round((Date.now() - new Date(batchStartedAt).getTime()) / 60_000)
    : null;

  const restMin = totalEtaMin && elapsedMin !== null
    ? Math.max(0, totalEtaMin - elapsedMin)
    : null;

  if (!batchId || sorted.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-matcha-50 dark:bg-matcha-950/20">
        <Route className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="font-semibold text-sm text-foreground">Tour-Navigation Live</span>
        <span className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
          {restMin !== null && (
            <span className="flex items-center gap-1 font-bold text-matcha-700 dark:text-matcha-300">
              <Clock className="h-3 w-3" />
              ~{restMin} Min
            </span>
          )}
          <span className="tabular-nums">{delivered}/{total} geliefert</span>
        </span>
      </div>

      {/* Fortschrittsleiste */}
      <div className="h-1.5 bg-muted">
        <div
          className="h-full bg-matcha-500 transition-all duration-700 rounded-r-full"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Stopp-Liste */}
      <div className="divide-y divide-border">
        {sorted.map((stop, idx) => {
          const stopStatus = getStopStatus(stop, activeIdx, idx);
          const isExpanded = expanded === stop.id;
          const hasNav = stop.kunde_lat || stop.kunde_lng || stop.kunde_adresse;

          return (
            <div
              key={stop.id}
              className={cn(
                'transition-colors',
                stopStatus === 'aktiv'     && 'bg-amber-50 dark:bg-amber-950/10',
                stopStatus === 'geliefert' && 'bg-muted/40',
              )}
            >
              {/* Hauptzeile */}
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                onClick={() => setExpanded(isExpanded ? null : stop.id)}
                aria-expanded={isExpanded}
              >
                {/* Status-Kreis */}
                <div className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black border-2',
                  stopStatus === 'geliefert' && 'bg-green-500 border-green-500 text-white',
                  stopStatus === 'aktiv'     && 'bg-amber-400 border-amber-400 text-white ring-2 ring-amber-300 ring-offset-1 animate-pulse',
                  stopStatus === 'ausstehend'&& 'bg-muted border-border text-muted-foreground',
                )}>
                  {stopStatus === 'geliefert'
                    ? <CheckCircle2 className="h-4 w-4" />
                    : stop.position}
                </div>

                {/* Inhalt */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={cn(
                      'text-sm font-bold truncate',
                      stopStatus === 'geliefert' ? 'text-muted-foreground line-through' : 'text-foreground',
                    )}>
                      {stop.kunde_name ?? `Stopp ${stop.position}`}
                    </span>
                    {stop.bestellnummer && (
                      <span className="text-[10px] rounded-full bg-muted px-1.5 py-0.5 font-bold text-muted-foreground">
                        #{stop.bestellnummer}
                      </span>
                    )}
                    {stopStatus === 'aktiv' && (
                      <span className="text-[10px] rounded-full bg-amber-100 px-1.5 py-0.5 font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 flex items-center gap-0.5">
                        <Zap className="h-2.5 w-2.5" /> Aktiv
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {stop.kunde_adresse ?? 'Adresse nicht verfügbar'}
                    {stop.kunde_plz && ` · ${stop.kunde_plz}`}
                  </div>
                </div>

                {/* Betrag */}
                {stop.gesamtbetrag != null && stop.gesamtbetrag > 0 && (
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-bold text-foreground tabular-nums">
                      {euro(stop.gesamtbetrag)}
                    </div>
                    {stop.zahlungsart && (
                      <div className="text-[10px] text-muted-foreground capitalize">
                        {stop.zahlungsart === 'bar' ? '💵 Bar' : '💳 Karte'}
                      </div>
                    )}
                  </div>
                )}
              </button>

              {/* Ausgeklappt: Navigation + Aktionen */}
              {isExpanded && (
                <div className="px-4 pb-3 space-y-2">
                  {/* Notiz */}
                  {stop.notiz && (
                    <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-300">
                      <span className="font-bold">Hinweis: </span>{stop.notiz}
                    </div>
                  )}

                  {/* Aktions-Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {/* Navigation */}
                    {hasNav && stopStatus !== 'geliefert' && (
                      <>
                        <a
                          href={navUrl('google', stop.kunde_lat, stop.kunde_lng, stop.kunde_adresse)}
                          target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-blue-700 transition"
                        >
                          <Navigation className="h-3 w-3" />
                          Google Maps
                          <ExternalLink className="h-3 w-3 opacity-70" />
                        </a>
                        <a
                          href={navUrl('waze', stop.kunde_lat, stop.kunde_lng, stop.kunde_adresse)}
                          target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-sky-600 transition"
                        >
                          <MapPin className="h-3 w-3" />
                          Waze
                          <ExternalLink className="h-3 w-3 opacity-70" />
                        </a>
                      </>
                    )}

                    {/* Anruf */}
                    {stop.kunde_telefon && (
                      <a
                        href={`tel:${stop.kunde_telefon}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-matcha-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-matcha-700 transition"
                      >
                        <Phone className="h-3 w-3" />
                        Anrufen
                      </a>
                    )}

                    {/* Geliefert */}
                    {stopStatus === 'aktiv' && onMarkDelivered && (
                      <button
                        onClick={() => { onMarkDelivered(stop.id); setExpanded(null); }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-green-700 transition"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Geliefert
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" /> Geliefert: {delivered}</span>
        <span className="flex items-center gap-1"><Package className="h-3 w-3 text-amber-500" /> Ausstehend: {total - delivered}</span>
        {elapsedMin !== null && <span className="flex items-center gap-1 ml-auto"><Footprints className="h-3 w-3" /> {elapsedMin} Min unterwegs</span>}
      </div>
    </div>
  );
}

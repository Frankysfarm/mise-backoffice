'use client';

import { useState } from 'react';
import {
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp,
  Clock, MapPin, Navigation, Phone, ShoppingBag,
} from 'lucide-react';
import { cn, euro } from '@/lib/utils';

/**
 * Phase 1384 — Tour-Stopp Navi-Ultimate (Fahrer-App)
 *
 * Vollständige Tour-Stopp-Übersicht mit:
 *   • Nächster Stopp hervorgehoben (große Karte mit GPS-Knöpfen)
 *   • Stop-Liste mit Ampel-Status (ausstehend / unterwegs / geliefert)
 *   • Fortschrittsring (SVG) + verbleibende ETA
 *   • Google Maps & Apple Maps Direktlinks
 *   • Kunden-Anruf-Button
 *   • Kollabierbare Detailansicht je Stopp
 *
 * Nach Phase1379 in fahrer/app/client.tsx einbinden.
 */

type StopStatus = 'ausstehend' | 'unterwegs' | 'geliefert';

interface Stop {
  id: string;
  position: number;
  status: StopStatus;
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
  batchId: string;
  stops: Stop[];
  totalEtaMin: number | null;
  batchStartedAt: string | null;
  onMarkDelivered: (stopId: string) => void;
}

const STATUS_STYLE: Record<StopStatus, { dot: string; text: string; label: string }> = {
  ausstehend: { dot: 'bg-muted-foreground/50', text: 'text-muted-foreground', label: 'Ausstehend' },
  unterwegs:  { dot: 'bg-blue-500',            text: 'text-blue-600 dark:text-blue-400',   label: 'Unterwegs' },
  geliefert:  { dot: 'bg-green-500',            text: 'text-green-600 dark:text-green-400', label: 'Geliefert ✓' },
};

function mapsUrl(stop: Stop): string {
  if (stop.kunde_lat && stop.kunde_lng) {
    return `https://maps.google.com/?q=${stop.kunde_lat},${stop.kunde_lng}`;
  }
  const addr = [stop.kunde_adresse, stop.kunde_plz].filter(Boolean).join(' ');
  return `https://maps.google.com/?q=${encodeURIComponent(addr)}`;
}

function wazeUrl(stop: Stop): string {
  if (stop.kunde_lat && stop.kunde_lng) {
    return `https://www.waze.com/ul?ll=${stop.kunde_lat},${stop.kunde_lng}&navigate=yes`;
  }
  const addr = [stop.kunde_adresse, stop.kunde_plz].filter(Boolean).join(' ');
  return `https://www.waze.com/ul?q=${encodeURIComponent(addr)}&navigate=yes`;
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative flex items-center justify-center h-16 w-16 shrink-0">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/20" />
        <circle
          cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeWidth="8"
          strokeLinecap="round" className="text-matcha-500"
          strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <span className="relative text-sm font-black tabular-nums text-matcha-700 dark:text-matcha-300">{pct}%</span>
    </div>
  );
}

export function FahrerPhase1388TourStoppNaviUltimate({ stops, totalEtaMin, batchStartedAt, onMarkDelivered }: Props) {
  const [openStop, setOpenStop] = useState<string | null>(null);

  const sorted = [...stops].sort((a, b) => a.position - b.position);
  const done = sorted.filter((s) => s.status === 'geliefert').length;
  const pct = sorted.length > 0 ? Math.round((done / sorted.length) * 100) : 0;

  const nextStop = sorted.find((s) => s.status !== 'geliefert') ?? null;

  const elapsedMin = batchStartedAt
    ? Math.round((Date.now() - new Date(batchStartedAt).getTime()) / 60000)
    : null;
  const remainMin = totalEtaMin && elapsedMin !== null
    ? Math.max(0, totalEtaMin - elapsedMin)
    : null;

  if (sorted.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-matcha-50 dark:bg-matcha-950/30 border-b border-border">
        <ProgressRing pct={pct} />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold uppercase tracking-wider text-matcha-700 dark:text-matcha-300 mb-0.5">
            Tour-Fortschritt
          </div>
          <div className="text-sm font-black">
            {done} / {sorted.length} Stopps geliefert
          </div>
          {remainMin !== null && (
            <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>~{remainMin} Min verbleibend</span>
            </div>
          )}
        </div>
      </div>

      {/* Next stop highlight */}
      {nextStop && nextStop.status !== 'geliefert' && (
        <div className="mx-4 mt-3 mb-2 rounded-lg border-2 border-matcha-400 dark:border-matcha-600 bg-matcha-50 dark:bg-matcha-950/30 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Navigation className="h-3.5 w-3.5 text-matcha-600 shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-wider text-matcha-600">Nächster Stopp</span>
            <span className="ml-auto text-[10px] font-bold bg-matcha-600 text-white rounded-full px-2 py-0.5">
              #{nextStop.position}
            </span>
          </div>
          <div className="font-bold text-sm mb-0.5">{nextStop.kunde_name ?? '—'}</div>
          {nextStop.kunde_adresse && (
            <div className="flex items-start gap-1 text-xs text-muted-foreground mb-2">
              <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
              <span>{nextStop.kunde_adresse}{nextStop.kunde_plz ? `, ${nextStop.kunde_plz}` : ''}</span>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <a
              href={mapsUrl(nextStop)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 text-white py-2 text-xs font-bold hover:bg-blue-700 transition"
            >
              <Navigation className="h-3.5 w-3.5" />
              Google Maps
            </a>
            <a
              href={wazeUrl(nextStop)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-lg bg-sky-500 text-white py-2 text-xs font-bold hover:bg-sky-600 transition"
            >
              <Navigation className="h-3.5 w-3.5" />
              Waze
            </a>
          </div>

          <div className="flex gap-2">
            {nextStop.kunde_telefon && (
              <a
                href={`tel:${nextStop.kunde_telefon}`}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background py-2 text-xs font-bold hover:bg-muted transition"
              >
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                Anrufen
              </a>
            )}
            <button
              onClick={() => onMarkDelivered(nextStop.id)}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-green-600 text-white py-2 text-xs font-bold hover:bg-green-700 transition"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Geliefert
            </button>
          </div>

          {nextStop.notiz && (
            <div className="mt-2 flex items-start gap-1.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 p-2">
              <AlertCircle className="h-3 w-3 text-amber-600 shrink-0 mt-0.5" />
              <span className="text-[10px] text-amber-800 dark:text-amber-300">{nextStop.notiz}</span>
            </div>
          )}
        </div>
      )}

      {/* Stop list */}
      <div className="divide-y divide-border/50">
        {sorted.map((stop) => {
          const ss = STATUS_STYLE[stop.status];
          const isOpen = openStop === stop.id;
          const isNext = stop.id === nextStop?.id;
          return (
            <div key={stop.id} className={cn(
              'transition-colors',
              stop.status === 'geliefert' && 'opacity-60',
              isNext && 'bg-matcha-50/50 dark:bg-matcha-950/10',
            )}>
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                onClick={() => setOpenStop(isOpen ? null : stop.id)}
              >
                {/* Position circle */}
                <span className={cn(
                  'shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black',
                  stop.status === 'geliefert' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' :
                  isNext ? 'bg-matcha-600 text-white' :
                  'bg-muted text-muted-foreground',
                )}>
                  {stop.status === 'geliefert' ? '✓' : stop.position}
                </span>

                {/* Name + address */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold truncate">{stop.kunde_name ?? '—'}</span>
                    <span className={cn('text-[9px] font-bold shrink-0', ss.text)}>{ss.label}</span>
                  </div>
                  {stop.kunde_adresse && (
                    <div className="text-[10px] text-muted-foreground truncate mt-0.5">{stop.kunde_adresse}</div>
                  )}
                </div>

                {/* Payment info */}
                {stop.gesamtbetrag != null && stop.zahlungsart === 'bar' && (
                  <div className="shrink-0 text-right">
                    <div className="text-xs font-black text-amber-600">{euro(stop.gesamtbetrag)}</div>
                    <div className="text-[8px] text-muted-foreground">Bar</div>
                  </div>
                )}

                {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> :
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
              </button>

              {/* Expanded detail */}
              {isOpen && (
                <div className="px-4 pb-3 space-y-2">
                  {stop.bestellnummer && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <ShoppingBag className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Bestellung:</span>
                      <span className="font-bold">#{stop.bestellnummer}</span>
                      {stop.gesamtbetrag != null && (
                        <span className="ml-auto font-bold text-matcha-700 dark:text-matcha-300">
                          {euro(stop.gesamtbetrag)}
                          {stop.zahlungsart === 'bar' && ' (Bar)'}
                        </span>
                      )}
                    </div>
                  )}
                  {stop.notiz && (
                    <div className="flex items-start gap-1.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 p-2">
                      <AlertCircle className="h-3 w-3 text-amber-600 shrink-0 mt-0.5" />
                      <span className="text-[10px] text-amber-800 dark:text-amber-300">{stop.notiz}</span>
                    </div>
                  )}
                  {stop.status !== 'geliefert' && (
                    <div className="grid grid-cols-3 gap-2">
                      <a href={mapsUrl(stop)} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1 rounded-md bg-blue-600 text-white py-1.5 text-[10px] font-bold">
                        <Navigation className="h-3 w-3" /> Maps
                      </a>
                      <a href={wazeUrl(stop)} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1 rounded-md bg-sky-500 text-white py-1.5 text-[10px] font-bold">
                        <Navigation className="h-3 w-3" /> Waze
                      </a>
                      {stop.kunde_telefon
                        ? <a href={`tel:${stop.kunde_telefon}`}
                            className="flex items-center justify-center gap-1 rounded-md border border-border bg-background py-1.5 text-[10px] font-bold">
                            <Phone className="h-3 w-3" /> Anruf
                          </a>
                        : <div className="rounded-md border border-border/30 py-1.5 text-[10px] text-center text-muted-foreground">Kein Tel.</div>
                      }
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Done banner */}
      {done === sorted.length && sorted.length > 0 && (
        <div className="flex items-center justify-center gap-2 py-3 bg-green-50 dark:bg-green-950/20 border-t border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span className="text-sm font-bold text-green-700 dark:text-green-300">Tour abgeschlossen! 🎉</span>
        </div>
      )}
    </div>
  );
}

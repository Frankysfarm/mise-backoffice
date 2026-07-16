'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  MapPin, Navigation2, CheckCircle2, Circle, Phone, ChevronRight,
  Clock, Package, Euro, ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react';

/**
 * Phase 2000 — Smart Tour Stop Kommandant (Fahrer-App)
 *
 * Konsolidierter Tour-Stop-Navigator:
 * - Alle Stopps in Reihenfolge mit Status (erledigt/aktuell/ausstehend)
 * - Nächster Stopp: Adresse, Kunden-Name, Betrag, Notiz
 * - Direkt-Navigation: Google Maps / Waze / Apple Maps Auswahl
 * - Schnell-Bestätigung: Geliefert / Problem
 * Mobile-first, Offline-resilient.
 */

interface Stop {
  id: string;
  reihenfolge?: number | null;
  sequence?: number | null;
  geliefert_am?: string | null;
  completed_at?: string | null;
  angekommen_am?: string | null;
  order?: {
    id?: string;
    bestellnummer?: string | null;
    kunde_name?: string | null;
    kunde_adresse?: string | null;
    kunde_plz?: string | null;
    kunde_lat?: number | null;
    kunde_lng?: number | null;
    gesamtbetrag?: number | null;
    bezahlt?: boolean | null;
    zahlungsart?: string | null;
    kunde_telefon?: string | null;
    kunde_notiz?: string | null;
    kunde_lieferhinweis?: string | null;
  } | null;
}

interface NavApp { key: string; label: string; icon: string; urlFn: (lat: number, lng: number, address: string) => string }

const NAV_APPS: NavApp[] = [
  {
    key: 'google',
    label: 'Google Maps',
    icon: '🗺️',
    urlFn: (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,
  },
  {
    key: 'waze',
    label: 'Waze',
    icon: '🚗',
    urlFn: (lat, lng) => `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
  },
  {
    key: 'apple',
    label: 'Apple Maps',
    icon: '🍎',
    urlFn: (lat, lng, addr) => `maps://maps.apple.com/?daddr=${encodeURIComponent(addr)}&dirflg=d`,
  },
];

function formatEuro(v: number | null) {
  if (v === null) return '--';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
}

function getSeq(s: Stop): number {
  return s.sequence ?? s.reihenfolge ?? 999;
}

function isDone(s: Stop): boolean {
  return !!(s.geliefert_am || s.completed_at);
}

export function FahrerPhase2000SmartTourStopKommandant({
  stops,
  onConfirmStop,
  className,
}: {
  stops: Stop[];
  onConfirmStop?: (stopId: string) => void;
  className?: string;
}) {
  const [navAppKey, setNavAppKey] = useState<string>('google');
  const [offen, setOffen] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...stops].sort((a, b) => getSeq(a) - getSeq(b)),
    [stops],
  );

  const doneCount = sorted.filter(isDone).length;
  const progressPct = sorted.length > 0 ? Math.round((doneCount / sorted.length) * 100) : 0;
  const currentStop = sorted.find((s) => !isDone(s)) ?? null;
  const nextStop = sorted.filter((s) => !isDone(s))[1] ?? null;

  const selectedNavApp = NAV_APPS.find((a) => a.key === navAppKey) ?? NAV_APPS[0];

  function buildNavUrl(stop: Stop | null): string | null {
    if (!stop?.order) return null;
    const lat = stop.order.kunde_lat;
    const lng = stop.order.kunde_lng;
    const addr = `${stop.order.kunde_adresse ?? ''} ${stop.order.kunde_plz ?? ''}`.trim();
    if (!lat || !lng) return null;
    return selectedNavApp.urlFn(lat, lng, addr);
  }

  async function handleConfirm(stopId: string) {
    setConfirming(stopId);
    try {
      await onConfirmStop?.(stopId);
    } finally {
      setConfirming(null);
    }
  }

  if (stops.length === 0) return null;

  const navUrl = buildNavUrl(currentStop);

  return (
    <div className={cn('rounded-2xl border bg-card shadow-md overflow-hidden', className)}>
      {/* Header */}
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 border-b bg-matcha-600 text-white hover:bg-matcha-700 transition-colors"
      >
        <Navigation2 className="h-4 w-4 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Tour Kommandant</span>
        <span className="ml-2 text-[10px] rounded-full bg-white/20 px-2 py-0.5 font-bold">
          {doneCount}/{sorted.length} Stopps
        </span>
        <span className="ml-auto text-[10px] font-bold">{progressPct}%</span>
        {offen ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
      </button>

      {/* Fortschrittsbalken */}
      <div className="h-1.5 bg-matcha-100 dark:bg-matcha-900/30">
        <div
          className="h-full bg-matcha-500 transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {offen && (
        <div className="p-4 space-y-4">
          {/* Nächster Stopp — Fokus-Karte */}
          {currentStop && (
            <div className="rounded-xl border-2 border-matcha-500 bg-matcha-50 dark:bg-matcha-950/20 p-3 space-y-2.5">
              <div className="flex items-start gap-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-matcha-600 text-white text-[11px] font-black">
                  {getSeq(currentStop)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-matcha-800 dark:text-matcha-200 truncate">
                    {currentStop.order?.kunde_name ?? 'Kunde'}
                  </p>
                  <p className="text-[11px] text-matcha-700 dark:text-matcha-300 truncate">
                    {currentStop.order?.kunde_adresse} {currentStop.order?.kunde_plz}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-bold text-foreground">
                    {formatEuro(currentStop.order?.gesamtbetrag ?? null)}
                  </p>
                  {currentStop.order?.bezahlt === false && (
                    <span className="text-[9px] font-bold text-amber-600 bg-amber-100 rounded px-1">Bar</span>
                  )}
                  {currentStop.order?.bezahlt === true && (
                    <span className="text-[9px] font-bold text-green-600 bg-green-100 rounded px-1">Bezahlt</span>
                  )}
                </div>
              </div>

              {(currentStop.order?.kunde_notiz || currentStop.order?.kunde_lieferhinweis) && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 px-2.5 py-1.5 text-[10px] text-amber-800 dark:text-amber-200">
                  📝 {currentStop.order?.kunde_lieferhinweis || currentStop.order?.kunde_notiz}
                </div>
              )}

              {/* Navigation App Auswahl */}
              <div className="flex gap-1.5">
                {NAV_APPS.map((app) => (
                  <button
                    key={app.key}
                    onClick={() => setNavAppKey(app.key)}
                    className={cn(
                      'flex-1 rounded-lg border py-1.5 text-[10px] font-bold transition-colors text-center',
                      navAppKey === app.key
                        ? 'border-matcha-500 bg-matcha-100 dark:bg-matcha-900/30 text-matcha-700 dark:text-matcha-300'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted/50',
                    )}
                  >
                    {app.icon} {app.label.split(' ')[0]}
                  </button>
                ))}
              </div>

              {/* Nav + Aktions-Buttons */}
              <div className="grid grid-cols-3 gap-2">
                <a
                  href={navUrl ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'col-span-1 flex flex-col items-center gap-1 rounded-xl border py-2.5 text-[10px] font-bold transition-colors',
                    navUrl
                      ? 'border-matcha-500 bg-matcha-600 text-white hover:bg-matcha-700'
                      : 'border-muted bg-muted/30 text-muted-foreground pointer-events-none',
                  )}
                >
                  <Navigation2 className="h-4 w-4" />
                  Navi
                </a>

                {currentStop.order?.kunde_telefon && (
                  <a
                    href={`tel:${currentStop.order.kunde_telefon}`}
                    className="col-span-1 flex flex-col items-center gap-1 rounded-xl border border-blue-300 bg-blue-50 dark:bg-blue-950/20 py-2.5 text-[10px] font-bold text-blue-700 dark:text-blue-300 transition-colors hover:bg-blue-100"
                  >
                    <Phone className="h-4 w-4" />
                    Anruf
                  </a>
                )}

                <button
                  onClick={() => handleConfirm(currentStop.id)}
                  disabled={confirming === currentStop.id}
                  className="col-span-1 flex flex-col items-center gap-1 rounded-xl border border-green-400 bg-green-500 py-2.5 text-[10px] font-black text-white transition-colors hover:bg-green-600 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {confirming === currentStop.id ? '…' : 'Geliefert'}
                </button>
              </div>
            </div>
          )}

          {/* Nächster Stopp Vorschau */}
          {nextStop && (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/10 px-3 py-2">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-muted-foreground">Danach:</p>
                <p className="text-xs font-semibold text-foreground truncate">
                  {nextStop.order?.kunde_adresse} — {nextStop.order?.kunde_name}
                </p>
              </div>
            </div>
          )}

          {/* Stop-Liste */}
          <div className="space-y-1.5">
            {sorted.map((stop) => {
              const done = isDone(stop);
              const isCurrent = currentStop?.id === stop.id;
              return (
                <div
                  key={stop.id}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 border transition-colors',
                    done ? 'border-border bg-muted/10 opacity-60' :
                    isCurrent ? 'border-matcha-300 bg-matcha-50 dark:bg-matcha-950/10' :
                    'border-border bg-background',
                  )}
                >
                  <div className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black',
                    done ? 'bg-muted text-muted-foreground' :
                    isCurrent ? 'bg-matcha-600 text-white' :
                    'bg-muted/50 text-muted-foreground',
                  )}>
                    {done ? <CheckCircle2 className="h-3 w-3" /> : getSeq(stop)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-[11px] font-semibold truncate', done ? 'line-through text-muted-foreground' : 'text-foreground')}>
                      {stop.order?.kunde_name ?? 'Kunde'} — {stop.order?.kunde_adresse}
                    </p>
                  </div>
                  <span className="text-[10px] tabular-nums text-muted-foreground shrink-0">
                    {formatEuro(stop.order?.gesamtbetrag ?? null)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Alle Stopps erledigt */}
      {doneCount === sorted.length && sorted.length > 0 && (
        <div className="px-4 py-3 border-t bg-green-50 dark:bg-green-950/20 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
          <span className="text-xs font-bold text-green-700 dark:text-green-300">
            Alle {sorted.length} Stopps erledigt! 🎉
          </span>
        </div>
      )}
    </div>
  );
}

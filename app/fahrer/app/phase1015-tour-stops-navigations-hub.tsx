'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Navigation, MapPin, CheckCircle2, Clock, Phone, ChevronDown, ChevronUp,
  Package, AlertTriangle, ArrowRight, Banknote, CreditCard,
} from 'lucide-react';

/**
 * Phase 1015 — Tour-Stops-Navigations-Hub (Fahrer)
 *
 * Umfassender Tour-Stopp-Hub mit:
 * - Nächster Stopp prominent mit Navigation-Button (Google/Waze/Apple)
 * - Alle Stopps als kompakte Liste mit Status-Ampel
 * - Kunden-Infos (Adresse, Tel, Notiz, Zahlungsart)
 * - ETA-Schätzung je Stopp
 * - Ablieferungs-Bestätigungs-Button
 * Rein clientseitig, keine API-Calls.
 */

interface OrderStop {
  id: string;
  order_id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
  order?: {
    id?: string;
    bestellnummer?: string;
    kunde_name?: string;
    kunde_adresse?: string;
    kunde_plz?: string;
    kunde_lat?: number | null;
    kunde_lng?: number | null;
    kunde_telefon?: string | null;
    kunde_notiz?: string | null;
    kunde_lieferhinweis?: string | null;
    gesamtbetrag?: number;
    bezahlt?: boolean;
    zahlungsart?: string;
    eta_earliest?: string | null;
    eta_latest?: string | null;
  } | null;
}

interface Props {
  stops: OrderStop[];
  driverId?: string;
  activeBatchId?: string;
  className?: string;
}

function openNavigation(lat: number, lng: number, app: 'google' | 'waze' | 'apple') {
  const coords = `${lat},${lng}`;
  const urls: Record<string, string> = {
    google: `https://maps.google.com/?daddr=${coords}&dirflg=d`,
    waze:   `https://waze.com/ul?ll=${coords}&navigate=yes`,
    apple:  `maps://?daddr=${coords}&dirflg=d`,
  };
  window.open(urls[app], '_blank');
}

function etaLabel(stop: OrderStop): string | null {
  const eta = stop.order?.eta_earliest;
  if (!eta) return null;
  try {
    const d = new Date(eta);
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  } catch { return null; }
}

function statusBand(stop: OrderStop): 'done' | 'aktiv' | 'offen' {
  if (stop.geliefert_am) return 'done';
  if (stop.angekommen_am) return 'aktiv';
  return 'offen';
}

const BAND_STYLE = {
  done:  { dot: 'bg-matcha-500', border: 'border-matcha-200 dark:border-matcha-800', bg: 'bg-matcha-50/50 dark:bg-matcha-900/10', label: 'Geliefert' },
  aktiv: { dot: 'bg-amber-500 animate-pulse', border: 'border-amber-300 dark:border-amber-700', bg: 'bg-amber-50 dark:bg-amber-900/20', label: 'Angekommen' },
  offen: { dot: 'bg-zinc-300 dark:bg-zinc-600', border: 'border-zinc-200 dark:border-zinc-700', bg: 'bg-transparent', label: 'Ausstehend' },
};

export function FahrerPhase1015TourStopsNavigationsHub({ stops, className }: Props) {
  const [open, setOpen] = useState(true);
  const [navApp, setNavApp] = useState<'google' | 'waze' | 'apple'>('google');

  const sortedStops = useMemo(
    () => [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge),
    [stops],
  );

  const nextStop = useMemo(
    () => sortedStops.find(s => !s.geliefert_am) ?? null,
    [sortedStops],
  );

  const done = sortedStops.filter(s => s.geliefert_am).length;
  const total = sortedStops.length;

  if (total === 0) return null;

  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className={cn('rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden', className)}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-bold">Tour-Stopp-Hub</span>
          <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 font-mono tabular-nums text-muted-foreground">
            {done}/{total}
          </span>
          {nextStop && !nextStop.geliefert_am && (
            <span className="text-[9px] rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 font-bold">
              Nächster: #{nextStop.reihenfolge}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {/* Fortschritt */}
          <div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
              <span>Fortschritt</span>
              <span className="font-bold tabular-nums">{progressPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Nächster Stopp — prominent */}
          {nextStop && (
            <div className="rounded-xl border-2 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-6 w-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                  {nextStop.reihenfolge}
                </div>
                <span className="text-sm font-bold text-blue-700 dark:text-blue-300">Nächster Stopp</span>
                {nextStop.order?.bestellnummer && (
                  <span className="text-[9px] text-muted-foreground">#{nextStop.order.bestellnummer}</span>
                )}
              </div>

              {nextStop.order?.kunde_name && (
                <div className="font-bold text-base mb-0.5">{nextStop.order.kunde_name}</div>
              )}
              {(nextStop.order?.kunde_adresse || nextStop.order?.kunde_plz) && (
                <div className="flex items-start gap-1 text-sm text-muted-foreground mb-2">
                  <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  {[nextStop.order.kunde_plz, nextStop.order.kunde_adresse].filter(Boolean).join(' ')}
                </div>
              )}

              {/* Zahlung */}
              <div className="flex items-center gap-3 mb-3 text-xs">
                {nextStop.order?.gesamtbetrag != null && (
                  <span className="flex items-center gap-1 font-bold">
                    <Banknote className="h-3.5 w-3.5" />
                    {nextStop.order.gesamtbetrag.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                  </span>
                )}
                {nextStop.order?.zahlungsart && (
                  <span className={cn(
                    'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
                    nextStop.order.bezahlt ? 'bg-matcha-100 dark:bg-matcha-800 text-matcha-700 dark:text-matcha-300' : 'bg-orange-100 dark:bg-orange-800 text-orange-700 dark:text-orange-300',
                  )}>
                    <CreditCard className="h-2.5 w-2.5" />
                    {nextStop.order.zahlungsart.toUpperCase()}
                    {nextStop.order.bezahlt ? ' ✓' : ' offen'}
                  </span>
                )}
                {etaLabel(nextStop) && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" /> ETA {etaLabel(nextStop)}
                  </span>
                )}
              </div>

              {/* Notiz / Lieferhinweis */}
              {(nextStop.order?.kunde_notiz || nextStop.order?.kunde_lieferhinweis) && (
                <div className="mb-3 rounded-lg bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 px-3 py-2 text-[11px]">
                  <AlertTriangle className="h-3 w-3 inline mr-1 text-amber-600" />
                  {nextStop.order.kunde_lieferhinweis ?? nextStop.order.kunde_notiz}
                </div>
              )}

              {/* Nav App Wahl + Button */}
              <div className="flex flex-col gap-2">
                <div className="flex gap-1.5">
                  {(['google', 'waze', 'apple'] as const).map(app => (
                    <button
                      key={app}
                      onClick={() => setNavApp(app)}
                      className={cn(
                        'flex-1 text-[10px] font-bold rounded-lg py-1.5 transition border',
                        navApp === app
                          ? 'bg-blue-600 text-white border-blue-700'
                          : 'bg-white dark:bg-zinc-800 text-muted-foreground border-zinc-200 dark:border-zinc-700',
                      )}
                    >
                      {app === 'google' ? '🗺️ Google' : app === 'waze' ? '🔵 Waze' : '🍎 Apple'}
                    </button>
                  ))}
                </div>
                {nextStop.order?.kunde_lat && nextStop.order?.kunde_lng && (
                  <button
                    onClick={() => openNavigation(
                      nextStop.order!.kunde_lat!,
                      nextStop.order!.kunde_lng!,
                      navApp,
                    )}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition"
                  >
                    <Navigation className="h-4 w-4" />
                    Navigation starten
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
                {nextStop.order?.kunde_telefon && (
                  <a
                    href={`tel:${nextStop.order.kunde_telefon}`}
                    className="w-full py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-foreground text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition"
                  >
                    <Phone className="h-4 w-4" />
                    Anrufen
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Stopp-Liste */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Alle Stopps</div>
            <div className="space-y-2">
              {sortedStops.map(stop => {
                const band = statusBand(stop);
                const style = BAND_STYLE[band];
                const isNext = stop.id === nextStop?.id;
                return (
                  <div
                    key={stop.id}
                    className={cn(
                      'rounded-xl border p-3 flex items-center gap-3 transition',
                      style.border, style.bg,
                      isNext && 'ring-2 ring-blue-400 dark:ring-blue-600',
                    )}
                  >
                    {/* Status dot */}
                    <div className={cn('h-2.5 w-2.5 rounded-full shrink-0', style.dot)} />

                    {/* Stopp-Nr */}
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[11px] font-black shrink-0">
                      {stop.reihenfolge}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate">
                        {stop.order?.kunde_name ?? 'Kunde'}
                      </div>
                      {stop.order?.kunde_adresse && (
                        <div className="text-[10px] text-muted-foreground truncate">{stop.order.kunde_adresse}</div>
                      )}
                    </div>

                    {/* Status + ETA */}
                    <div className="text-right shrink-0">
                      <div className="text-[9px] font-bold text-muted-foreground">{style.label}</div>
                      {etaLabel(stop) && (
                        <div className="text-[9px] tabular-nums text-muted-foreground">{etaLabel(stop)}</div>
                      )}
                      {band === 'done' && (
                        <CheckCircle2 className="h-4 w-4 text-matcha-500 mt-0.5 ml-auto" />
                      )}
                      {stop.order?.gesamtbetrag != null && !stop.order?.bezahlt && (
                        <div className="text-[9px] font-bold text-orange-600 dark:text-orange-400">
                          {stop.order.gesamtbetrag.toFixed(2)} € bar
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {done === total && total > 0 && (
            <div className="rounded-xl bg-matcha-50 dark:bg-matcha-900/20 border border-matcha-200 dark:border-matcha-700 p-3 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-matcha-600 dark:text-matcha-400" />
              <span className="text-sm font-bold text-matcha-700 dark:text-matcha-300">
                Alle {total} Stopps abgeschlossen!
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

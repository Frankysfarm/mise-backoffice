'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ChevronDown, ChevronRight, ChevronUp, Clock, ExternalLink,
  MapPin, Navigation, Package, Phone, Check,
} from 'lucide-react';

/**
 * Phase 1004 — Smart-Navigation-Hub-Ultra (Fahrer-App)
 *
 * Zeigt aktuelle Tour-Stopps mit:
 * - Nächster Stopp hervorgehoben (Adresse + Kunde + Betrag)
 * - Deep-Link-Buttons: Google Maps · Apple Maps · Waze
 * - Fortschrittsleiste (Stopps erledigt / gesamt)
 * - Countdown zur ETA
 * - Telefon-Schnelldial für Kunden
 * - Stopp-Abschluss-Schnellbutton
 *
 * Props: activeBatch (aus Fahrer-Client), onStopComplete Callback
 */

export interface BatchStop {
  id: string;
  reihenfolge?: number | null;
  geliefert_am?: string | null;
  angekommen_am?: string | null;
  order?: {
    id?: string;
    bestellnummer?: string | null;
    kunde_name?: string | null;
    kunde_adresse?: string | null;
    kunde_plz?: string | null;
    kunde_stadt?: string | null;
    kunde_lat?: number | null;
    kunde_lng?: number | null;
    gesamtbetrag?: number | null;
    zahlungsart?: string | null;
    bezahlt?: boolean | null;
    kunde_telefon?: string | null;
    eta_earliest?: string | null;
    eta_latest?: string | null;
    kunde_notiz?: string | null;
  } | null;
}

interface Props {
  stops?: BatchStop[] | null;
  batchStatus?: string | null;
  onStopComplete?: (stopId: string) => void;
}

// ─── Nav-App Deep Links ─────────────────────────────────────────────────────

function buildNavLinks(lat: number | null | undefined, lng: number | null | undefined, address: string) {
  const encoded = encodeURIComponent(address);
  const coord = lat != null && lng != null ? `${lat},${lng}` : null;
  return {
    google: coord
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
      : `https://www.google.com/maps/search/?api=1&query=${encoded}`,
    apple: coord
      ? `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`
      : `maps://maps.apple.com/?q=${encoded}`,
    waze: coord
      ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
      : `https://waze.com/ul?q=${encoded}&navigate=yes`,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtEuro(amount: number | null | undefined): string {
  if (amount == null) return '';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}

function fmtAddress(stop: BatchStop): string {
  const o = stop.order;
  if (!o) return '—';
  return [o.kunde_adresse, o.kunde_plz, o.kunde_stadt].filter(Boolean).join(', ') || '—';
}

function etaCountdown(eta: string | null | undefined): string | null {
  if (!eta) return null;
  const diff = new Date(eta).getTime() - Date.now();
  if (diff < 0) return 'Überfällig';
  const m = Math.floor(diff / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  return `${m}:${String(s).padStart(2, '0')} Min`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function FahrerPhase1004SmartNavigationHubUltra({ stops, batchStatus, onStopComplete }: Props) {
  const [now, setNow] = useState(Date.now);
  const [open, setOpen] = useState(true);
  const [completingStop, setCompletingStop] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, []);

  const sortedStops = useMemo(() => {
    if (!stops) return [];
    return [...stops].sort((a, b) => (a.reihenfolge ?? 0) - (b.reihenfolge ?? 0));
  }, [stops]);

  const pendingStops = sortedStops.filter(s => !s.geliefert_am);
  const completedStops = sortedStops.filter(s => !!s.geliefert_am);
  const nextStop = pendingStops[0] ?? null;
  const totalStops = sortedStops.length;
  const donePct = totalStops > 0 ? Math.round((completedStops.length / totalStops) * 100) : 0;

  const handleComplete = async (stopId: string) => {
    setCompletingStop(stopId);
    try {
      await onStopComplete?.(stopId);
    } finally {
      setCompletingStop(null);
    }
  };

  if (!stops || stops.length === 0) {
    return (
      <div className="rounded-2xl border bg-white dark:bg-neutral-900 px-4 py-6 text-center">
        <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Keine aktive Tour</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-white dark:bg-neutral-900 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-sky-50 dark:bg-sky-950/25 hover:bg-sky-100 dark:hover:bg-sky-950/40 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Navigation className="h-5 w-5 text-sky-600 dark:text-sky-400" />
          <div className="text-left">
            <div className="text-sm font-bold text-foreground leading-tight">Navigations-Hub Ultra</div>
            <div className="text-[11px] text-muted-foreground">{completedStops.length}/{totalStops} Stopps erledigt</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-sm font-black text-sky-700 dark:text-sky-300 tabular-nums">{donePct}%</div>
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Progress bar */}
      <div className="h-1.5 bg-neutral-100 dark:bg-neutral-800">
        <div className="h-full bg-sky-500 transition-all rounded-r-full" style={{ width: `${donePct}%` }} />
      </div>

      {open && (
        <div className="p-4 space-y-3">
          {/* ─── Nächster Stopp (hervorgehoben) ─────────────────────── */}
          {nextStop && (
            <div className="rounded-xl border-2 border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-950/25 overflow-hidden">
              <div className="px-3 py-2 bg-sky-500 flex items-center gap-2">
                <Navigation className="h-4 w-4 text-white animate-pulse" />
                <span className="text-xs font-black text-white uppercase tracking-wide">
                  Nächster Stopp #{nextStop.reihenfolge ?? (completedStops.length + 1)}
                </span>
                {nextStop.order?.eta_earliest && (
                  <span className="ml-auto text-[11px] font-bold text-sky-100 tabular-nums">
                    <Clock className="inline h-3 w-3 mr-0.5" />
                    {etaCountdown(nextStop.order.eta_earliest)}
                  </span>
                )}
              </div>

              <div className="p-3 space-y-2.5">
                {/* Customer */}
                <div>
                  <div className="font-black text-base text-foreground">{nextStop.order?.kunde_name ?? '—'}</div>
                  <div className="flex items-start gap-1 mt-0.5">
                    <MapPin className="h-3.5 w-3.5 text-sky-600 shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground">{fmtAddress(nextStop)}</span>
                  </div>
                </div>

                {/* Betrag + Zahlungsart */}
                <div className="flex items-center gap-2 flex-wrap">
                  {nextStop.order?.gesamtbetrag != null && (
                    <span className={cn(
                      'px-2 py-1 rounded-lg text-sm font-black',
                      nextStop.order.bezahlt
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
                    )}>
                      {fmtEuro(nextStop.order.gesamtbetrag)}
                      {!nextStop.order.bezahlt && ' (bar)'}
                    </span>
                  )}
                  {nextStop.order?.zahlungsart && (
                    <span className="text-[11px] text-muted-foreground capitalize">{nextStop.order.zahlungsart}</span>
                  )}
                  {nextStop.order?.kunde_notiz && (
                    <span className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded">
                      📝 {nextStop.order.kunde_notiz}
                    </span>
                  )}
                </div>

                {/* Nav Deep-Links */}
                {(() => {
                  const addr = fmtAddress(nextStop);
                  const links = buildNavLinks(nextStop.order?.kunde_lat, nextStop.order?.kunde_lng, addr);
                  return (
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { href: links.google, label: 'Google', emoji: '🗺️' },
                        { href: links.apple, label: 'Apple', emoji: '🍎' },
                        { href: links.waze, label: 'Waze', emoji: '🚗' },
                      ].map(({ href, label, emoji }) => (
                        <a
                          key={label}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white dark:bg-neutral-800 border border-sky-200 dark:border-sky-800 text-sm font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition-colors"
                        >
                          <span>{emoji}</span>
                          <span>{label}</span>
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </a>
                      ))}
                    </div>
                  );
                })()}

                {/* Telefon + Abschluss */}
                <div className="flex gap-2">
                  {nextStop.order?.kunde_telefon && (
                    <a
                      href={`tel:${nextStop.order.kunde_telefon}`}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm font-semibold text-foreground hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                    >
                      <Phone className="h-4 w-4" />
                      Anrufen
                    </a>
                  )}
                  <button
                    onClick={() => handleComplete(nextStop.id)}
                    disabled={completingStop === nextStop.id}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-sm font-black transition-colors disabled:opacity-60"
                  >
                    {completingStop === nextStop.id ? (
                      <span className="animate-spin">⏳</span>
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Zugestellt
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── Alle anderen Stopps ─────────────────────────────────── */}
          {sortedStops.length > 1 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground px-1">
                Tour-Übersicht ({totalStops} Stopps)
              </div>
              {sortedStops.map((stop, idx) => {
                const isDone = !!stop.geliefert_am;
                const isCurrent = stop.id === nextStop?.id;
                return (
                  <div
                    key={stop.id}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2 rounded-xl border text-sm',
                      isDone ? 'bg-neutral-50 dark:bg-neutral-800/50 border-neutral-100 dark:border-neutral-800 opacity-70' :
                      isCurrent ? 'bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800' :
                      'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800',
                    )}
                  >
                    <span className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black',
                      isDone ? 'bg-emerald-500 text-white' :
                      isCurrent ? 'bg-sky-500 text-white' :
                      'bg-neutral-200 dark:bg-neutral-700 text-muted-foreground',
                    )}>
                      {isDone ? '✓' : idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className={cn('font-semibold truncate', isDone ? 'line-through text-muted-foreground' : 'text-foreground')}>
                        {stop.order?.kunde_name ?? '—'}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">{fmtAddress(stop)}</div>
                    </div>
                    {!isDone && stop.order?.gesamtbetrag != null && (
                      <span className={cn(
                        'text-xs font-bold shrink-0',
                        stop.order.bezahlt ? 'text-emerald-600' : 'text-amber-600',
                      )}>
                        {fmtEuro(stop.order.gesamtbetrag)}
                      </span>
                    )}
                    {!isDone && !isCurrent && (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Tour abgeschlossen */}
          {pendingStops.length === 0 && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-800 px-4 py-4 text-center">
              <Check className="h-8 w-8 text-emerald-500 mx-auto mb-1.5" />
              <div className="font-black text-emerald-700 dark:text-emerald-300">Tour abgeschlossen!</div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                Alle {totalStops} Stopps erledigt
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

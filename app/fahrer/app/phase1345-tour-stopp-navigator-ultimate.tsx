'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  CheckCircle2, ChevronDown, ChevronUp, Clock, MapPin, Navigation,
  Package, Phone, Route, XCircle, Zap,
} from 'lucide-react';

/**
 * Phase 1345 — Tour-Stopp-Navigator-Ultimate (Fahrer-App)
 *
 * Zeigt alle Tour-Stopps mit:
 *   • Aktueller Stopp hervorgehoben (pulsierend)
 *   • Countdown bis zum nächsten Stopp
 *   • Adresse + Kundeninfos
 *   • Schnell-Aktionen (Navigation, Anruf)
 *   • Status-Ampel je Stopp
 */

export interface TourStopEntry {
  id: string;
  sequence: number;
  address?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  status?: 'pending' | 'arrived' | 'delivered' | 'failed' | string;
  notes?: string | null;
  eta_min?: number | null;
  order_id?: string | null;
  bestellnummer?: string | null;
}

interface Props {
  stops?: TourStopEntry[];
  currentStopIndex?: number;
  locationId?: string | null;
  driverId?: string | null;
  onMarkDelivered?: (stopId: string) => void;
  onNavigate?: (stop: TourStopEntry) => void;
}

function StopStatusIcon({ status }: { status: string }) {
  if (status === 'delivered') return <CheckCircle2 className="h-4 w-4 text-matcha-500" />;
  if (status === 'failed') return <XCircle className="h-4 w-4 text-red-500" />;
  if (status === 'arrived') return <Zap className="h-4 w-4 text-amber-500 animate-pulse" />;
  return <Package className="h-4 w-4 text-muted-foreground" />;
}

function buildGoogleMapsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

function buildWazeUrl(address: string): string {
  return `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
}

export function FahrerPhase1345TourStoppNavigatorUltimate({
  stops: externalStops,
  currentStopIndex: externalCurrentIdx,
  locationId,
  driverId,
  onMarkDelivered,
  onNavigate,
}: Props) {
  const [stops, setStops] = useState<TourStopEntry[]>(externalStops ?? []);
  const [currentIdx, setCurrentIdx] = useState(externalCurrentIdx ?? 0);
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [expandedStop, setExpandedStop] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  // Sync external props
  useEffect(() => { if (externalStops) setStops(externalStops); }, [externalStops]);
  useEffect(() => { if (externalCurrentIdx !== undefined) setCurrentIdx(externalCurrentIdx); }, [externalCurrentIdx]);

  // Tick for live countdown
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(tick);
  }, []);

  // Fetch from API if no external stops
  useEffect(() => {
    if (externalStops?.length) return;
    if (!driverId && !locationId) return;

    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (driverId) params.set('driver_id', driverId);
        if (locationId) params.set('location_id', locationId);
        const r = await fetch(`/api/fahrer/tour?${params}`, { cache: 'no-store' });
        if (r.ok) {
          const d = await r.json();
          const s = d.stops ?? d.tour_stops ?? d.batches?.[0]?.stops ?? [];
          setStops(s);
          const firstPending = s.findIndex((st: TourStopEntry) => st.status === 'pending' || st.status === 'arrived');
          if (firstPending >= 0) setCurrentIdx(firstPending);
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [driverId, locationId, externalStops]);

  const completed = stops.filter(s => s.status === 'delivered').length;
  const total = stops.length;
  const remaining = total - completed;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const currentStop = stops[currentIdx] ?? null;

  return (
    <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Route className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Tour-Stopps
          </span>
          <span className="rounded-full bg-matcha-100 text-matcha-700 px-2 py-0.5 text-[10px] font-black">
            {completed}/{total}
          </span>
          {remaining > 0 && (
            <span className="text-[10px] text-muted-foreground">{remaining} ausstehend</span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t">
          {/* Progress bar */}
          {total > 0 && (
            <div className="px-4 pt-3 pb-1">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-matcha-500 transition-all duration-700"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <span className="text-[10px] font-black text-matcha-600">{progressPct}%</span>
              </div>
            </div>
          )}

          {/* Current stop highlight */}
          {currentStop && (currentStop.status === 'pending' || currentStop.status === 'arrived') && (
            <div className="mx-4 mt-3 rounded-xl bg-matcha-50 border-2 border-matcha-300 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-matcha-500 text-white text-[9px] font-black px-2 py-0.5 animate-pulse">
                  JETZT
                </span>
                <span className="text-xs font-bold">Stopp {currentIdx + 1}</span>
                {currentStop.bestellnummer && (
                  <span className="text-[10px] text-muted-foreground">
                    #{currentStop.bestellnummer}
                  </span>
                )}
              </div>

              {currentStop.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 text-matcha-600 shrink-0 mt-0.5" />
                  <span className="text-sm font-bold text-foreground">{currentStop.address}</span>
                </div>
              )}

              {currentStop.customer_name && (
                <div className="text-[11px] text-muted-foreground">
                  Kunde: <span className="font-bold text-foreground">{currentStop.customer_name}</span>
                </div>
              )}

              {currentStop.notes && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-[10px] text-amber-700">
                  📝 {currentStop.notes}
                </div>
              )}

              {/* Navigation buttons */}
              {currentStop.address && (
                <div className="flex gap-2 flex-wrap pt-0.5">
                  <a
                    href={buildGoogleMapsUrl(currentStop.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500 text-white text-[11px] font-bold px-3 py-1.5"
                    onClick={() => onNavigate?.(currentStop)}
                  >
                    <Navigation className="h-3 w-3" />
                    Google Maps
                  </a>
                  <a
                    href={buildWazeUrl(currentStop.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 text-white text-[11px] font-bold px-3 py-1.5"
                  >
                    <Navigation className="h-3 w-3" />
                    Waze
                  </a>
                  {currentStop.customer_phone && (
                    <a
                      href={`tel:${currentStop.customer_phone}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-matcha-600 text-white text-[11px] font-bold px-3 py-1.5"
                    >
                      <Phone className="h-3 w-3" />
                      Anrufen
                    </a>
                  )}
                  <button
                    onClick={() => onMarkDelivered?.(currentStop.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-matcha-500 text-white text-[11px] font-bold px-3 py-1.5"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Geliefert
                  </button>
                </div>
              )}
            </div>
          )}

          {/* All stops list */}
          <div className="px-4 pt-3 pb-4 space-y-1.5 max-h-[400px] overflow-y-auto">
            {loading && stops.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-6">Lade Tour-Stopps…</div>
            )}
            {!loading && stops.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-6">Keine Tour-Stopps verfügbar.</div>
            )}

            {stops.map((stop, idx) => {
              const isCurrent = idx === currentIdx && (stop.status === 'pending' || stop.status === 'arrived');
              const isDone = stop.status === 'delivered';
              const isFailed = stop.status === 'failed';
              const isExpanded = expandedStop === stop.id;

              return (
                <div
                  key={stop.id}
                  className={cn(
                    'rounded-xl border transition-all',
                    isCurrent ? 'border-matcha-300 bg-matcha-50' : isDone ? 'border-matcha-100 bg-matcha-50/40 opacity-60' : isFailed ? 'border-red-200 bg-red-50/40' : 'border-border bg-muted/20',
                  )}
                >
                  <button
                    onClick={() => setExpandedStop(isExpanded ? null : stop.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                  >
                    {/* Sequence circle */}
                    <div className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black border-2',
                      isDone ? 'bg-matcha-500 border-matcha-600 text-white' : isFailed ? 'bg-red-400 border-red-500 text-white' : isCurrent ? 'bg-amber-400 border-amber-500 text-white animate-pulse' : 'bg-muted border-border text-muted-foreground',
                    )}>
                      {isDone ? '✓' : isFailed ? '✗' : stop.sequence ?? idx + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold truncate">
                        {stop.address ?? `Stopp ${stop.sequence ?? idx + 1}`}
                      </div>
                      {stop.customer_name && (
                        <div className="text-[10px] text-muted-foreground truncate">{stop.customer_name}</div>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {stop.eta_min && !isDone && !isFailed && (
                        <span className="text-[10px] font-bold text-muted-foreground tabular-nums">
                          ~{stop.eta_min} Min
                        </span>
                      )}
                      <StopStatusIcon status={stop.status ?? 'pending'} />
                    </div>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && stop.address && (
                    <div className="px-3 pb-2.5 pt-0 space-y-2 border-t border-black/5">
                      {stop.notes && (
                        <div className="rounded bg-amber-50 border border-amber-200 px-2 py-1 text-[10px] text-amber-700">
                          📝 {stop.notes}
                        </div>
                      )}
                      <div className="flex gap-2 flex-wrap">
                        <a
                          href={buildGoogleMapsUrl(stop.address)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-500 text-white text-[10px] font-bold px-2.5 py-1"
                        >
                          <Navigation className="h-2.5 w-2.5" />
                          Maps
                        </a>
                        {stop.customer_phone && (
                          <a
                            href={`tel:${stop.customer_phone}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-matcha-600 text-white text-[10px] font-bold px-2.5 py-1"
                          >
                            <Phone className="h-2.5 w-2.5" />
                            Anrufen
                          </a>
                        )}
                        {!isDone && !isFailed && (
                          <button
                            onClick={() => { onMarkDelivered?.(stop.id); setExpandedStop(null); }}
                            className="inline-flex items-center gap-1 rounded-lg bg-matcha-500 text-white text-[10px] font-bold px-2.5 py-1"
                          >
                            <CheckCircle2 className="h-2.5 w-2.5" />
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

          {/* Footer summary */}
          {total > 0 && (
            <div className="border-t px-4 py-2 flex items-center gap-3 text-[10px] flex-wrap">
              <Zap className="h-3 w-3 text-matcha-600 shrink-0" />
              <span className="font-bold text-matcha-600">{completed} geliefert</span>
              <span className="text-muted-foreground">·</span>
              <span className="font-bold text-amber-600">{remaining} ausstehend</span>
              {stops.filter(s => s.status === 'failed').length > 0 && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-bold text-red-600">{stops.filter(s => s.status === 'failed').length} fehlgeschlagen</span>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { MapPin, Navigation, Phone, CheckCircle2, Clock, ChevronRight, Package, AlertTriangle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TourStop {
  id: string;
  reihenfolge: number | null;
  address: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  status: string | null;
  lat: number | null;
  lng: number | null;
  eta_min: number | null;
  order_id: string | null;
  is_cash: boolean;
  amount: number | null;
}

interface Props {
  stops: TourStop[];
  driverId: string;
  isOnline?: boolean;
}

function openMapsNavigation(lat: number | null, lng: number | null, address: string | null) {
  if (lat !== null && lng !== null) {
    window.open(`https://maps.google.com/?daddr=${lat},${lng}&dirflg=d`, '_blank');
  } else if (address) {
    window.open(`https://maps.google.com/?q=${encodeURIComponent(address)}&dirflg=d`, '_blank');
  }
}

export function FahrerPhase2111TourStoppSmartGpsHub({ stops, driverId, isOnline }: Props) {
  const [tick, setTick] = useState(0);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const sorted = [...stops].sort((a, b) => (a.reihenfolge ?? 99) - (b.reihenfolge ?? 99));
  const pending = sorted.filter(s => s.status !== 'delivered' && s.status !== 'geliefert');
  const done = sorted.filter(s => s.status === 'delivered' || s.status === 'geliefert');
  const current = pending[0] ?? null;
  const next = pending[1] ?? null;

  const handleConfirmDelivery = useCallback(async (stopId: string) => {
    setConfirming(true);
    try {
      await fetch(`/api/delivery/driver/stop/${stopId}/complete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ driver_id: driverId }),
      });
    } catch {}
    finally {
      setConfirming(false);
      setConfirmId(null);
    }
  }, [driverId]);

  if (pending.length === 0 && done.length === 0) return null;

  const allDone = pending.length === 0;

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
        <Navigation className="h-4 w-4 text-saffron shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Tour-Navigator</span>
        <span className="ml-1 text-[10px] bg-saffron/10 text-saffron rounded-full px-2 py-0.5 font-bold tabular-nums">
          {done.length}/{sorted.length} Stopps
        </span>
        {!isOnline && (
          <span className="ml-auto text-[9px] text-amber-600 font-bold">Offline</span>
        )}
      </div>

      <div className="p-3 space-y-3">
        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-saffron transition-all duration-500"
            style={{ width: `${sorted.length > 0 ? (done.length / sorted.length) * 100 : 0}%` }}
          />
        </div>

        {allDone ? (
          <div className="flex items-center gap-2 rounded-xl border border-matcha-200 bg-matcha-50 px-4 py-3">
            <CheckCircle2 className="h-5 w-5 text-matcha-600 shrink-0" />
            <div>
              <div className="text-sm font-bold text-matcha-700">Alle Stopps abgeschlossen!</div>
              <div className="text-[10px] text-matcha-600">{done.length} Lieferungen erfolgreich</div>
            </div>
          </div>
        ) : (
          <>
            {/* Current stop — hero */}
            {current && (
              <div className="rounded-xl border-2 border-saffron/40 bg-saffron/5 overflow-hidden">
                <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                  <Zap className="h-3.5 w-3.5 text-saffron shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-saffron">Jetzt · Stopp {current.reihenfolge ?? 1}</span>
                  {current.eta_min !== null && (
                    <span className="ml-auto text-[11px] font-mono tabular-nums font-black text-foreground">
                      ~{current.eta_min} Min
                    </span>
                  )}
                </div>

                <div className="px-3 pb-2.5 space-y-1.5">
                  <div className="font-bold text-sm text-foreground">{current.customer_name ?? 'Kunde'}</div>
                  {current.address && (
                    <div className="flex items-start gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <span className="text-[11px] text-foreground leading-snug">{current.address}</span>
                    </div>
                  )}
                  {current.amount !== null && (
                    <div className="flex items-center gap-1.5">
                      <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-[11px] font-mono tabular-nums font-bold">
                        {current.is_cash ? '💵 ' : '💳 '}
                        {current.amount.toFixed(2).replace('.', ',')} €
                      </span>
                    </div>
                  )}

                  {/* CTAs */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => openMapsNavigation(current.lat, current.lng, current.address)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-saffron text-white py-2 text-[11px] font-bold shadow-sm hover:bg-saffron/90 transition-colors"
                    >
                      <Navigation className="h-3.5 w-3.5" />
                      Navigation
                    </button>
                    {current.customer_phone && (
                      <a
                        href={`tel:${current.customer_phone}`}
                        className="flex items-center justify-center gap-1 rounded-lg border border-border bg-muted px-3 py-2 text-[11px] font-bold hover:bg-muted/80 transition-colors"
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <button
                      onClick={() => setConfirmId(current.id)}
                      className="flex items-center justify-center gap-1 rounded-lg border border-matcha-300 bg-matcha-50 px-3 py-2 text-[11px] font-bold text-matcha-700 hover:bg-matcha-100 transition-colors"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Abliefern
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Confirm dialog */}
            {confirmId && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span className="text-[11px] font-bold text-amber-800">Lieferung bestätigen?</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleConfirmDelivery(confirmId)}
                    disabled={confirming}
                    className="flex-1 rounded-lg bg-matcha-600 text-white py-1.5 text-[11px] font-bold hover:bg-matcha-700 disabled:opacity-60 transition-colors"
                  >
                    {confirming ? 'Wird gespeichert…' : 'Ja, geliefert'}
                  </button>
                  <button
                    onClick={() => setConfirmId(null)}
                    className="rounded-lg border border-border bg-muted px-3 py-1.5 text-[11px] font-bold transition-colors"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}

            {/* Next stop preview */}
            {next && (
              <div className="flex items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2">
                <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground shrink-0">Nächst</span>
                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold truncate">{next.customer_name ?? 'Kunde'}</div>
                  {next.address && (
                    <div className="text-[9px] text-muted-foreground truncate">{next.address}</div>
                  )}
                </div>
                {next.eta_min !== null && (
                  <span className="text-[10px] font-mono tabular-nums text-muted-foreground shrink-0">~{next.eta_min}m</span>
                )}
              </div>
            )}

            {/* Remaining stops list */}
            {pending.length > 2 && (
              <div className="space-y-1">
                {pending.slice(2).map((s, i) => (
                  <div key={s.id} className="flex items-center gap-2 px-2 py-1 rounded-lg border border-border/50 bg-muted/10 text-[10px] text-muted-foreground">
                    <span className="tabular-nums font-bold w-4 shrink-0">{(current?.reihenfolge ?? 0) + i + 2}</span>
                    <span className="truncate">{s.customer_name ?? s.address ?? 'Stopp'}</span>
                    {s.eta_min !== null && <span className="ml-auto tabular-nums shrink-0">~{s.eta_min}m</span>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Done stops */}
        {done.length > 0 && (
          <div className="flex items-center gap-1.5 text-[9px] text-matcha-600 pt-1">
            <CheckCircle2 className="h-3 w-3 shrink-0" />
            <span>{done.length} bereits geliefert</span>
          </div>
        )}
      </div>
    </div>
  );
}

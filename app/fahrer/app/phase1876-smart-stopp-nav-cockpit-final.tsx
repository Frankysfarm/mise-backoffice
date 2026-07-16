'use client';

/**
 * Phase 1876 — Smart Stopp-Nav Cockpit Final
 * Kompaktes Stop-Navigationscockpit für Fahrer: Zeigt aktuellen Stop, ETA,
 * Aktions-Buttons (Navi öffnen, Ankunft bestätigen) und nächsten Stop als Vorschau.
 * Mobile-first, offline-resilient.
 */

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  MapPin,
  Navigation,
  CheckCircle2,
  Clock,
  ChevronRight,
  AlertCircle,
  Phone,
  Package,
} from 'lucide-react';

type Stop = {
  id: string;
  sequence: number;
  address: string;
  lat?: number | null;
  lng?: number | null;
  order?: {
    bestellnummer: string;
    status: string;
    delivery_zone?: string | null;
    eta_earliest?: string | null;
    eta_latest?: string | null;
  } | null;
  angekommen_am?: string | null;
  geliefert_am?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  notes?: string | null;
};

type Props = {
  stops: Stop[];
  onConfirmArrival?: (stopId: string) => void;
  onConfirmDelivery?: (stopId: string) => void;
};

export function Phase1876SmartStoppNavCockpitFinal({
  stops,
  onConfirmArrival,
  onConfirmDelivery,
}: Props) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  const sortedStops = [...stops].sort((a, b) => a.sequence - b.sequence);
  const current = sortedStops.find(s => !s.geliefert_am);
  const next = current
    ? sortedStops.find(s => !s.geliefert_am && s.id !== current.id)
    : null;
  const completedCount = sortedStops.filter(s => !!s.geliefert_am).length;
  const totalCount = sortedStops.length;

  if (!current) {
    return (
      <div className="rounded-xl border border-matcha-200 bg-matcha-50 dark:bg-matcha-950/30 px-4 py-5 text-center">
        <CheckCircle2 className="h-8 w-8 text-matcha-500 mx-auto mb-2" />
        <p className="text-sm font-bold text-matcha-700 dark:text-matcha-300">
          Alle {totalCount} Stops abgeschlossen!
        </p>
      </div>
    );
  }

  const eta = current.order?.eta_earliest
    ? new Date(current.order.eta_earliest)
    : null;
  const etaStr = eta
    ? eta.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : null;
  const mapsUrl =
    current.lat && current.lng
      ? `https://maps.google.com/?q=${current.lat},${current.lng}`
      : `https://maps.google.com/?q=${encodeURIComponent(current.address)}`;

  const isLate = eta ? now > eta.getTime() + 5 * 60_000 : false;

  return (
    <div className="space-y-3">
      {/* Progress Strip */}
      <div className="flex items-center gap-2 px-1">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-matcha-500 rounded-full transition-all duration-700"
            style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
        <span className="text-[10px] font-bold tabular-nums text-muted-foreground shrink-0">
          {completedCount}/{totalCount}
        </span>
      </div>

      {/* Current Stop Card */}
      <div
        className={cn(
          'rounded-2xl border-2 overflow-hidden',
          isLate ? 'border-red-400 bg-red-50 dark:bg-red-950/30' : 'border-matcha-400 bg-white dark:bg-card',
        )}
      >
        {/* Header */}
        <div
          className={cn(
            'flex items-center gap-2 px-4 py-2',
            isLate ? 'bg-red-500 text-white' : 'bg-matcha-500 text-white',
          )}
        >
          <MapPin className="h-4 w-4 shrink-0" />
          <span className="text-xs font-black uppercase tracking-wider flex-1">
            Stop {current.sequence} · Jetzt liefern
          </span>
          {isLate && <AlertCircle className="h-4 w-4 animate-pulse" />}
          {etaStr && (
            <span className="text-[11px] font-bold tabular-nums bg-white/20 rounded-full px-2 py-0.5">
              {isLate ? '⚠ ' : ''}ETA {etaStr}
            </span>
          )}
        </div>

        {/* Address */}
        <div className="px-4 py-3 border-b border-border/50">
          <p className="text-base font-bold leading-snug">{current.address}</p>
          {current.order && (
            <div className="flex items-center gap-2 mt-1">
              <Package className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                #{current.order.bestellnummer}
                {current.order.delivery_zone ? ` · Zone ${current.order.delivery_zone}` : ''}
              </span>
            </div>
          )}
          {current.customer_name && (
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">
              {current.customer_name}
            </p>
          )}
          {current.notes && (
            <p className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/30 rounded px-2 py-1 mt-1">
              {current.notes}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 px-4 py-3">
          {/* Navigation */}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-matcha-500 hover:bg-matcha-600 text-white py-3 text-sm font-bold transition-colors active:scale-95"
          >
            <Navigation className="h-4 w-4" />
            Navigieren
          </a>

          {/* Confirm */}
          {!current.angekommen_am ? (
            <button
              onClick={() => onConfirmArrival?.(current.id)}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-matcha-500 text-matcha-600 dark:text-matcha-400 py-3 text-sm font-bold hover:bg-matcha-50 dark:hover:bg-matcha-950/40 transition-colors active:scale-95"
            >
              <Clock className="h-4 w-4" />
              Angekommen
            </button>
          ) : (
            <button
              onClick={() => onConfirmDelivery?.(current.id)}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-green-500 hover:bg-green-600 text-white py-3 text-sm font-bold transition-colors active:scale-95"
            >
              <CheckCircle2 className="h-4 w-4" />
              Geliefert
            </button>
          )}

          {/* Phone */}
          {current.customer_phone && (
            <a
              href={`tel:${current.customer_phone}`}
              className="flex items-center justify-center rounded-xl border border-border bg-muted/50 px-3 py-3 hover:bg-muted transition-colors active:scale-95"
            >
              <Phone className="h-4 w-4 text-muted-foreground" />
            </a>
          )}
        </div>
      </div>

      {/* Next Stop Preview */}
      {next && (
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-2.5 flex items-center gap-3">
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Nächster Stop {next.sequence}
            </span>
            <p className="text-xs text-foreground font-medium truncate">{next.address}</p>
          </div>
          {next.order?.bestellnummer && (
            <span className="text-[10px] font-bold text-muted-foreground shrink-0">
              #{next.order.bestellnummer}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

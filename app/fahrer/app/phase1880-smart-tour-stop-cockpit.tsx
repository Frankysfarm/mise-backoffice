'use client';

/**
 * Phase 1880 — Smart Tour-Stop Cockpit
 *
 * Kombiniertes Cockpit für den aktuellen Lieferstopp:
 * - Countdown-Ring bis zur ETA
 * - Adresse + Kundenname prominent
 * - One-Tap Navigation (Google Maps / Apple Maps)
 * - Kunden-Telefon-Link
 * - Kompakte Vorschau der nächsten Stopps mit Nummerierung
 * - Fortschrittsbalken (Stopps erledigt)
 *
 * Mobile-first, offline-resilient.
 */

import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  Navigation, MapPin, Phone, CheckCircle2, Clock, ChevronRight,
  Package, AlertCircle, Bike,
} from 'lucide-react';

type Stop = {
  id: string;
  sequence: number;
  address?: string | null;
  adresse?: string | null;
  lat?: number | null;
  lng?: number | null;
  customer_name?: string | null;
  kunde_name?: string | null;
  customer_phone?: string | null;
  telefon?: string | null;
  estimated_arrival?: string | null;
  angekommen_am?: string | null;
  geliefert_am?: string | null;
  bestellnummer?: string | null;
  notes?: string | null;
};

interface Props {
  stops: Stop[];
  driverName?: string | null;
  onConfirmDelivery?: (stopId: string) => void;
  className?: string;
}

function CountdownRing({ etaMs, className }: { etaMs: number | null; className?: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  if (etaMs === null) {
    return (
      <div className={cn('flex h-20 w-20 items-center justify-center rounded-full border-4 border-muted/50 shrink-0', className)}>
        <Clock className="h-7 w-7 text-muted-foreground" />
      </div>
    );
  }

  const remainMs = Math.max(0, etaMs - now);
  const remainMin = Math.ceil(remainMs / 60_000);
  const totalMin = 30;
  const pct = Math.max(0, Math.min(1, 1 - remainMs / (totalMin * 60_000)));
  const r = 34;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;
  const color = remainMin <= 3 ? '#EF4444' : remainMin <= 8 ? '#F59E0B' : '#4CAF50';

  return (
    <div className={cn('relative shrink-0', className)}>
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-muted/20" />
        <circle
          cx="40" cy="40" r={r}
          fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 40 40)"
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
        <text x="40" y="35" textAnchor="middle" fontSize="20" fontWeight="800" fill={color}>{remainMin}</text>
        <text x="40" y="52" textAnchor="middle" fontSize="10" fill="currentColor" className="opacity-60">Min</text>
      </svg>
    </div>
  );
}

export function FahrerPhase1880SmartTourStopCockpit({ stops, driverName, onConfirmDelivery, className }: Props) {
  const sorted = useMemo(
    () => [...stops].sort((a, b) => a.sequence - b.sequence),
    [stops],
  );

  const currentStop = sorted.find((s) => !s.geliefert_am) ?? null;
  const nextStops = currentStop
    ? sorted.filter((s) => !s.geliefert_am && s.id !== currentStop.id)
    : [];
  const completedCount = sorted.filter((s) => s.geliefert_am).length;
  const progressPct = sorted.length > 0 ? Math.round((completedCount / sorted.length) * 100) : 0;

  if (!currentStop) {
    return (
      <div className={cn('rounded-2xl border bg-card p-5 text-center', className)}>
        <CheckCircle2 className="h-10 w-10 mx-auto text-matcha-500 mb-2" />
        <p className="font-bold text-matcha-700">Alle Stopps abgeschlossen!</p>
        <p className="text-xs text-muted-foreground mt-1">
          {sorted.length} / {sorted.length} Bestellungen zugestellt
        </p>
      </div>
    );
  }

  const addr = currentStop.address ?? currentStop.adresse ?? null;
  const name = currentStop.customer_name ?? currentStop.kunde_name ?? null;
  const phone = currentStop.customer_phone ?? currentStop.telefon ?? null;
  const etaMs = currentStop.estimated_arrival
    ? new Date(currentStop.estimated_arrival).getTime()
    : null;

  const mapsUrl = currentStop.lat && currentStop.lng
    ? `https://maps.google.com/?q=${currentStop.lat},${currentStop.lng}`
    : addr
      ? `https://maps.google.com/?q=${encodeURIComponent(addr)}`
      : null;

  const appleMapsUrl = addr
    ? `http://maps.apple.com/?q=${encodeURIComponent(addr)}`
    : null;

  return (
    <div className={cn('rounded-2xl border bg-card shadow-md overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-matcha-600 text-white">
        <Bike className="h-4 w-4 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1">Aktueller Stopp</span>
        <span className="text-[10px] font-bold bg-white/20 rounded-full px-2 py-0.5">
          {completedCount + 1}/{sorted.length}
        </span>
      </div>

      {/* Main: Countdown + Adresse */}
      <div className="px-4 py-4 flex items-start gap-4">
        <CountdownRing etaMs={etaMs} />

        <div className="flex-1 min-w-0 space-y-2">
          {name && (
            <p className="text-base font-black leading-tight truncate">{name}</p>
          )}
          {addr ? (
            <p className="text-sm text-muted-foreground leading-snug">{addr}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">Keine Adresse</p>
          )}
          {currentStop.bestellnummer && (
            <span className="inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold">
              #{currentStop.bestellnummer}
            </span>
          )}
          {currentStop.notes && (
            <div className="flex items-start gap-1 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-2 py-1.5">
              <AlertCircle className="h-3 w-3 shrink-0 mt-0.5 text-amber-600" />
              <p className="text-[10px] text-amber-700 dark:text-amber-300 leading-snug">{currentStop.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Navi-Buttons */}
      <div className="px-4 pb-3 flex gap-2">
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-matcha-600 py-2.5 text-white text-xs font-bold hover:bg-matcha-700 transition-colors active:scale-95"
          >
            <Navigation className="h-4 w-4" />
            Google Maps
          </a>
        )}
        {appleMapsUrl && (
          <a
            href={appleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-xl border border-matcha-300 bg-matcha-50 dark:bg-matcha-950/20 px-3 py-2.5 text-matcha-700 dark:text-matcha-300 text-xs font-bold hover:bg-matcha-100 transition-colors active:scale-95"
          >
            <MapPin className="h-4 w-4" />
            Apple
          </a>
        )}
        {phone && (
          <a
            href={`tel:${phone}`}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-bold hover:bg-muted/50 transition-colors active:scale-95"
          >
            <Phone className="h-4 w-4" />
          </a>
        )}
      </div>

      {/* Bestätigung */}
      {onConfirmDelivery && (
        <div className="px-4 pb-3">
          <button
            onClick={() => onConfirmDelivery(currentStop.id)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-white text-sm font-black hover:bg-blue-700 transition-colors active:scale-95"
          >
            <CheckCircle2 className="h-4 w-4" />
            Zugestellt bestätigen
          </button>
        </div>
      )}

      {/* Fortschritt */}
      <div className="px-4 pb-3 space-y-1">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{completedCount} erledigt</span>
          <span>{sorted.length - completedCount} ausstehend</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-matcha-500 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Nächste Stopps */}
      {nextStops.length > 0 && (
        <div className="border-t bg-muted/20">
          <div className="px-4 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Nächste Stopps</p>
            <div className="space-y-1.5">
              {nextStops.slice(0, 3).map((s, i) => {
                const a = s.address ?? s.adresse ?? null;
                const n = s.customer_name ?? s.kunde_name ?? null;
                return (
                  <div key={s.id} className="flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-black text-muted-foreground">
                      {i + 2}
                    </span>
                    <div className="flex-1 min-w-0">
                      {n && <span className="text-[11px] font-bold truncate block">{n}</span>}
                      {a && <span className="text-[10px] text-muted-foreground truncate block">{a}</span>}
                    </div>
                    <Package className="h-3 w-3 shrink-0 text-muted-foreground" />
                  </div>
                );
              })}
              {nextStops.length > 3 && (
                <p className="text-[10px] text-muted-foreground text-right">
                  +{nextStops.length - 3} weitere
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

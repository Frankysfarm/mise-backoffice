'use client';

import { useEffect, useState } from 'react';
import { cn, euro } from '@/lib/utils';
import {
  MapPin, Navigation, Clock, ChevronRight,
  CreditCard, Banknote, Phone, MessageSquare,
  CheckCircle2, AlertTriangle,
} from 'lucide-react';

/**
 * phase876 — Tour Nächster Stopp Ultra
 *
 * Ultra-kompakte Next-Stop-Karte für die Fahrer-App.
 * Zeigt: Adresse · ETA-Countdown · Zahlungsart · Direkt-Navigation
 */

type Stop = {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    kunde_plz: string | null;
    kunde_lat: number | null;
    kunde_lng: number | null;
    gesamtbetrag: number;
    zahlungsart?: string | null;
    bezahlt?: boolean | null;
    eta_earliest?: string | null;
    eta_latest?: string | null;
    kunde_telefon?: string | null;
    kunde_notiz?: string | null;
  } | null;
};

interface Props {
  stops: Stop[];
  currentStopIndex?: number;
}

function useTick() {
  const [, set] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => set((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
}

function EtaCountdown({ iso }: { iso: string }) {
  useTick();
  const secs = Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
  if (secs < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[11px] font-black text-red-400 animate-pulse">
        <AlertTriangle size={9} /> Überfällig
      </span>
    );
  }
  const mm = Math.floor(secs / 60);
  const ss = secs % 60;
  const urgent = secs < 300;
  const tight  = secs < 600;
  return (
    <span className={cn(
      'font-mono font-black text-sm tabular-nums',
      urgent ? 'text-red-400 animate-pulse' : tight ? 'text-amber-400' : 'text-emerald-400',
    )}>
      {mm}:{String(ss).padStart(2, '0')}
    </span>
  );
}

function navUrl(lat: number | null, lng: number | null, address: string | null) {
  if (lat != null && lng != null) {
    const ios = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
    return ios
      ? `maps://maps.apple.com/?daddr=${lat},${lng}`
      : `https://maps.google.com/?daddr=${lat},${lng}`;
  }
  if (address) return `https://maps.google.com/?q=${encodeURIComponent(address)}`;
  return null;
}

export function FahrerPhase876TourNaechsterStoppUltra({ stops, currentStopIndex = 0 }: Props) {
  const pending = stops.filter((s) => !s.geliefert_am);
  const currentStop = pending[0] ?? null;
  const nextStop    = pending[1] ?? null;
  const totalStops  = stops.length;
  const delivered   = stops.filter((s) => s.geliefert_am).length;

  if (!currentStop?.order) return null;

  const o = currentStop.order;
  const url = navUrl(o.kunde_lat, o.kunde_lng, o.kunde_adresse);
  const cashOnDelivery = o.zahlungsart === 'bar' && !o.bezahlt;

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-card shadow-lg overflow-hidden">
      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div
          className="h-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${totalStops > 0 ? (delivered / totalStops) * 100 : 0}%` }}
        />
      </div>

      <div className="p-4">
        {/* Header row */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-400">
              <MapPin size={9} />
              Stop {delivered + 1}/{totalStops}
            </span>
            {cashOnDelivery && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-400">
                <Banknote size={9} /> Barzahlung!
              </span>
            )}
          </div>
          {o.eta_earliest && <EtaCountdown iso={o.eta_earliest} />}
        </div>

        {/* Customer info */}
        <div className="mb-3">
          <p className="text-base font-bold text-foreground leading-tight">{o.kunde_name}</p>
          <p className="text-sm text-muted-foreground">
            {o.kunde_adresse}{o.kunde_plz ? `, ${o.kunde_plz}` : ''}
          </p>
          {o.kunde_notiz && (
            <p className="mt-1 rounded bg-amber-500/10 px-2 py-1 text-[11px] text-amber-400">
              ℹ️ {o.kunde_notiz}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-white active:scale-95 transition-transform"
            >
              <Navigation size={16} />
              Navigation starten
            </a>
          )}
          {o.kunde_telefon && (
            <a
              href={`tel:${o.kunde_telefon}`}
              className="flex items-center justify-center rounded-xl bg-muted p-3 text-muted-foreground active:scale-95 transition-transform"
            >
              <Phone size={16} />
            </a>
          )}
        </div>

        {/* Order total */}
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>#{o.bestellnummer}</span>
          <span className="font-semibold text-foreground">{euro(o.gesamtbetrag)}</span>
        </div>

        {/* Next stop preview */}
        {nextStop?.order && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted/50 p-2">
            <ChevronRight size={12} className="text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">Danach:</p>
              <p className="truncate text-xs font-medium text-foreground">
                {nextStop.order.kunde_name} · {nextStop.order.kunde_adresse}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

/**
 * FahrerStoppSchnellKommando — Phase 403
 *
 * Kompakte Schnell-Aktions-Karte für den aktuellen Lieferstopp.
 * Zeigt Kunde, Adresse, Betrag und ermöglicht:
 *  - Navigations-App öffnen (Maps/Waze)
 *  - Kunde anrufen
 *  - Lieferung bestätigen (callback)
 *  - Problem melden (callback)
 *
 * Designed für eine-Hand-Bedienung auf dem Smartphone.
 */

import { cn, euro } from '@/lib/utils';
import {
  Navigation, Phone, CheckCircle2, AlertTriangle,
  MapPin, Banknote, CreditCard, MessageSquare,
} from 'lucide-react';

interface StopData {
  id: string;
  bestellnummer: string;
  kunde_name: string;
  kunde_adresse: string | null;
  kunde_lat: number | null;
  kunde_lng: number | null;
  kunde_telefon?: string | null;
  gesamtbetrag: number;
  zahlungsart?: string | null;
  bezahlt?: boolean | null;
  kunde_notiz?: string | null;
  kunde_lieferhinweis?: string | null;
}

interface Props {
  stop: StopData;
  stopNumber: number;
  totalStops: number;
  onComplete?: () => void;
  onProblem?: () => void;
  disabled?: boolean;
}

function buildMapsUrl(lat: number | null, lng: number | null, address: string | null): string {
  if (lat != null && lng != null) {
    const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
    return isIos
      ? `maps://maps.apple.com/?daddr=${lat},${lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  if (address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }
  return '#';
}

export function FahrerStoppSchnellKommando({ stop, stopNumber, totalStops, onComplete, onProblem, disabled }: Props) {
  const mapsUrl = buildMapsUrl(stop.kunde_lat, stop.kunde_lng, stop.kunde_adresse);
  const isCashPayment = stop.zahlungsart === 'bar' || stop.zahlungsart === 'cash';
  const needsCashCollection = isCashPayment && !stop.bezahlt;

  return (
    <div className="rounded-2xl border-2 border-matcha-300 bg-white shadow-lg overflow-hidden">
      {/* Header: Stopp-Nummer + Kunde */}
      <div className="bg-matcha-600 px-4 py-3 text-white">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold opacity-80 uppercase tracking-wider">
            Stopp {stopNumber} / {totalStops}
          </span>
          <span className="text-xs font-bold bg-white/20 rounded-full px-2 py-0.5">
            #{stop.bestellnummer}
          </span>
        </div>
        <div className="mt-1 text-lg font-black leading-tight">{stop.kunde_name}</div>
      </div>

      {/* Adresse */}
      {stop.kunde_adresse && (
        <div className="flex items-start gap-2 px-4 py-3 border-b">
          <MapPin className="h-4 w-4 text-matcha-600 shrink-0 mt-0.5" />
          <span className="text-sm text-foreground">{stop.kunde_adresse}</span>
        </div>
      )}

      {/* Lieferhinweis */}
      {(stop.kunde_notiz || stop.kunde_lieferhinweis) && (
        <div className="flex items-start gap-2 px-4 py-2 bg-amber-50 border-b border-amber-100">
          <MessageSquare className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
          <span className="text-xs text-amber-800">
            {stop.kunde_lieferhinweis || stop.kunde_notiz}
          </span>
        </div>
      )}

      {/* Betrag + Zahlung */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b">
        {needsCashCollection ? (
          <Banknote className="h-4 w-4 text-red-600 shrink-0" />
        ) : (
          <CreditCard className="h-4 w-4 text-matcha-600 shrink-0" />
        )}
        <span className={cn(
          'text-sm font-bold',
          needsCashCollection ? 'text-red-600' : 'text-foreground',
        )}>
          {euro(stop.gesamtbetrag)}
        </span>
        <span className={cn(
          'text-xs rounded-full px-2 py-0.5 font-bold',
          needsCashCollection
            ? 'bg-red-100 text-red-700'
            : 'bg-matcha-100 text-matcha-700',
        )}>
          {needsCashCollection ? 'Barzahlung einsammeln' : stop.bezahlt ? 'Bezahlt' : (stop.zahlungsart ?? 'Online')}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3 p-3">
        {/* Navigation */}
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className={cn(
            'flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition-all active:scale-95',
            'bg-blue-500 text-white hover:bg-blue-600',
            disabled && 'opacity-50 pointer-events-none',
          )}
        >
          <Navigation className="h-4 w-4" />
          Navigation
        </a>

        {/* Anrufen */}
        {stop.kunde_telefon ? (
          <a
            href={`tel:${stop.kunde_telefon}`}
            className={cn(
              'flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition-all active:scale-95',
              'bg-slate-100 text-slate-700 hover:bg-slate-200',
              disabled && 'opacity-50 pointer-events-none',
            )}
          >
            <Phone className="h-4 w-4" />
            Anrufen
          </a>
        ) : (
          <div className="flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold bg-muted/40 text-muted-foreground opacity-50">
            <Phone className="h-4 w-4" />
            Kein Tel.
          </div>
        )}

        {/* Zugestellt */}
        <button
          onClick={onComplete}
          disabled={disabled}
          className={cn(
            'col-span-2 flex items-center justify-center gap-2 rounded-xl py-4 text-base font-black transition-all active:scale-95',
            'bg-matcha-600 text-white hover:bg-matcha-700',
            disabled && 'opacity-50',
          )}
        >
          <CheckCircle2 className="h-5 w-5" />
          Zugestellt ✓
        </button>

        {/* Problem */}
        <button
          onClick={onProblem}
          disabled={disabled}
          className={cn(
            'col-span-2 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all active:scale-95',
            'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100',
            disabled && 'opacity-50',
          )}
        >
          <AlertTriangle className="h-4 w-4" />
          Problem melden
        </button>
      </div>
    </div>
  );
}

'use client';

/**
 * NaechsterStopFokus
 * Ultra-fokussierte Karte für den nächsten Lieferstopp.
 * Zeigt Adresse, ETA-Countdown, Betrag und Navigationsbutton auf einen Blick.
 */

import { useEffect, useState } from 'react';
import { cn, euro } from '@/lib/utils';
import {
  Navigation, MapPin, Phone, Clock, AlertTriangle,
  CheckCircle2, Banknote, CreditCard, ChevronRight, Bike,
} from 'lucide-react';

type Stop = {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    id: string;
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
    kunde_lieferhinweis?: string | null;
  };
};

interface Props {
  stops: Stop[];
  totalStops: number;
  onNavigate?: (lat: number, lng: number, address: string) => void;
  onArrived?: (stopId: string) => void;
}

function useTick() {
  const [, setN] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setN(n => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
}

function EtaDisplay({ iso }: { iso: string | null | undefined }) {
  useTick();
  if (!iso) return null;

  const secs = Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
  const abs = Math.abs(secs);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const display = `${secs < 0 ? '-' : ''}${m}:${String(s).padStart(2, '0')}`;

  const isOverdue = secs < -60;
  const isUrgent = secs >= -60 && secs < 180;

  return (
    <div className={cn(
      'flex flex-col items-end',
    )}>
      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">ETA</span>
      <span className={cn(
        'font-display text-3xl font-black tabular-nums leading-none',
        isOverdue ? 'text-red-500 animate-pulse' : isUrgent ? 'text-amber-500' : 'text-matcha-600',
      )}>
        {display}
      </span>
      {isOverdue && (
        <span className="flex items-center gap-0.5 text-[9px] font-bold text-red-500">
          <AlertTriangle size={8} /> Überfällig
        </span>
      )}
    </div>
  );
}

export function NaechsterStopFokus({ stops, totalStops, onNavigate, onArrived }: Props) {
  const sorted = [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const next = sorted.find(s => !s.geliefert_am);
  const deliveredCount = sorted.filter(s => s.geliefert_am).length;

  if (!next) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-matcha-300 bg-matcha-50 p-6 text-center">
        <CheckCircle2 className="h-12 w-12 text-matcha-500" />
        <div>
          <div className="font-display text-lg font-black text-matcha-800">Tour abgeschlossen!</div>
          <div className="text-sm text-matcha-600">{deliveredCount} von {totalStops} Stops geliefert</div>
        </div>
      </div>
    );
  }

  const { order } = next;
  const hasCash = order.zahlungsart === 'bar' && !order.bezahlt;
  const canNavigate = !!order.kunde_lat && !!order.kunde_lng;

  const fullAddress = [order.kunde_adresse, order.kunde_plz].filter(Boolean).join(', ');

  function openNav() {
    if (order.kunde_lat && order.kunde_lng) {
      onNavigate?.(order.kunde_lat, order.kunde_lng, fullAddress);
      const url = `https://www.google.com/maps/dir/?api=1&destination=${order.kunde_lat},${order.kunde_lng}&travelmode=driving`;
      window.open(url, '_blank');
    }
  }

  function callCustomer() {
    if (order.kunde_telefon) {
      window.location.href = `tel:${order.kunde_telefon}`;
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-matcha-300 bg-white shadow-lg">
      {/* Stop counter strip */}
      <div className="flex items-center gap-2 bg-matcha-600 px-4 py-2">
        <Bike className="h-4 w-4 text-matcha-100" />
        <span className="text-xs font-bold text-matcha-100">
          Stop {next.reihenfolge} von {totalStops}
        </span>
        <div className="ml-auto flex gap-1">
          {sorted.map((s, i) => (
            <div
              key={s.id}
              className={cn(
                'h-1.5 w-5 rounded-full',
                s.geliefert_am ? 'bg-matcha-300' : s.id === next.id ? 'bg-white' : 'bg-matcha-800',
              )}
            />
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Order number */}
            <div className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Bestellung #{order.bestellnummer}
            </div>

            {/* Customer name */}
            <div className="font-display text-xl font-black leading-tight text-gray-900 truncate">
              {order.kunde_name}
            </div>

            {/* Address */}
            {fullAddress && (
              <div className="mt-1 flex items-start gap-1.5 text-sm text-gray-600">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-matcha-500" />
                <span className="leading-snug">{fullAddress}</span>
              </div>
            )}
          </div>

          {/* ETA */}
          <EtaDisplay iso={order.eta_earliest} />
        </div>

        {/* Cash alert */}
        {hasCash && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
            <Banknote className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-bold text-amber-800">
              Barzahlung: {euro(order.gesamtbetrag)}
            </span>
          </div>
        )}

        {/* Notes */}
        {(order.kunde_notiz || order.kunde_lieferhinweis) && (
          <div className="mt-2 rounded-xl bg-sky-50 border border-sky-200 px-3 py-2 text-xs text-sky-800">
            {order.kunde_lieferhinweis && <div className="font-bold">{order.kunde_lieferhinweis}</div>}
            {order.kunde_notiz && <div className="mt-0.5 opacity-80">{order.kunde_notiz}</div>}
          </div>
        )}

        {/* Amount */}
        <div className="mt-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {hasCash ? (
            <Banknote className="h-4 w-4 text-amber-500" />
          ) : (
            <CreditCard className="h-4 w-4 text-matcha-500" />
          )}
          <span>
            {euro(order.gesamtbetrag)}
            {' · '}
            {hasCash ? 'Bar kassieren' : order.bezahlt ? 'Bezahlt' : 'Karte/Digital'}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2 border-t p-3">
        {/* Navigate */}
        <button
          onClick={openNav}
          disabled={!canNavigate}
          className={cn(
            'flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all active:scale-95',
            canNavigate
              ? 'bg-matcha-600 text-white shadow-md hover:bg-matcha-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed',
          )}
        >
          <Navigation className="h-4 w-4" />
          Navigation
        </button>

        {/* Call */}
        {order.kunde_telefon ? (
          <button
            onClick={callCustomer}
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-matcha-300 bg-white py-3 text-sm font-bold text-matcha-700 transition-all hover:bg-matcha-50 active:scale-95"
          >
            <Phone className="h-4 w-4" />
            Anrufen
          </button>
        ) : (
          <button
            disabled
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 py-3 text-sm font-medium text-gray-400 cursor-not-allowed"
          >
            <Phone className="h-4 w-4" />
            Keine Nummer
          </button>
        )}
      </div>

      {/* Arrived button */}
      {onArrived && (
        <div className="border-t px-3 pb-3">
          <button
            onClick={() => onArrived(next.id)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-matcha-500 to-matcha-600 py-3.5 text-base font-black text-white shadow-lg transition-all hover:from-matcha-600 hover:to-matcha-700 active:scale-95"
          >
            <CheckCircle2 className="h-5 w-5" />
            Angekommen — Geliefert!
          </button>
        </div>
      )}
    </div>
  );
}

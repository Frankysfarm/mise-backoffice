'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  MapPin,
  Navigation,
  Clock,
  AlertTriangle,
  CreditCard,
  Banknote,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

type StopOrder = {
  bestellnummer: string;
  kunde_name: string;
  kunde_adresse: string | null;
  kunde_plz: string | null;
  kunde_lat: number | null;
  kunde_lng: number | null;
  eta_earliest: string | null;
  eta_latest: string | null;
  gesamtbetrag: number;
  zahlungsart: string | null;
  bezahlt: boolean | null;
};

type Stop = {
  id: string;
  order: StopOrder;
  reihenfolge: number;
  distanz_zum_vorgaenger_m: number | null;
};

type Props = {
  stop: Stop | null;
  totalStops: number;
};

function useTick() {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
}

function formatEtaCountdown(iso: string): { display: string; isUrgent: boolean; isOverdue: boolean } {
  const secs = Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
  const isOverdue = secs < 0;
  const isUrgent = !isOverdue && secs < 300;
  const abs = Math.abs(secs);
  const mm = Math.floor(abs / 60);
  const ss = abs % 60;
  const display = isOverdue
    ? `+${mm}:${String(ss).padStart(2, '0')} verspätet`
    : `${mm}:${String(ss).padStart(2, '0')}`;
  return { display, isUrgent, isOverdue };
}

function euro(n: number): string {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function EtaDisplay({ iso }: { iso: string }) {
  useTick();
  const { display, isUrgent, isOverdue } = formatEtaCountdown(iso);
  return (
    <span
      className={cn(
        'font-mono font-black text-lg tabular-nums',
        isOverdue ? 'text-red-400 animate-pulse' : isUrgent ? 'text-orange-400' : 'text-matcha-300',
      )}
    >
      {isOverdue && <AlertTriangle className="inline h-4 w-4 mr-1" />}
      {display}
    </span>
  );
}

function googleMapsUrl(lat: number | null, lng: number | null, address: string | null): string {
  if (lat != null && lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  if (address) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
  }
  return '#';
}

function wazeUrl(lat: number | null, lng: number | null): string {
  if (lat != null && lng != null) {
    return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  }
  return '#';
}

export function FahrerTourNavigatorPro({ stop, totalStops }: Props) {
  if (!stop) {
    return (
      <div className="rounded-2xl bg-matcha-900 border border-white/10 p-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-matcha-400 mx-auto mb-2" />
        <p className="text-sm font-bold text-matcha-200">Kein aktiver Stopp</p>
        <p className="text-[11px] text-matcha-500 mt-1">Alle Stopps wurden abgearbeitet</p>
      </div>
    );
  }

  const { order, reihenfolge, distanz_zum_vorgaenger_m } = stop;
  const distKm =
    distanz_zum_vorgaenger_m != null
      ? `${(distanz_zum_vorgaenger_m / 1000).toFixed(1)} km`
      : null;

  const fullAddress = [order.kunde_adresse, order.kunde_plz].filter(Boolean).join(', ');
  const gMapsLink = googleMapsUrl(order.kunde_lat, order.kunde_lng, fullAddress || null);
  const wazeLink = wazeUrl(order.kunde_lat, order.kunde_lng);
  const hasGeoCoords = order.kunde_lat != null && order.kunde_lng != null;

  const isCash =
    (order.zahlungsart ?? '').toLowerCase().includes('bar') ||
    (order.zahlungsart ?? '').toLowerCase().includes('cash');

  return (
    <div className="rounded-2xl bg-gradient-to-b from-matcha-900 to-matcha-800 border border-white/10 overflow-hidden shadow-xl">
      {/* Stop badge header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/5">
        <div className="h-8 w-8 rounded-full bg-matcha-400 text-matcha-900 flex items-center justify-center text-sm font-black shrink-0">
          {reihenfolge}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-widest text-matcha-400">
            Stopp {reihenfolge} von {totalStops}
          </div>
          <div className="text-xs font-black text-matcha-200 font-mono">#{order.bestellnummer}</div>
        </div>
        {distKm && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-matcha-400 shrink-0">
            <Navigation className="h-3 w-3" />
            {distKm}
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Customer info */}
        <div>
          <div className="text-lg font-black text-white">{order.kunde_name}</div>
          {fullAddress && (
            <div className="flex items-start gap-1.5 mt-1">
              <MapPin className="h-3.5 w-3.5 text-matcha-400 shrink-0 mt-0.5" />
              <span className="text-[12px] text-matcha-300">{fullAddress}</span>
            </div>
          )}
        </div>

        {/* ETA */}
        {order.eta_earliest && (
          <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
            <div className="text-[9px] font-black uppercase tracking-widest text-matcha-500 mb-1">
              <Clock className="inline h-3 w-3 mr-0.5" />
              ETA Countdown
            </div>
            <EtaDisplay iso={order.eta_earliest} />
            {order.eta_latest && order.eta_latest !== order.eta_earliest && (
              <div className="text-[10px] text-matcha-500 mt-0.5">
                bis {new Date(order.eta_latest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
              </div>
            )}
          </div>
        )}

        {/* Payment info */}
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2">
            <div className="text-[9px] font-bold uppercase tracking-wide text-matcha-500 mb-0.5">Betrag</div>
            <div className="text-base font-black text-white">{euro(order.gesamtbetrag)}</div>
          </div>
          <div className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2">
            <div className="text-[9px] font-bold uppercase tracking-wide text-matcha-500 mb-0.5">Zahlung</div>
            <div className="flex items-center gap-1.5">
              {isCash ? (
                <Banknote className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
              ) : (
                <CreditCard className="h-3.5 w-3.5 text-blue-400 shrink-0" />
              )}
              <span className="text-xs font-bold text-white truncate">
                {order.zahlungsart ?? 'Unbekannt'}
              </span>
            </div>
          </div>
          <div className="rounded-xl border px-3 py-2 flex flex-col items-center gap-1">
            <div className="text-[9px] font-bold uppercase tracking-wide text-matcha-500">Bezahlt</div>
            {order.bezahlt ? (
              <CheckCircle2 className="h-5 w-5 text-matcha-400" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-orange-400" />
            )}
          </div>
        </div>

        {/* Cash warning */}
        {isCash && !order.bezahlt && (
          <div className="flex items-center gap-2 rounded-xl bg-yellow-500/20 border border-yellow-500/30 px-3 py-2 text-xs font-bold text-yellow-200">
            <Banknote className="h-4 w-4 shrink-0" />
            Bargeld kassieren: {euro(order.gesamtbetrag)}
          </div>
        )}

        {/* Navigation buttons */}
        <div className="grid grid-cols-2 gap-2">
          <a
            href={gMapsLink}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-black transition active:scale-[0.97]',
              hasGeoCoords
                ? 'bg-matcha-500 hover:bg-matcha-400 text-white'
                : 'bg-white/10 text-matcha-300 hover:bg-white/20',
            )}
          >
            <Navigation className="h-4 w-4" />
            Google Maps
            <ExternalLink className="h-3 w-3" />
          </a>

          <a
            href={hasGeoCoords ? wazeLink : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-black transition active:scale-[0.97]',
              hasGeoCoords
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-white/10 text-matcha-300 opacity-50 cursor-not-allowed',
            )}
          >
            <Navigation className="h-4 w-4" />
            Waze
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

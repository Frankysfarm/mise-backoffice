'use client';

import { useEffect, useState } from 'react';
import { cn, euro } from '@/lib/utils';
import {
  MapPin, Phone, CheckCircle2, Clock, Navigation, Banknote, CreditCard,
  AlertTriangle, ChevronRight, Map, MessageSquare,
} from 'lucide-react';

type Stop = {
  id: string;
  batch_id: string;
  order_id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
  distanz_zum_vorgaenger_m?: number | null;
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
    kunde_notiz?: string | null;
    kunde_lieferhinweis?: string | null;
    kunde_telefon?: string | null;
  };
};

function useTick() {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
}

function EtaCountdown({ iso }: { iso: string }) {
  useTick();
  const secs = Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
  const isUrgent = secs < 300;
  const isOverdue = secs < 0;
  const absSecs = Math.abs(secs);
  const mm = Math.floor(absSecs / 60);
  const ss = absSecs % 60;
  if (isOverdue)
    return (
      <span className="inline-flex items-center gap-0.5 text-red-400 font-black text-xs animate-pulse">
        <AlertTriangle size={10} /> +{mm}:{String(ss).padStart(2,'0')}
      </span>
    );
  return (
    <span className={cn(
      'font-mono font-black text-xs tabular-nums',
      isUrgent ? 'text-orange-400 animate-pulse' : 'text-accent',
    )}>
      {mm}:{String(ss).padStart(2,'0')}
    </span>
  );
}

function mapsUrl(lat: number | null, lng: number | null, address: string | null): string {
  if (lat != null && lng != null) {
    const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
    return isIos
      ? `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  }
  if (address) {
    const q = encodeURIComponent(address);
    return `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`;
  }
  return '#';
}

type Props = {
  stops: Stop[];
  onMarkDelivered: (stopId: string) => void;
  pending?: boolean;
  kitchenStatuses?: Map<string, string>;
};

export function TourStopNavigator({ stops, onMarkDelivered, pending, kitchenStatuses }: Props) {
  const pendingStops = stops.filter((s) => !s.geliefert_am);
  const doneStops    = stops.filter((s) => s.geliefert_am);
  const totalStops   = stops.length;
  const progress     = totalStops > 0 ? (doneStops.length / totalStops) * 100 : 0;
  const nextStop     = pendingStops[0] ?? null;

  if (stops.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
        <div className="flex items-center justify-between mb-2 text-xs font-bold">
          <span className="text-matcha-200">Tour-Fortschritt</span>
          <span className="text-accent font-mono">{doneStops.length}/{totalStops} Stops</span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Upcoming stops */}
      {pendingStops.map((stop, idx) => {
        const o = stop.order;
        const isNext = idx === 0;
        const kitchenStatus = kitchenStatuses?.get(stop.order_id) ?? null;
        const isKitchenReady = kitchenStatus === 'fertig' || kitchenStatus === 'unterwegs';
        const isCash = (o.zahlungsart ?? '').toLowerCase().includes('bar') || (o.zahlungsart ?? '').toLowerCase().includes('cash');
        const needsCollection = isCash && !o.bezahlt;
        const navUrl = mapsUrl(o.kunde_lat, o.kunde_lng, o.kunde_adresse ? `${o.kunde_adresse}, ${o.kunde_plz ?? ''}` : null);
        const dist = stop.distanz_zum_vorgaenger_m;

        return (
          <div
            key={stop.id}
            className={cn(
              'rounded-2xl border transition-all',
              isNext
                ? 'bg-white/10 border-accent/40 shadow-lg shadow-accent/10'
                : 'bg-white/5 border-white/10 opacity-75',
            )}
          >
            {/* Stop header */}
            <div className="flex items-center gap-2 px-4 pt-3 pb-2">
              <div className={cn(
                'h-7 w-7 rounded-full flex items-center justify-center text-xs font-black shrink-0',
                isNext ? 'bg-accent text-matcha-900' : 'bg-white/10 text-matcha-300',
              )}>
                {stop.reihenfolge}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-black text-matcha-300 font-mono">
                    #{o.bestellnummer}
                  </span>
                  {isNext && <span className="text-[9px] font-bold text-accent bg-accent/15 rounded-full px-1.5 py-0.5">NÄCHSTER STOP</span>}
                  {dist && <span className="text-[9px] text-matcha-400">{dist < 1000 ? `${dist}m` : `${(dist/1000).toFixed(1)}km`}</span>}
                </div>
                <div className="font-bold text-white text-sm truncate">{o.kunde_name}</div>
              </div>
              {/* ETA */}
              {o.eta_latest && <EtaCountdown iso={o.eta_latest} />}
            </div>

            {/* Address */}
            <div className="px-4 pb-2">
              {o.kunde_adresse && (
                <div className="flex items-center gap-1 text-[11px] text-matcha-300">
                  <MapPin size={10} className="shrink-0" />
                  <span className="truncate">{o.kunde_adresse}{o.kunde_plz ? `, ${o.kunde_plz}` : ''}</span>
                </div>
              )}

              {/* Cash collection indicator */}
              {needsCollection && (
                <div className="mt-1 inline-flex items-center gap-1 rounded-lg bg-yellow-500/20 border border-yellow-500/30 px-2 py-1 text-[10px] font-bold text-yellow-200">
                  <Banknote size={10} />
                  Bargeld kassieren: {euro(o.gesamtbetrag)}
                </div>
              )}

              {/* Kitchen not ready warning */}
              {!isKitchenReady && kitchenStatus && isNext && (
                <div className="mt-1 inline-flex items-center gap-1 rounded-lg bg-orange-500/20 border border-orange-500/30 px-2 py-1 text-[10px] font-bold text-orange-200">
                  <Clock size={10} />
                  Küche: {kitchenStatus === 'in_zubereitung' ? 'noch in Zubereitung' : kitchenStatus}
                </div>
              )}

              {/* Notes */}
              {(o.kunde_notiz || o.kunde_lieferhinweis) && (
                <div className="mt-1 flex items-start gap-1 text-[10px] text-matcha-300 italic">
                  <MessageSquare size={9} className="shrink-0 mt-0.5" />
                  <span className="truncate">{o.kunde_lieferhinweis ?? o.kunde_notiz}</span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            {isNext && (
              <div className="flex gap-2 px-3 pb-3">
                {/* Navigate */}
                <a
                  href={navUrl}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-accent text-matcha-900 font-bold text-sm py-3 transition active:scale-[0.97]"
                >
                  <Navigation size={16} />
                  Navigation
                </a>

                {/* Phone */}
                {o.kunde_telefon && (
                  <a
                    href={`tel:${o.kunde_telefon}`}
                    className="w-12 flex items-center justify-center rounded-xl bg-white/10 border border-white/10 text-white transition hover:bg-white/20"
                    aria-label="Anrufen"
                  >
                    <Phone size={16} />
                  </a>
                )}

                {/* Mark delivered */}
                <button
                  onClick={() => onMarkDelivered(stop.id)}
                  disabled={pending}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-matcha-600 hover:bg-matcha-500 text-white font-bold text-sm py-3 transition active:scale-[0.97] disabled:opacity-50"
                >
                  <CheckCircle2 size={16} />
                  Geliefert
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Completed stops */}
      {doneStops.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-black uppercase tracking-widest text-matcha-500 px-1">
            Erledigt
          </div>
          {doneStops.map((stop) => (
            <div
              key={stop.id}
              className="flex items-center gap-2.5 rounded-xl bg-white/5 border border-white/5 px-3 py-2 opacity-60"
            >
              <CheckCircle2 size={14} className="text-accent shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold text-matcha-200 truncate">{stop.order.kunde_name}</span>
                {stop.order.kunde_adresse && (
                  <span className="ml-1.5 text-[10px] text-matcha-400 truncate">{stop.order.kunde_adresse}</span>
                )}
              </div>
              {stop.geliefert_am && (
                <span className="text-[9px] text-matcha-500 font-mono tabular-nums shrink-0">
                  {new Date(stop.geliefert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

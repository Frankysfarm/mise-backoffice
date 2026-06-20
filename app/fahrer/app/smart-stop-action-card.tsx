'use client';

import { cn } from '@/lib/utils';
import { MapPin, Navigation, Phone, Banknote, CreditCard, MessageSquare, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

interface StopOrder {
  id: string; bestellnummer: string; kunde_name: string;
  kunde_adresse: string | null; kunde_plz: string | null;
  kunde_lat: number | null; kunde_lng: number | null;
  gesamtbetrag: number; zahlungsart: string; bezahlt: boolean;
  kunde_notiz?: string | null; kunde_lieferhinweis?: string | null;
  kunde_telefon?: string | null;
}

interface Props {
  stop: {
    id: string; order_id: string; reihenfolge: number;
    angekommen_am: string | null; geliefert_am: string | null;
    order: StopOrder;
  };
  stopIndex: number;
  totalStops: number;
  driverLat?: number | null;
  driverLng?: number | null;
  onMarkArrived: (stopId: string) => void;
  onMarkDelivered: (stopId: string) => void;
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1); const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function SmartStopActionCard({ stop, stopIndex, totalStops, driverLat, driverLng, onMarkArrived, onMarkDelivered }: Props) {
  const { order } = stop;
  if (!order) return null;

  const addrFull = [order.kunde_adresse, order.kunde_plz].filter(Boolean).join(', ');
  const addrEncoded = encodeURIComponent(addrFull);

  const distM = driverLat && driverLng && order.kunde_lat && order.kunde_lng
    ? haversineM(driverLat, driverLng, order.kunde_lat, order.kunde_lng)
    : null;

  const isCash = order.zahlungsart === 'bar';
  const isArrived = !!stop.angekommen_am;
  const isDelivered = !!stop.geliefert_am;

  return (
    <div className={cn(
      'rounded-2xl border-2 overflow-hidden',
      isDelivered ? 'border-matcha-400 bg-matcha-950/30' :
      isArrived ? 'border-blue-400 bg-blue-950/20' :
      'border-white/15 bg-white/5',
    )}>
      {/* Stop counter + Distance */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <span className={cn(
          'rounded-full h-8 w-8 flex items-center justify-center text-sm font-black shrink-0',
          isDelivered ? 'bg-matcha-500 text-white' :
          isArrived ? 'bg-blue-500 text-white' : 'bg-accent/20 text-accent',
        )}>
          {isDelivered ? '✓' : stopIndex}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-widest text-matcha-400">
            Stop {stopIndex} von {totalStops}
          </div>
          <div className="text-sm font-bold text-white leading-tight truncate">{order.kunde_name}</div>
        </div>
        {distM !== null && (
          <div className={cn(
            'text-right shrink-0',
            distM < 200 ? 'text-accent' : 'text-matcha-300',
          )}>
            <div className="text-lg font-black leading-none">
              {distM < 1000 ? `${Math.round(distM)}m` : `${(distM / 1000).toFixed(1)}km`}
            </div>
            {distM < 200 && (
              <div className="text-[10px] font-bold text-accent animate-pulse">Nah!</div>
            )}
          </div>
        )}
      </div>

      {/* Address */}
      <div className="px-4 pb-2">
        <div className="flex items-start gap-2 rounded-xl bg-white/5 px-3 py-2.5">
          <MapPin size={14} className="text-matcha-400 shrink-0 mt-0.5" />
          <span className="text-sm font-medium text-white leading-snug">{addrFull || 'Adresse nicht verfügbar'}</span>
        </div>
      </div>

      {/* Customer note */}
      {order.kunde_notiz && (
        <div className="mx-4 mb-2 flex items-start gap-2 rounded-xl bg-amber-500/15 border border-amber-500/30 px-3 py-2">
          <MessageSquare size={12} className="text-amber-400 shrink-0 mt-0.5" />
          <span className="text-xs text-amber-200 leading-snug">{order.kunde_notiz}</span>
        </div>
      )}

      {/* Delivery hint */}
      {order.kunde_lieferhinweis && (
        <div className="mx-4 mb-2 flex items-start gap-2 rounded-xl bg-blue-500/15 border border-blue-500/30 px-3 py-2">
          <AlertCircle size={12} className="text-blue-400 shrink-0 mt-0.5" />
          <span className="text-xs text-blue-200 leading-snug">{order.kunde_lieferhinweis}</span>
        </div>
      )}

      {/* Payment + Phone */}
      <div className="px-4 pb-3 flex gap-2">
        <div className={cn(
          'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 flex-1',
          isCash && !order.bezahlt ? 'bg-amber-500/20 border border-amber-500/40' : 'bg-white/5',
        )}>
          {isCash ? <Banknote size={13} className={isCash && !order.bezahlt ? 'text-amber-400' : 'text-matcha-400'} /> : <CreditCard size={13} className="text-matcha-400" />}
          <div>
            <div className={cn('text-xs font-black', isCash && !order.bezahlt ? 'text-amber-300' : 'text-matcha-300')}>
              {order.gesamtbetrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
            </div>
            <div className="text-[10px] text-matcha-500">{isCash ? (order.bezahlt ? 'Bar · bezahlt' : 'Bar einziehen!') : 'Online · bezahlt'}</div>
          </div>
        </div>
        {order.kunde_telefon && (
          <a
            href={`tel:${order.kunde_telefon}`}
            className="flex items-center justify-center h-full aspect-square rounded-lg bg-white/5 border border-white/10"
          >
            <Phone size={16} className="text-matcha-300" />
          </a>
        )}
      </div>

      {/* Navigation buttons */}
      {!isDelivered && addrFull && (
        <div className="px-4 pb-3 grid grid-cols-3 gap-2">
          <a href={`https://maps.google.com?q=${addrEncoded}`} target="_blank" rel="noreferrer"
            className="flex flex-col items-center justify-center rounded-xl bg-blue-600 py-2.5 text-white active:opacity-80">
            <span className="text-lg">🗺</span>
            <span className="text-[10px] font-bold mt-0.5">Google</span>
          </a>
          <a href={`https://waze.com/ul?q=${addrEncoded}&navigate=yes`} target="_blank" rel="noreferrer"
            className="flex flex-col items-center justify-center rounded-xl bg-[#05C8F7] py-2.5 text-white active:opacity-80">
            <span className="text-lg">🚗</span>
            <span className="text-[10px] font-bold mt-0.5">Waze</span>
          </a>
          <a href={`https://maps.apple.com?q=${addrEncoded}`} target="_blank" rel="noreferrer"
            className="flex flex-col items-center justify-center rounded-xl bg-white/10 border border-white/20 py-2.5 text-white active:opacity-80">
            <span className="text-lg">🍎</span>
            <span className="text-[10px] font-bold mt-0.5">Apple</span>
          </a>
        </div>
      )}

      {/* Action buttons */}
      {!isDelivered && (
        <div className="px-4 pb-4">
          {!isArrived ? (
            <button
              onClick={() => onMarkArrived(stop.id)}
              className="w-full rounded-2xl bg-blue-500 py-4 text-white font-black text-base active:scale-[0.98] transition"
            >
              <Navigation className="inline mr-2" size={18} />
              Angekommen
            </button>
          ) : (
            <button
              onClick={() => onMarkDelivered(stop.id)}
              className="w-full rounded-2xl bg-matcha-500 py-4 text-white font-black text-base active:scale-[0.98] transition"
            >
              <CheckCircle2 className="inline mr-2" size={18} />
              Geliefert ✓
            </button>
          )}
        </div>
      )}

      {isDelivered && (
        <div className="flex items-center gap-2 px-4 pb-4">
          <CheckCircle2 size={16} className="text-matcha-400" />
          <span className="text-sm font-bold text-matcha-300">
            Geliefert um {new Date(stop.geliefert_am!).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}
    </div>
  );
}

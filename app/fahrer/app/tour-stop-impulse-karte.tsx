'use client';

import { useState } from 'react';
import { MapPin, Navigation, Phone, Clock, ChevronRight, Package, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type StopData = {
  orderId: string;
  orderNr: string;
  address: string;
  customerName: string;
  phone?: string | null;
  etaMin: number | null;
  timeWindowStart?: string | null;
  timeWindowEnd?: string | null;
  notes?: string | null;
  stopIndex: number;
  totalStops: number;
  isOverdue: boolean;
};

function waze(address: string) {
  return `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
}

function gmaps(address: string) {
  return `https://maps.google.com/?daddr=${encodeURIComponent(address)}`;
}

export function TourStopImpulseKarte({ stop, onConfirm }: {
  stop: StopData | null;
  onConfirm?: (orderId: string) => void;
}) {
  const [confirmed, setConfirmed] = useState(false);

  if (!stop) return null;

  const handleConfirm = () => {
    setConfirmed(true);
    onConfirm?.(stop.orderId);
  };

  return (
    <div className={cn(
      'rounded-2xl border-2 overflow-hidden shadow-sm',
      stop.isOverdue ? 'border-red-300 bg-red-50' : 'border-matcha-300 bg-matcha-50',
    )}>
      {/* Header strip */}
      <div className={cn(
        'flex items-center justify-between px-4 py-2',
        stop.isOverdue ? 'bg-red-100' : 'bg-matcha-100',
      )}>
        <div className="flex items-center gap-2">
          {stop.isOverdue
            ? <AlertCircle className="h-4 w-4 text-red-600" />
            : <Package className="h-4 w-4 text-matcha-600" />
          }
          <span className={cn('text-xs font-black uppercase tracking-wider', stop.isOverdue ? 'text-red-700' : 'text-matcha-700')}>
            Stopp {stop.stopIndex} / {stop.totalStops}
          </span>
        </div>
        <span className="text-[10px] font-bold text-muted-foreground">{stop.orderNr}</span>
      </div>

      {/* Main content */}
      <div className="px-4 py-3 space-y-2.5">
        {/* Customer */}
        <div>
          <div className="text-base font-black text-foreground">{stop.customerName}</div>
          <div className="flex items-start gap-1 mt-0.5">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <span className="text-xs text-muted-foreground leading-tight">{stop.address}</span>
          </div>
        </div>

        {/* ETA + time window */}
        {(stop.etaMin !== null || stop.timeWindowEnd) && (
          <div className="flex items-center gap-3 text-xs">
            {stop.etaMin !== null && (
              <span className={cn(
                'flex items-center gap-1 font-bold',
                stop.etaMin <= 2 ? 'text-red-600' : stop.etaMin <= 7 ? 'text-amber-600' : 'text-matcha-700',
              )}>
                <Clock className="h-3.5 w-3.5" />
                ~{stop.etaMin} Min
              </span>
            )}
            {stop.timeWindowEnd && (
              <span className="text-muted-foreground">
                bis {new Date(stop.timeWindowEnd).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        )}

        {/* Notes */}
        {stop.notes && (
          <div className="rounded-lg bg-white/70 border px-3 py-2 text-[11px] text-foreground italic">
            {stop.notes}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-1">
          <a
            href={waze(stop.address)}
            target="_blank"
            rel="noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 text-white py-2.5 text-xs font-bold shadow-sm active:scale-95 transition"
          >
            <Navigation className="h-3.5 w-3.5" />
            Waze
          </a>
          <a
            href={gmaps(stop.address)}
            target="_blank"
            rel="noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-white border border-matcha-300 text-matcha-700 py-2.5 text-xs font-bold shadow-sm active:scale-95 transition"
          >
            <MapPin className="h-3.5 w-3.5" />
            Maps
          </a>
          {stop.phone && (
            <a
              href={`tel:${stop.phone}`}
              className="flex items-center justify-center rounded-xl bg-white border border-muted p-2.5 active:scale-95 transition"
            >
              <Phone className="h-4 w-4 text-muted-foreground" />
            </a>
          )}
        </div>

        {/* Confirm delivery */}
        {!confirmed ? (
          <button
            onClick={handleConfirm}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-matcha-600 text-white py-3 text-sm font-black shadow active:scale-95 transition mt-1"
          >
            <CheckCircle2 className="h-4 w-4" />
            Geliefert bestätigen
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <div className="w-full flex items-center justify-center gap-2 rounded-xl bg-matcha-100 text-matcha-700 py-3 text-sm font-black border border-matcha-200">
            <CheckCircle2 className="h-4 w-4" />
            Bestätigt ✓
          </div>
        )}
      </div>
    </div>
  );
}

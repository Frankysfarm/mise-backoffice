'use client';

import { useState } from 'react';
import { MapPin, CheckCircle2, Phone, MessageSquare, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Stop {
  id: string;
  sequence: number;
  address: string;
  customer_name: string;
  order_id: string;
  bestellnummer: string;
  lat?: number | null;
  lng?: number | null;
  customer_phone?: string | null;
}

interface Props {
  stop: Stop;
  onMarkDelivered: (stopId: string) => void;
  isPending?: boolean;
}

function openNavigation(lat?: number | null, lng?: number | null, address?: string) {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (lat && lng) {
    const url = isMobile
      ? `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank');
  } else if (address) {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
  }
}

export function StopAbschlussSchnellPanel({ stop, onMarkDelivered, isPending }: Props) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-blue-300">
          <Package className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-white truncate">Stopp #{stop.sequence} · #{stop.bestellnummer}</div>
          <div className="text-[10px] text-slate-400 truncate">{stop.customer_name}</div>
        </div>
        <span className="shrink-0 rounded-full bg-blue-500/20 px-2 py-0.5 text-[9px] font-bold text-blue-300">Aktuell</span>
      </div>

      {/* Address */}
      <div className="px-4 py-3 flex items-start gap-2">
        <MapPin className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
        <span className="text-[11px] text-slate-300 leading-snug">{stop.address}</span>
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 grid grid-cols-3 gap-2">
        <button
          onClick={() => openNavigation(stop.lat, stop.lng, stop.address)}
          className="flex flex-col items-center gap-1 rounded-xl bg-blue-500/20 border border-blue-400/30 px-2 py-2.5 text-blue-300 hover:bg-blue-500/30 transition"
        >
          <MapPin className="h-4 w-4" />
          <span className="text-[9px] font-bold">Navi</span>
        </button>
        {stop.customer_phone && (
          <a
            href={`tel:${stop.customer_phone}`}
            className="flex flex-col items-center gap-1 rounded-xl bg-white/10 border border-white/20 px-2 py-2.5 text-slate-300 hover:bg-white/20 transition"
          >
            <Phone className="h-4 w-4" />
            <span className="text-[9px] font-bold">Anruf</span>
          </a>
        )}
        <button
          onClick={() => {
            if (!confirming) { setConfirming(true); return; }
            onMarkDelivered(stop.id);
          }}
          disabled={isPending}
          className={cn(
            'flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 transition col-span-1',
            confirming
              ? 'bg-matcha-600 border-matcha-500 text-white animate-pulse'
              : 'bg-matcha-700/30 border-matcha-600/40 text-matcha-300 hover:bg-matcha-700/50',
            isPending && 'opacity-50 cursor-not-allowed',
          )}
        >
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-[9px] font-bold leading-tight text-center">
            {confirming ? 'Bestätigen!' : 'Zugestellt'}
          </span>
        </button>
      </div>

      {confirming && (
        <div className="mx-4 mb-4 rounded-xl bg-matcha-700/20 border border-matcha-600/30 px-3 py-2 flex items-center gap-2">
          <MessageSquare className="h-3.5 w-3.5 text-matcha-400 shrink-0" />
          <span className="text-[10px] text-matcha-300">
            Nochmal tippen zum Bestätigen oder woanders tippen zum Abbrechen
          </span>
        </div>
      )}
    </div>
  );
}

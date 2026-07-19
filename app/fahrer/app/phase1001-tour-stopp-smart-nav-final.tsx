'use client';

/**
 * Phase 1001 — Tour-Stopp Smart-Nav Final
 * Hero-Karte für aktuellen Stopp + kompakte Stopp-Liste + GPS-Button.
 * Mobile-first, Matcha-Theme, on-map open support.
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  MapPin, Phone, CheckCircle2, Navigation2, ChevronDown, ChevronUp,
  Package, Clock, AlertTriangle, ExternalLink,
} from 'lucide-react';

export interface SmartNavStop {
  id: string;
  sequence: number;
  status: 'pending' | 'active' | 'completed';
  address: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  lat?: number;
  lng?: number;
  orderId?: string;
  orderTotal?: number;
  paymentMethod?: 'bar' | 'online' | string;
  etaMin?: number;
}

interface Props {
  stops: SmartNavStop[];
  onStopComplete?: (stopId: string) => void;
  driverId?: string;
}

function openNavi(lat?: number, lng?: number, address?: string) {
  const q = lat && lng ? `${lat},${lng}` : encodeURIComponent(address ?? '');
  const ua = navigator.userAgent;
  if (/iphone|ipad/i.test(ua)) {
    window.open(`maps://maps.apple.com/?daddr=${q}`, '_blank');
  } else {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${q}`, '_blank');
  }
}

function payLabel(method?: string) {
  if (!method || method === 'online') return null;
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
      BAR {method !== 'bar' ? `(${method})` : ''}
    </span>
  );
}

export function FahrerPhase1001TourStoppSmartNavFinal({ stops, onStopComplete }: Props) {
  const [listOpen, setListOpen] = useState(false);

  if (!stops.length) return null;

  const activeIdx = stops.findIndex(s => s.status === 'active');
  const active = activeIdx >= 0 ? stops[activeIdx] : null;
  const done = stops.filter(s => s.status === 'completed').length;
  const total = stops.length;
  const progress = total > 0 ? done / total : 0;

  return (
    <div className="rounded-2xl border border-matcha-200 bg-white shadow-md overflow-hidden">
      {/* Fortschrittsbalken */}
      <div className="h-1 bg-gray-100">
        <div
          className="h-full bg-matcha-500 transition-all duration-700"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>

      {/* Status strip */}
      <div className="flex items-center gap-3 px-4 py-2 bg-matcha-50">
        <div className="flex items-center gap-1 text-xs font-bold text-matcha-700">
          <Package className="h-3.5 w-3.5" />
          <span>{done}/{total} Stopps</span>
        </div>
        {active?.etaMin != null && (
          <div className="flex items-center gap-1 text-xs text-matcha-600">
            <Clock className="h-3.5 w-3.5" />
            <span>ETA ~{active.etaMin} min</span>
          </div>
        )}
        <button
          onClick={() => setListOpen(o => !o)}
          className="ml-auto flex items-center gap-1 text-xs font-medium text-matcha-600"
        >
          Alle Stopps
          {listOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Aktiver Stopp — Hero */}
      {active && (
        <div className="px-4 py-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-matcha-500 text-white font-black text-sm shrink-0">
              {active.sequence}
            </div>
            <div className="min-w-0 flex-1">
              {active.customerName && (
                <div className="text-base font-bold text-gray-800 truncate">{active.customerName}</div>
              )}
              <div className="flex items-start gap-1 mt-0.5">
                <MapPin className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                <span className="text-sm text-gray-600 leading-snug">{active.address}</span>
              </div>
              {active.notes && (
                <div className="mt-1 flex items-start gap-1 text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span className="leading-snug">{active.notes}</span>
                </div>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {active.orderTotal != null && (
                  <span className="text-sm font-bold text-gray-700">
                    €{active.orderTotal.toFixed(2)}
                  </span>
                )}
                {payLabel(active.paymentMethod)}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => openNavi(active.lat, active.lng, active.address)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-matcha-500 px-4 py-3 text-sm font-bold text-white active:bg-matcha-600 transition"
            >
              <Navigation2 className="h-4 w-4" />
              Navigation starten
            </button>
            {active.customerPhone && (
              <a
                href={`tel:${active.customerPhone}`}
                className="flex items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-bold text-gray-700 active:bg-gray-50 transition"
              >
                <Phone className="h-4 w-4 text-gray-500" />
              </a>
            )}
            {onStopComplete && (
              <button
                onClick={() => onStopComplete(active.id)}
                className="flex items-center justify-center gap-1 rounded-xl bg-emerald-500 px-3 py-3 text-white active:bg-emerald-600 transition"
              >
                <CheckCircle2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Stopp-Liste (aufklappbar) */}
      {listOpen && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {stops.map((stop) => (
            <div
              key={stop.id}
              className={cn(
                'flex items-center gap-3 px-4 py-3 transition',
                stop.status === 'completed' && 'opacity-50',
                stop.status === 'active' && 'bg-matcha-50',
              )}
            >
              <div className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full font-bold text-xs shrink-0',
                stop.status === 'completed' ? 'bg-emerald-100 text-emerald-600' :
                stop.status === 'active' ? 'bg-matcha-500 text-white' :
                'bg-gray-100 text-gray-500'
              )}>
                {stop.status === 'completed' ? '✓' : stop.sequence}
              </div>
              <div className="min-w-0 flex-1">
                {stop.customerName && (
                  <div className="text-xs font-bold text-gray-700 truncate">{stop.customerName}</div>
                )}
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-gray-400 shrink-0" />
                  <span className="text-xs text-gray-500 truncate">{stop.address}</span>
                </div>
              </div>
              {stop.status !== 'completed' && (
                <button
                  onClick={() => openNavi(stop.lat, stop.lng, stop.address)}
                  className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition shrink-0"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {done === total && total > 0 && (
        <div className="flex items-center justify-center gap-2 py-4 bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-bold text-sm">Alle Stopps erledigt!</span>
        </div>
      )}
    </div>
  );
}

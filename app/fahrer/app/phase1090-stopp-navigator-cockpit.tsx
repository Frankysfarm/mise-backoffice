'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Navigation, Phone, CheckCircle2, AlertTriangle, Clock, Package, ChevronRight, ExternalLink } from 'lucide-react';

interface Stop {
  id: string;
  address?: string;
  adresse?: string;
  customer_name?: string;
  kunde_name?: string;
  phone?: string;
  telefon?: string;
  lat?: number | null;
  lng?: number | null;
  eta_min?: number | null;
  order_id?: string;
  bestellnummer?: string;
  status?: string;
  sequence?: number;
  reihenfolge?: number;
  notes?: string;
  hinweise?: string;
}

interface Props {
  stops?: Stop[];
  currentStopId?: string | null;
  driverId?: string;
  onConfirmArrival?: (stopId: string) => void;
  onConfirmDelivery?: (stopId: string) => void;
  onReportIssue?: (stopId: string) => void;
}

function openNavigation(address: string, lat?: number | null, lng?: number | null) {
  if (lat && lng) {
    const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    window.open(googleUrl, '_blank');
  } else {
    const encoded = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=driving`, '_blank');
  }
}

function openWaze(address: string, lat?: number | null, lng?: number | null) {
  if (lat && lng) {
    window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`, '_blank');
  } else {
    const encoded = encodeURIComponent(address);
    window.open(`https://waze.com/ul?q=${encoded}&navigate=yes`, '_blank');
  }
}

export function FahrerPhase1090StoppNavigatorCockpit({
  stops = [],
  currentStopId,
  driverId,
  onConfirmArrival,
  onConfirmDelivery,
  onReportIssue,
}: Props) {
  const [activeStopId, setActiveStopId] = useState<string | null>(currentStopId ?? null);
  const [showAllStops, setShowAllStops] = useState(false);

  useEffect(() => {
    if (currentStopId) setActiveStopId(currentStopId);
  }, [currentStopId]);

  const pendingStops = stops.filter(s =>
    !s.status || ['pending', 'assigned', 'en_route'].includes(s.status)
  ).sort((a, b) => (a.sequence ?? a.reihenfolge ?? 99) - (b.sequence ?? b.reihenfolge ?? 99));

  const currentStop = pendingStops.find(s => s.id === activeStopId) ?? pendingStops[0];
  const nextStop = pendingStops[1];
  const completedCount = stops.length - pendingStops.length;

  if (pendingStops.length === 0) {
    return (
      <div className="mx-4 my-2 rounded-2xl border border-matcha-200 bg-matcha-50 px-5 py-4 flex items-center gap-3">
        <CheckCircle2 className="w-8 h-8 text-matcha-600 shrink-0" />
        <div>
          <div className="font-black text-matcha-800 text-sm">Alle Stopps erledigt!</div>
          <div className="text-xs text-matcha-600">{completedCount} Lieferung{completedCount !== 1 ? 'en' : ''} abgeschlossen</div>
        </div>
      </div>
    );
  }

  const address = currentStop?.address ?? currentStop?.adresse ?? '';
  const customerName = currentStop?.customer_name ?? currentStop?.kunde_name ?? '';
  const phone = currentStop?.phone ?? currentStop?.telefon ?? '';
  const notes = currentStop?.notes ?? currentStop?.hinweise ?? '';

  return (
    <div className="mx-4 my-2 space-y-2">
      {/* Current Stop Card */}
      <div className="rounded-2xl border-2 border-blue-300 bg-white overflow-hidden shadow-md">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-blue-600">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-white" />
            <span className="text-xs font-black text-white uppercase tracking-wider">
              Stopp {(currentStop?.sequence ?? currentStop?.reihenfolge ?? 1)} von {pendingStops.length + completedCount}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {completedCount > 0 && (
              <span className="text-[10px] bg-white/20 text-white rounded-full px-2 py-0.5 font-bold">
                {completedCount} erledigt
              </span>
            )}
            {currentStop?.eta_min != null && (
              <span className="flex items-center gap-1 text-[10px] bg-white/20 text-white rounded-full px-2 py-0.5 font-bold">
                <Clock className="w-2.5 h-2.5" /> ~{currentStop.eta_min} min
              </span>
            )}
          </div>
        </div>

        {/* Address */}
        <div className="px-4 pt-3 pb-2">
          {customerName && (
            <div className="text-xs font-bold text-stone-500 mb-0.5">{customerName}</div>
          )}
          <div className="text-base font-black text-stone-900 leading-tight">{address || 'Adresse nicht verfügbar'}</div>
          {currentStop?.bestellnummer && (
            <div className="text-[10px] text-stone-400 mt-0.5 flex items-center gap-1">
              <Package className="w-2.5 h-2.5" /> Bestellung #{currentStop.bestellnummer}
            </div>
          )}
          {notes && (
            <div className="mt-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
              {notes}
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="px-4 pb-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => openNavigation(address, currentStop?.lat, currentStop?.lng)}
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white text-xs font-bold py-2.5 hover:bg-blue-700 transition-colors"
          >
            <Navigation className="w-3.5 h-3.5" />
            Google Maps
          </button>
          <button
            onClick={() => openWaze(address, currentStop?.lat, currentStop?.lng)}
            className="flex items-center justify-center gap-2 rounded-xl bg-sky-500 text-white text-xs font-bold py-2.5 hover:bg-sky-600 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Waze
          </button>
        </div>

        {/* Action Buttons */}
        <div className="px-4 pb-3 grid grid-cols-3 gap-2">
          {phone && (
            <a
              href={`tel:${phone}`}
              className="flex flex-col items-center gap-1 rounded-xl border border-stone-200 bg-stone-50 py-2 hover:bg-stone-100 transition-colors"
            >
              <Phone className="w-4 h-4 text-stone-600" />
              <span className="text-[9px] font-bold text-stone-600">Anrufen</span>
            </a>
          )}
          {onConfirmArrival && currentStop && (
            <button
              onClick={() => onConfirmArrival(currentStop.id)}
              className="flex flex-col items-center gap-1 rounded-xl border border-matcha-300 bg-matcha-50 py-2 hover:bg-matcha-100 transition-colors"
            >
              <MapPin className="w-4 h-4 text-matcha-600" />
              <span className="text-[9px] font-bold text-matcha-700">Angekommen</span>
            </button>
          )}
          {onConfirmDelivery && currentStop && (
            <button
              onClick={() => onConfirmDelivery(currentStop.id)}
              className="flex flex-col items-center gap-1 rounded-xl border border-blue-300 bg-blue-50 py-2 hover:bg-blue-100 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              <span className="text-[9px] font-bold text-blue-700">Geliefert</span>
            </button>
          )}
          {onReportIssue && currentStop && (
            <button
              onClick={() => onReportIssue(currentStop.id)}
              className="flex flex-col items-center gap-1 rounded-xl border border-red-200 bg-red-50 py-2 hover:bg-red-100 transition-colors"
            >
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-[9px] font-bold text-red-600">Problem</span>
            </button>
          )}
        </div>
      </div>

      {/* Next Stop Preview */}
      {nextStop && (
        <button
          onClick={() => setShowAllStops(v => !v)}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 transition-colors text-left"
        >
          <ChevronRight className="w-4 h-4 text-stone-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-stone-400 font-medium">Nächster Stopp</div>
            <div className="text-xs font-bold text-stone-700 truncate">
              {nextStop.address ?? nextStop.adresse ?? 'Adresse laden…'}
            </div>
          </div>
          {pendingStops.length > 2 && (
            <span className="text-[10px] text-stone-400 shrink-0">+{pendingStops.length - 2} weitere</span>
          )}
        </button>
      )}

      {/* All Stops List */}
      {showAllStops && pendingStops.length > 1 && (
        <div className="rounded-xl border border-stone-200 bg-white divide-y divide-stone-100">
          {pendingStops.slice(1).map((stop, idx) => (
            <div key={stop.id} className="flex items-center gap-3 px-3 py-2">
              <span className="w-5 h-5 rounded-full bg-stone-100 text-stone-500 text-[9px] font-black flex items-center justify-center shrink-0">
                {idx + 2}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-stone-700 truncate">
                  {stop.address ?? stop.adresse}
                </div>
                {stop.customer_name && (
                  <div className="text-[9px] text-stone-400">{stop.customer_name}</div>
                )}
              </div>
              {stop.eta_min != null && (
                <span className="text-[9px] text-stone-400 tabular-nums shrink-0">~{stop.eta_min}m</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Navigation, Phone, Clock, CheckCircle2, Package, ChevronRight, Zap } from 'lucide-react';

interface TourStopp {
  id: string;
  address: string;
  customer: string;
  phone?: string | null;
  etaMin: number;
  distanceM: number;
  status: 'pending' | 'current' | 'done';
  orderId: string;
  orderNr: string;
  items: string[];
  notes?: string | null;
  lat?: number | null;
  lng?: number | null;
}

interface Props {
  stops: TourStopp[];
  currentBatchId?: string | null;
  driverName?: string;
  onMarkDelivered?: (stopId: string) => void;
  onNavigate?: (stop: TourStopp) => void;
}

function formatDist(m: number): string {
  if (m < 1000) return `${m}m`;
  return `${(m / 1000).toFixed(1)} km`;
}

const MOCK_STOPS: TourStopp[] = [
  {
    id: 's1', address: 'Hauptstraße 12, 52062 Aachen', customer: 'Anna M.', phone: '+49 170 111 2233',
    etaMin: 4, distanceM: 650, status: 'current', orderId: 'o1', orderNr: '#1042',
    items: ['Burger Classic', 'Pommes L', 'Cola'], notes: '2. OG, klingeln bei Müller',
    lat: 50.776, lng: 6.084,
  },
  {
    id: 's2', address: 'Mühlenweg 5, 52066 Aachen', customer: 'Jan K.', phone: '+49 171 999 4455',
    etaMin: 12, distanceM: 1800, status: 'pending', orderId: 'o2', orderNr: '#1043',
    items: ['Pizza Margherita', 'Tiramisu'],
    lat: 50.769, lng: 6.091,
  },
  {
    id: 's3', address: 'Schulstraße 8, 52068 Aachen', customer: 'Lisa B.', phone: null,
    etaMin: 20, distanceM: 3200, status: 'pending', orderId: 'o3', orderNr: '#1044',
    items: ['Döner XL', 'Ayran', 'Baklava'],
    lat: 50.782, lng: 6.097,
  },
];

export function FahrerPhase1737TourStoppUltraFinalNavigator({
  stops = MOCK_STOPS,
  currentBatchId,
  driverName,
  onMarkDelivered,
  onNavigate,
}: Props) {
  const [tick, setTick] = useState(0);
  const [delivering, setDelivering] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 10000);
    return () => clearInterval(t);
  }, []);

  const currentStop = stops.find((s) => s.status === 'current');
  const pendingStops = stops.filter((s) => s.status === 'pending');
  const doneCount = stops.filter((s) => s.status === 'done').length;
  const totalCount = stops.length;

  const handleNavigate = (stop: TourStopp) => {
    if (onNavigate) { onNavigate(stop); return; }
    if (stop.lat && stop.lng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}`, '_blank');
    } else {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.address)}`, '_blank');
    }
  };

  const handleDeliver = async (stop: TourStopp) => {
    if (delivering) return;
    setDelivering(stop.id);
    try {
      await fetch('/api/delivery/driver/stop-delivered', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stop_id: stop.id, batch_id: currentBatchId }),
      }).catch(() => {});
      onMarkDelivered?.(stop.id);
    } finally {
      setDelivering(null);
    }
  };

  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Progress strip */}
      <div className="bg-gradient-to-r from-matcha-900 to-matcha-700 rounded-2xl p-4 text-white">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-bold opacity-80">Tour-Fortschritt</div>
          <div className="text-xs font-bold">{doneCount}/{totalCount} Stopps</div>
        </div>
        <div className="h-2 rounded-full bg-white/20 overflow-hidden mb-3">
          <div
            className="h-full rounded-full bg-white transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="opacity-70">{doneCount} erledigt · {pendingStops.length + (currentStop ? 1 : 0)} ausstehend</span>
          {currentStop && (
            <span className="flex items-center gap-1 bg-white/20 rounded-full px-2 py-0.5">
              <Zap className="h-3 w-3" /> {currentStop.etaMin} Min
            </span>
          )}
        </div>
      </div>

      {/* Current stop */}
      {currentStop && (
        <div className="bg-matcha-50 border-2 border-matcha-300 rounded-2xl p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-matcha-600 text-white flex items-center justify-center shrink-0">
                <MapPin className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-matcha-700 uppercase tracking-wide">Aktueller Stopp</div>
                <div className="text-sm font-bold text-foreground">{currentStop.orderNr} · {currentStop.customer}</div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-lg font-black tabular-nums text-matcha-700">{currentStop.etaMin} Min</div>
              <div className="text-[9px] text-matcha-600">{formatDist(currentStop.distanceM)}</div>
            </div>
          </div>

          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-matcha-500" />
            <span>{currentStop.address}</span>
          </div>

          {currentStop.notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800">
              📝 {currentStop.notes}
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            {currentStop.items.join(' · ')}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleNavigate(currentStop)}
              className="flex-1 flex items-center justify-center gap-2 bg-matcha-600 hover:bg-matcha-700 text-white font-bold text-sm py-2.5 rounded-xl transition-colors"
            >
              <Navigation className="h-4 w-4" />
              Navigieren
            </button>
            {currentStop.phone && (
              <a
                href={`tel:${currentStop.phone}`}
                className="w-11 flex items-center justify-center bg-white border border-matcha-300 rounded-xl hover:bg-matcha-50 transition-colors"
              >
                <Phone className="h-4 w-4 text-matcha-600" />
              </a>
            )}
            <button
              onClick={() => handleDeliver(currentStop)}
              disabled={delivering === currentStop.id}
              className="flex-1 flex items-center justify-center gap-2 bg-white border border-matcha-300 hover:bg-matcha-50 text-matcha-700 font-bold text-sm py-2.5 rounded-xl transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              Zugestellt
            </button>
          </div>
        </div>
      )}

      {/* Upcoming stops */}
      {pendingStops.length > 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
          <div className="px-4 py-2.5 border-b border-stone-100 flex items-center gap-2">
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-bold">Nächste Stopps</span>
            <span className="ml-auto text-[10px] text-muted-foreground">{pendingStops.length} ausstehend</span>
          </div>
          <div className="divide-y divide-stone-100">
            {pendingStops.map((stop, idx) => (
              <div key={stop.id} className="px-4 py-3 flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center text-[10px] font-bold text-stone-600 shrink-0">
                  {idx + 2}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold">{stop.orderNr} · {stop.customer}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{stop.address}</div>
                  <div className="text-[10px] text-muted-foreground">{stop.items.join(', ')}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {stop.etaMin} Min
                  </div>
                  <div className="text-[9px] text-muted-foreground">{formatDist(stop.distanceM)}</div>
                </div>
                <button
                  onClick={() => handleNavigate(stop)}
                  className="shrink-0 p-1.5 rounded-lg hover:bg-stone-100 transition text-muted-foreground"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All done state */}
      {!currentStop && pendingStops.length === 0 && doneCount > 0 && (
        <div className="rounded-2xl border border-matcha-200 bg-matcha-50 p-6 text-center">
          <CheckCircle2 className="h-12 w-12 text-matcha-600 mx-auto mb-2" />
          <div className="text-lg font-black text-matcha-900">Tour abgeschlossen!</div>
          <div className="text-sm text-matcha-700">{doneCount} Stopps erfolgreich zugestellt</div>
        </div>
      )}
    </div>
  );
}

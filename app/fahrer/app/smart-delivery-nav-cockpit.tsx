'use client';

/**
 * SmartDeliveryNavCockpit
 * Erweiterter Navigations-Hub für Fahrer im Smart Delivery System.
 * Zeigt Tour-Stops mit Live-Navigation, Countdown und Prioritäts-Reihung.
 */

import { useEffect, useState, useCallback } from 'react';
import { MapPin, Navigation, Clock, CheckCircle2, ChevronRight, Zap, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavStop {
  id: string;
  seq: number;
  address: string;
  customer_name: string;
  status: 'pending' | 'current' | 'completed';
  eta_min?: number;
  distance_km?: number;
  order_id: string;
  special_instructions?: string;
  tip_expected?: boolean;
}

interface TourState {
  tour_id: string;
  stops: NavStop[];
  total_earnings_expected: number;
  tour_score: number;
  return_eta_min: number;
}

const MOCK_TOUR: TourState = {
  tour_id: 'tour_demo',
  tour_score: 88,
  total_earnings_expected: 12.50,
  return_eta_min: 22,
  stops: [
    { id: 's1', seq: 1, address: 'Marktplatz 5, Aachen', customer_name: 'T. Müller', status: 'completed', order_id: 'o1' },
    { id: 's2', seq: 2, address: 'Pontstr. 12, Aachen', customer_name: 'A. Schmidt', status: 'current', eta_min: 2, distance_km: 0.8, order_id: 'o2', tip_expected: true },
    { id: 's3', seq: 3, address: 'Jülicher Str. 88, Aachen', customer_name: 'K. Weber', status: 'pending', eta_min: 9, distance_km: 2.1, order_id: 'o3', special_instructions: 'Klingeln 3x' },
    { id: 's4', seq: 4, address: 'Roermonder Str. 15, Aachen', customer_name: 'L. Becker', status: 'pending', eta_min: 17, distance_km: 3.4, order_id: 'o4' },
  ],
};

function useNavTour(driverId: string | null) {
  const [tour, setTour] = useState<TourState | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!driverId) {
      setTour(MOCK_TOUR);
      setLoading(false);
      return;
    }
    try {
      const r = await fetch(`/api/delivery/fahrer/tour?driver_id=${driverId}`, { cache: 'no-store' });
      if (r.ok) setTour(await r.json());
      else setTour(MOCK_TOUR);
    } catch {
      setTour(MOCK_TOUR);
    }
    setLoading(false);
  }, [driverId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, [load]);

  return { tour, loading };
}

function openGoogleMaps(address: string) {
  const encoded = encodeURIComponent(address);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS) {
    window.open(`comgooglemaps://?daddr=${encoded}&directionsmode=driving`, '_blank');
    setTimeout(() => window.open(`maps://maps.apple.com/?daddr=${encoded}`, '_blank'), 300);
  } else {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=bicycling`, '_blank');
  }
}

export function SmartDeliveryNavCockpit({ driverId }: { driverId?: string | null }) {
  const { tour, loading } = useNavTour(driverId ?? null);
  const [confirming, setConfirming] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="rounded-2xl bg-[#111827] p-4 animate-pulse">
        <div className="h-5 bg-white/10 rounded w-32 mb-3" />
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-14 bg-white/5 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!tour) {
    return (
      <div className="rounded-2xl bg-[#111827] p-4 text-center text-white/50 text-sm py-8">
        <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
        Keine aktive Tour
      </div>
    );
  }

  const currentStop = tour.stops.find(s => s.status === 'current');
  const pendingStops = tour.stops.filter(s => s.status === 'pending');
  const completedCount = tour.stops.filter(s => s.status === 'completed').length;
  const totalCount = tour.stops.length;

  const handleConfirmDelivery = async (stopId: string) => {
    setConfirming(stopId);
    try {
      await fetch(`/api/delivery/fahrer/stop-confirm`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stop_id: stopId, driver_id: driverId }),
      });
    } catch {}
    setTimeout(() => setConfirming(null), 1500);
  };

  return (
    <div className="rounded-2xl bg-[#111827] overflow-hidden text-white">
      {/* Header */}
      <div className="px-4 py-3 bg-[#1f2937] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="w-5 h-5 text-blue-400" />
          <div>
            <div className="text-sm font-bold">Tour-Navigator</div>
            <div className="text-[10px] text-white/50">{completedCount}/{totalCount} Stopps · zurück in {tour.return_eta_min}m</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-black text-green-400">+€{tour.total_earnings_expected.toFixed(2)}</div>
          <div className="text-[9px] text-white/40">erwartet</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1.5 bg-white/10">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-700"
          style={{ width: `${(completedCount / totalCount) * 100}%` }}
        />
      </div>

      {/* Current Stop (Hero) */}
      {currentStop && (
        <div className="px-4 py-3 bg-blue-600/20 border-b border-white/10">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-xs font-black shrink-0">
              {currentStop.seq}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] font-semibold text-blue-300 uppercase tracking-wide">Aktueller Stopp</span>
                {currentStop.tip_expected && (
                  <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 rounded-full font-bold">Trinkgeld</span>
                )}
              </div>
              <div className="text-sm font-bold text-white leading-tight truncate">{currentStop.customer_name}</div>
              <div className="text-xs text-white/60 truncate mt-0.5">{currentStop.address}</div>
              {currentStop.special_instructions && (
                <div className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5" />{currentStop.special_instructions}
                </div>
              )}
            </div>
            <div className="text-right shrink-0">
              {currentStop.eta_min !== undefined && (
                <div className="text-lg font-black text-white tabular-nums">{currentStop.eta_min}m</div>
              )}
              {currentStop.distance_km && (
                <div className="text-[9px] text-white/40 tabular-nums">{currentStop.distance_km}km</div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => openGoogleMaps(currentStop.address)}
              className="flex-1 flex items-center justify-center gap-1.5 bg-blue-500 hover:bg-blue-400 active:scale-95 text-white text-xs font-bold py-2.5 rounded-xl transition-all"
            >
              <Navigation className="w-3.5 h-3.5" />
              Navigieren
            </button>
            <button
              onClick={() => handleConfirmDelivery(currentStop.id)}
              disabled={confirming === currentStop.id}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 rounded-xl transition-all active:scale-95',
                confirming === currentStop.id
                  ? 'bg-green-500 text-white'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              )}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {confirming === currentStop.id ? 'Bestätigt!' : 'Zugestellt'}
            </button>
          </div>
        </div>
      )}

      {/* Next Stops */}
      <div className="divide-y divide-white/5">
        {pendingStops.map((stop, idx) => (
          <div key={stop.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-white/5 transition-colors">
            <div className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 border',
              idx === 0 ? 'border-white/30 text-white/70 bg-white/5' : 'border-white/10 text-white/30'
            )}>
              {stop.seq}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white/80 truncate">{stop.customer_name}</div>
              <div className="text-[10px] text-white/40 truncate">{stop.address.split(',')[0]}</div>
            </div>
            <div className="text-right shrink-0">
              {stop.eta_min && (
                <div className="text-xs font-bold text-white/60 tabular-nums">~{stop.eta_min}m</div>
              )}
              {stop.distance_km && (
                <div className="text-[9px] text-white/30">{stop.distance_km}km</div>
              )}
            </div>
            <ChevronRight className="w-3 h-3 text-white/20 shrink-0" />
          </div>
        ))}
      </div>

      {/* Completed Stops (collapsed) */}
      {completedCount > 0 && (
        <div className="px-4 py-2 border-t border-white/10 flex items-center gap-2 text-[10px] text-white/30">
          <CheckCircle2 className="w-3 h-3 text-green-500/60" />
          {completedCount} Stopp{completedCount > 1 ? 's' : ''} zugestellt
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2 bg-[#0f172a] flex items-center justify-between text-[9px] text-white/30">
        <span className="flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />
          Score: <span className="text-white/60 font-bold ml-0.5">{tour.tour_score}</span>
        </span>
        <span>Smart Nav · mise</span>
      </div>
    </div>
  );
}

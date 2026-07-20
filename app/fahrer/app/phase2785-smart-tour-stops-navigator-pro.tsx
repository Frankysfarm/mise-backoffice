'use client';

/**
 * Phase 2785 — Smart Tour-Stops Navigator Pro
 * Aktiver Stopp hervorgehoben + Nächste-Stopps-Liste
 * + One-Tap-Navigation Google Maps/Waze + Kunden-Anruf
 * + ETA-Countdown + Fortschrittsring + Stopp-Bestätigung
 * Polling: 15 Sek. + 1-Sek-Tick
 */

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  MapPin, Phone, Navigation, CheckCircle2, Clock, ChevronRight,
  AlertTriangle, Bike, Timer, Map, Package
} from 'lucide-react';

interface Stop {
  id: string;
  sequence: number;
  status: 'pending' | 'driving' | 'arrived' | 'completed' | 'failed';
  address: string;
  customer_name: string | null;
  customer_phone: string | null;
  eta_min: number | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
}

interface TourData {
  tour_id: string;
  stops: Stop[];
  stops_done: number;
  stops_total: number;
  eta_done_min: number | null;
}

const MOCK_TOUR: TourData = {
  tour_id: 't1',
  stops_done: 2,
  stops_total: 5,
  eta_done_min: 35,
  stops: [
    { id: 's1', sequence: 1, status: 'completed', address: 'Hauptstraße 5, Berlin', customer_name: 'Müller', customer_phone: '+4930123456', eta_min: null, lat: 52.52, lng: 13.405, notes: null },
    { id: 's2', sequence: 2, status: 'completed', address: 'Bergweg 12, Berlin', customer_name: 'Schmidt', customer_phone: '+4930234567', eta_min: null, lat: 52.525, lng: 13.41, notes: 'Klingel 3. OG' },
    { id: 's3', sequence: 3, status: 'driving', address: 'Gartenstraße 3, Berlin', customer_name: 'Weber', customer_phone: '+4930345678', eta_min: 4, lat: 52.53, lng: 13.415, notes: null },
    { id: 's4', sequence: 4, status: 'pending', address: 'Parkstraße 7, Berlin', customer_name: 'Becker', customer_phone: '+4930456789', eta_min: 14, lat: 52.535, lng: 13.42, notes: 'Seiteneingang' },
    { id: 's5', sequence: 5, status: 'pending', address: 'Schillerstraße 22, Berlin', customer_name: 'Braun', customer_phone: '+4930567890', eta_min: 26, lat: 52.54, lng: 13.425, notes: null },
  ],
};

function secsLeft(min: number | null): number | null {
  if (min === null) return null;
  return min * 60;
}

function fmtMmSs(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface Props {
  driverId?: string | null;
  isOnline?: boolean;
}

export function FahrerPhase2785SmartTourStopsNavigatorPro({ driverId, isOnline = true }: Props) {
  const [tour, setTour] = useState<TourData | null>(MOCK_TOUR);
  const [tick, setTick] = useState(0);
  const [confirming, setConfirming] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      if (!driverId) { setTour(MOCK_TOUR); return; }
      const { data } = await supabase
        .from('tours')
        .select('id,stops:tour_stops(*)')
        .eq('driver_id', driverId)
        .eq('status', 'aktiv')
        .single();
      if (data) {
        const stops = (data.stops as Stop[] || []).sort((a, b) => a.sequence - b.sequence);
        const done = stops.filter(s => s.status === 'completed').length;
        setTour({ tour_id: data.id, stops, stops_done: done, stops_total: stops.length, eta_done_min: null });
      }
    }
    load();
    const poll = setInterval(load, 15_000);
    const tick = setInterval(() => setTick(t => t + 1), 1_000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [driverId]);

  if (!isOnline || !tour) return null;

  const activeStop = tour.stops.find(s => s.status === 'driving');
  const nextStops = tour.stops.filter(s => s.status === 'pending');
  const progress = Math.round((tour.stops_done / Math.max(tour.stops_total, 1)) * 100);

  const openNav = (stop: Stop, app: 'google' | 'waze') => {
    if (!stop.lat || !stop.lng) return;
    const url = app === 'google'
      ? `https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}&travelmode=driving`
      : `https://waze.com/ul?ll=${stop.lat},${stop.lng}&navigate=yes`;
    window.open(url, '_blank');
  };

  const confirmStop = async (stopId: string) => {
    setConfirming(stopId);
    try {
      await supabase.from('tour_stops').update({ status: 'completed' }).eq('id', stopId);
      setTour(prev => {
        if (!prev) return prev;
        const stops = prev.stops.map(s => s.id === stopId ? { ...s, status: 'completed' as const } : s);
        return { ...prev, stops, stops_done: prev.stops_done + 1 };
      });
    } finally {
      setConfirming(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Fortschrittsring Header */}
      <div className="rounded-xl border border-white/10 bg-black/40 p-4">
        <div className="flex items-center gap-4">
          {/* Ring */}
          <div className="relative shrink-0">
            <svg width="64" height="64" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
              <circle
                cx="32" cy="32" r="28" fill="none"
                stroke={progress >= 80 ? '#22c55e' : progress >= 50 ? '#eab308' : '#3b82f6'}
                strokeWidth="5"
                strokeDasharray={`${(progress / 100) * 2 * Math.PI * 28} ${2 * Math.PI * 28}`}
                strokeLinecap="round"
                transform="rotate(-90 32 32)"
              />
              <text x="32" y="37" textAnchor="middle" fontSize="14" fontWeight="bold" fill="white">{progress}%</text>
            </svg>
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-white">{tour.stops_done}/{tour.stops_total} Stopps</div>
            {tour.eta_done_min && (
              <div className="text-xs text-white/50 mt-0.5 flex items-center gap-1">
                <Clock className="h-3 w-3" />Tour fertig in ~{tour.eta_done_min} Min.
              </div>
            )}
          </div>
          <Bike className="h-5 w-5 text-blue-400" />
        </div>
      </div>

      {/* Aktiver Stopp */}
      {activeStop && (
        <div className="rounded-xl border border-blue-500/40 bg-blue-500/10 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wide">Aktueller Stopp #{activeStop.sequence}</span>
            {activeStop.eta_min !== null && (
              <span className="ml-auto text-xs font-mono font-bold text-blue-300">
                ETA {fmtMmSs(Math.max(0, (activeStop.eta_min * 60) - tick))}
              </span>
            )}
          </div>

          <div>
            <div className="text-sm font-semibold text-white flex items-start gap-2">
              <MapPin className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
              {activeStop.address}
            </div>
            {activeStop.customer_name && (
              <div className="text-xs text-white/60 ml-6 mt-0.5">{activeStop.customer_name}</div>
            )}
            {activeStop.notes && (
              <div className="text-xs text-yellow-300/80 ml-6 mt-0.5 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />{activeStop.notes}
              </div>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => openNav(activeStop, 'google')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-xs font-medium text-white/80 hover:bg-white/20 transition-colors"
            >
              <Map className="h-3.5 w-3.5" />Google Maps
            </button>
            <button
              onClick={() => openNav(activeStop, 'waze')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-xs font-medium text-white/80 hover:bg-white/20 transition-colors"
            >
              <Navigation className="h-3.5 w-3.5" />Waze
            </button>
            {activeStop.customer_phone && (
              <a
                href={`tel:${activeStop.customer_phone}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-xs font-medium text-white/80 hover:bg-white/20 transition-colors"
              >
                <Phone className="h-3.5 w-3.5" />Anrufen
              </a>
            )}
            <button
              onClick={() => confirmStop(activeStop.id)}
              disabled={confirming === activeStop.id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/20 border border-green-500/40 text-xs font-bold text-green-400 hover:bg-green-500/30 transition-colors ml-auto"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {confirming === activeStop.id ? 'Speichere…' : 'Zugestellt'}
            </button>
          </div>
        </div>
      )}

      {/* Nächste Stopps */}
      {nextStops.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-2">
          <div className="text-xs font-medium text-white/50 uppercase tracking-wide flex items-center gap-2">
            <Package className="h-3.5 w-3.5" />
            Nächste Stopps ({nextStops.length})
          </div>
          {nextStops.slice(0, 4).map(stop => (
            <div key={stop.id} className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2">
              <span className="text-xs font-bold text-white/30 w-5 shrink-0">#{stop.sequence}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-white/80 truncate">{stop.address}</div>
                {stop.customer_name && <div className="text-xs text-white/40">{stop.customer_name}</div>}
              </div>
              {stop.eta_min !== null && (
                <span className="text-xs text-white/40 flex items-center gap-0.5 shrink-0">
                  <Clock className="h-3 w-3" />{stop.eta_min} Min.
                </span>
              )}
              <ChevronRight className="h-4 w-4 text-white/20 shrink-0" />
            </div>
          ))}
        </div>
      )}

      <div className="text-center text-xs text-white/20 flex items-center justify-center gap-1">
        <Timer className="h-3 w-3" />Polling 15 Sek.
      </div>
    </div>
  );
}

'use client';

/**
 * SmartDeliveryTourBoard
 * Erweiterte Tour-Visualisierung mit Score-Anzeige für das Smart Delivery System.
 * Zeigt aktive Touren mit Echtzeit-Score, Stopp-Fortschritt und ETA.
 */

import { useEffect, useState, useCallback } from 'react';
import { Route, Star, MapPin, Clock, Bike, TrendingUp, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TourStop {
  id: string;
  address: string;
  status: 'pending' | 'completed' | 'current';
  eta_min?: number;
}

interface ActiveTour {
  id: string;
  driver_name: string;
  vehicle: 'bike' | 'car';
  score: number;
  score_trend: 'up' | 'down' | 'stable';
  stops_total: number;
  stops_done: number;
  current_stop_eta_min: number;
  zone: string;
  started_at: string;
  stops: TourStop[];
  on_time_rate: number;
}

const MOCK_TOURS: ActiveTour[] = [
  {
    id: 't1', driver_name: 'Ahmed K.', vehicle: 'bike', score: 94, score_trend: 'up',
    stops_total: 4, stops_done: 2, current_stop_eta_min: 3, zone: 'Innenstadt',
    started_at: new Date(Date.now() - 28 * 60_000).toISOString(), on_time_rate: 97,
    stops: [
      { id: 's1', address: 'Markt 4', status: 'completed' },
      { id: 's2', address: 'Kirchstr. 12', status: 'completed' },
      { id: 's3', address: 'Habsburgerstr. 7', status: 'current', eta_min: 3 },
      { id: 's4', address: 'Pontstr. 22', status: 'pending', eta_min: 11 },
    ],
  },
  {
    id: 't2', driver_name: 'Lukas M.', vehicle: 'car', score: 81, score_trend: 'stable',
    stops_total: 3, stops_done: 1, current_stop_eta_min: 7, zone: 'Burtscheid',
    started_at: new Date(Date.now() - 15 * 60_000).toISOString(), on_time_rate: 82,
    stops: [
      { id: 's5', address: 'Bahnhofstr. 3', status: 'completed' },
      { id: 's6', address: 'Roermonder Str. 45', status: 'current', eta_min: 7 },
      { id: 's7', address: 'Jülicher Str. 19', status: 'pending', eta_min: 16 },
    ],
  },
  {
    id: 't3', driver_name: 'Sara B.', vehicle: 'bike', score: 72, score_trend: 'down',
    stops_total: 5, stops_done: 3, current_stop_eta_min: 8, zone: 'Brand',
    started_at: new Date(Date.now() - 45 * 60_000).toISOString(), on_time_rate: 68,
    stops: [
      { id: 's8', address: 'Adalbertsteinweg 12', status: 'completed' },
      { id: 's9', address: 'Vaalser Str. 88', status: 'completed' },
      { id: 's10', address: 'Soerser Weg 3', status: 'completed' },
      { id: 's11', address: 'Im Steinfeld 6', status: 'current', eta_min: 8 },
      { id: 's12', address: 'Schlossstr. 2', status: 'pending', eta_min: 18 },
    ],
  },
];

function useActiveTours(locationId: string | null) {
  const [tours, setTours] = useState<ActiveTour[]>(MOCK_TOURS);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/tours?location_id=${locationId}&status=active`, { cache: 'no-store' });
      if (r.ok) setTours(await r.json());
    } catch {}
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, [load]);

  return tours;
}

function ScoreRing({ score, trend }: { score: number; trend: string }) {
  const color = score >= 90 ? '#22c55e' : score >= 75 ? '#f59e0b' : '#ef4444';
  const circ = 2 * Math.PI * 18;
  const dash = circ * (score / 100);

  return (
    <div className="relative w-12 h-12 flex items-center justify-center">
      <svg width="48" height="48" className="rotate-[-90deg]">
        <circle cx="24" cy="24" r="18" fill="none" stroke="#f1f5f9" strokeWidth="4" />
        <circle cx="24" cy="24" r="18" fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={circ} strokeDashoffset={circ - dash} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div className="absolute text-center">
        <span className="text-xs font-black" style={{ color }}>{score}</span>
      </div>
    </div>
  );
}

function StopProgressBar({ stops }: { stops: TourStop[] }) {
  return (
    <div className="flex items-center gap-0.5">
      {stops.map((stop, i) => (
        <div key={stop.id} className="flex items-center gap-0.5">
          <div className={cn(
            'w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold border transition-all',
            stop.status === 'completed' && 'bg-green-500 border-green-500 text-white',
            stop.status === 'current' && 'bg-saffron border-saffron text-white ring-2 ring-saffron/30 scale-110',
            stop.status === 'pending' && 'bg-white border-stone-300 text-stone-400',
          )}>
            {stop.status === 'completed' ? '✓' : i + 1}
          </div>
          {i < stops.length - 1 && (
            <div className={cn('h-0.5 w-3', stop.status === 'completed' ? 'bg-green-400' : 'bg-stone-200')} />
          )}
        </div>
      ))}
    </div>
  );
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up') return <TrendingUp className="w-3 h-3 text-green-500" />;
  if (trend === 'down') return <TrendingUp className="w-3 h-3 text-red-500 rotate-180" />;
  return <div className="w-3 h-0.5 bg-stone-400 rounded" />;
}

export function SmartDeliveryTourBoard({ locationId }: { locationId?: string | null }) {
  const tours = useActiveTours(locationId ?? null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, []);

  const avgScore = tours.length > 0
    ? Math.round(tours.reduce((s, t) => s + t.score, 0) / tours.length)
    : 0;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-gradient-to-r from-blue-50 to-white">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <Route className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-stone-800">Tour-Visualisierung</div>
            <div className="text-[10px] text-stone-500">{tours.length} aktive Touren · Ø Score {avgScore}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn(
            'px-2 py-1 rounded-lg text-xs font-bold border',
            avgScore >= 90 ? 'bg-green-50 text-green-700 border-green-200' :
            avgScore >= 75 ? 'bg-amber-50 text-amber-700 border-amber-200' :
            'bg-red-50 text-red-700 border-red-200'
          )}>
            <Star className="w-3 h-3 inline mr-0.5" />{avgScore} Ø
          </div>
        </div>
      </div>

      {/* Tour List */}
      <div className="p-3 space-y-3">
        {tours.length === 0 && (
          <div className="text-center py-6 text-stone-400 text-sm">
            <Bike className="w-8 h-8 mx-auto mb-2 opacity-30" />
            Keine aktiven Touren
          </div>
        )}

        {tours.map(tour => {
          const elapsedMin = Math.floor((now - new Date(tour.started_at).getTime()) / 60_000);
          const stopsRemaining = tour.stops_total - tour.stops_done;
          const currentStop = tour.stops.find(s => s.status === 'current');
          const pendingStops = tour.stops.filter(s => s.status === 'pending');

          return (
            <div key={tour.id} className="border border-stone-100 rounded-xl p-3 bg-stone-50/50 hover:bg-stone-50 transition-colors">
              {/* Tour Header */}
              <div className="flex items-center gap-2 mb-2">
                <ScoreRing score={tour.score} trend={tour.score_trend} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-stone-800 truncate">{tour.driver_name}</span>
                    <TrendIcon trend={tour.score_trend} />
                    <span className={cn(
                      'text-[9px] px-1.5 py-0.5 rounded-full font-semibold',
                      tour.vehicle === 'bike' ? 'bg-matcha-100 text-matcha-700' : 'bg-blue-100 text-blue-700'
                    )}>
                      {tour.vehicle === 'bike' ? '🚲 Rad' : '🚗 Auto'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[10px] text-stone-500 flex items-center gap-0.5">
                      <MapPin className="w-2.5 h-2.5" />{tour.zone}
                    </span>
                    <span className="text-[10px] text-stone-500 flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />{elapsedMin}m aktiv
                    </span>
                    <span className={cn(
                      'text-[10px] font-semibold flex items-center gap-0.5',
                      tour.on_time_rate >= 90 ? 'text-green-600' : tour.on_time_rate >= 75 ? 'text-amber-600' : 'text-red-600'
                    )}>
                      <CheckCircle2 className="w-2.5 h-2.5" />{tour.on_time_rate}% pünktl.
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-black text-stone-700 tabular-nums">
                    {tour.stops_done}/{tour.stops_total}
                  </div>
                  <div className="text-[9px] text-stone-400">Stopps</div>
                </div>
              </div>

              {/* Stop Progress */}
              <div className="mb-2">
                <StopProgressBar stops={tour.stops} />
              </div>

              {/* Current Stop & Next Stops */}
              {currentStop && (
                <div className="flex items-center gap-2 mt-1.5 bg-saffron/10 border border-saffron/20 rounded-lg px-2 py-1.5">
                  <MapPin className="w-3 h-3 text-saffron shrink-0" />
                  <span className="text-xs font-semibold text-stone-700 truncate flex-1">{currentStop.address}</span>
                  {currentStop.eta_min !== undefined && (
                    <span className="text-xs font-bold text-saffron tabular-nums shrink-0">
                      {currentStop.eta_min}m
                    </span>
                  )}
                </div>
              )}

              {pendingStops.length > 0 && (
                <div className="flex items-center gap-1.5 mt-1.5 pl-1">
                  <div className="w-px h-4 bg-stone-200 ml-1" />
                  <div className="text-[9px] text-stone-400 flex items-center gap-1">
                    {pendingStops.slice(0, 2).map((s, i) => (
                      <span key={s.id} className="flex items-center gap-0.5">
                        {i > 0 && <span>·</span>}
                        <span>{s.address.split(' ')[0]}</span>
                        {s.eta_min && <span className="text-stone-300">({s.eta_min}m)</span>}
                      </span>
                    ))}
                    {pendingStops.length > 2 && <span>+{pendingStops.length - 2} weitere</span>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="border-t border-stone-100 px-4 py-2 bg-stone-50 flex items-center justify-between">
        <div className="flex items-center gap-3 text-[10px] text-stone-500">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            {tours.filter(t => t.score >= 90).length} Excellent
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            {tours.filter(t => t.score >= 75 && t.score < 90).length} Gut
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            {tours.filter(t => t.score < 75).length} Kritisch
          </span>
        </div>
        <span className="text-[10px] text-stone-400">Smart Tour Board · mise</span>
      </div>
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { Route, Bike, Star, TrendingUp, TrendingDown, Clock, MapPin, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TourStop {
  sequence: number;
  address: string;
  status: 'pending' | 'arrived' | 'delivered' | 'skipped';
  eta_min: number | null;
  delay_min: number | null;
}

interface TourEntry {
  tour_id: string;
  fahrer_name: string;
  score: number;
  score_delta: number;
  stops_total: number;
  stops_done: number;
  on_time_rate: number;
  avg_stop_min: number;
  stops: TourStop[];
  status: 'aktiv' | 'abgeschlossen' | 'pause';
}

interface ApiData {
  tours: TourEntry[];
  fleet_score: number;
  on_time_fleet: number;
}

const MOCK: ApiData = {
  fleet_score: 78,
  on_time_fleet: 84,
  tours: [
    {
      tour_id: 't1', fahrer_name: 'Tom K.', score: 88, score_delta: 3, stops_total: 5, stops_done: 3, on_time_rate: 100, avg_stop_min: 4.2, status: 'aktiv',
      stops: [
        { sequence: 1, address: 'Hauptstr. 12', status: 'delivered', eta_min: null, delay_min: 0 },
        { sequence: 2, address: 'Bahnhofstr. 5', status: 'delivered', eta_min: null, delay_min: -1 },
        { sequence: 3, address: 'Parkweg 8', status: 'delivered', eta_min: null, delay_min: 2 },
        { sequence: 4, address: 'Lindenallee 3', status: 'arrived', eta_min: 2, delay_min: 0 },
        { sequence: 5, address: 'Gartenstr. 17', status: 'pending', eta_min: 8, delay_min: null },
      ],
    },
    {
      tour_id: 't2', fahrer_name: 'Anna B.', score: 65, score_delta: -5, stops_total: 4, stops_done: 1, on_time_rate: 75, avg_stop_min: 6.8, status: 'aktiv',
      stops: [
        { sequence: 1, address: 'Rosenweg 2', status: 'delivered', eta_min: null, delay_min: 4 },
        { sequence: 2, address: 'Mühlenstr. 9', status: 'pending', eta_min: 3, delay_min: null },
        { sequence: 3, address: 'Schlossplatz 1', status: 'pending', eta_min: 10, delay_min: null },
        { sequence: 4, address: 'Hofgasse 6', status: 'pending', eta_min: 16, delay_min: null },
      ],
    },
    {
      tour_id: 't3', fahrer_name: 'Lars P.', score: 92, score_delta: 1, stops_total: 6, stops_done: 6, on_time_rate: 100, avg_stop_min: 3.8, status: 'abgeschlossen',
      stops: [],
    },
  ],
};

function scoreColor(score: number) {
  if (score >= 85) return 'text-matcha-700';
  if (score >= 70) return 'text-amber-600';
  return 'text-red-600';
}

function scoreRingColor(score: number) {
  if (score >= 85) return 'stroke-matcha-500';
  if (score >= 70) return 'stroke-amber-400';
  return 'stroke-red-500';
}

function stopStatusDot(status: TourStop['status']) {
  switch (status) {
    case 'delivered': return 'bg-matcha-500';
    case 'arrived': return 'bg-amber-400 animate-pulse';
    case 'pending': return 'bg-stone-300';
    case 'skipped': return 'bg-red-400';
  }
}

export function DispatchPhase2752TourScoreLiveVisualisierung({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      fetch(`/api/delivery/admin/tour-score-live?location_id=${locationId ?? ''}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));

    if (!locationId) { setData(MOCK); return; }
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!data) return null;

  const activeTours = data.tours.filter(t => t.status === 'aktiv');
  const problemTours = activeTours.filter(t => t.score < 70);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-100">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 text-matcha-700">
          <Route className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-char">Tour-Score Live-Visualisierung</div>
          <div className="text-[11px] text-stone-400">{activeTours.length} aktive Touren · Flotten-Score {data.fleet_score}</div>
        </div>
        <div className="flex items-center gap-2">
          {problemTours.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
              <AlertTriangle className="h-3 w-3" />{problemTours.length} kritisch
            </span>
          )}
          <div className="text-right">
            <div className={cn('text-lg font-black tabular-nums', scoreColor(data.fleet_score))}>{data.fleet_score}</div>
            <div className="text-[9px] text-stone-400 uppercase tracking-wide">Flotten-Score</div>
          </div>
        </div>
      </div>

      <div className="divide-y divide-stone-100">
        {data.tours.map(tour => {
          const isExpanded = expanded === tour.tour_id;
          const progressPct = tour.stops_total > 0 ? (tour.stops_done / tour.stops_total) * 100 : 0;
          const circumference = 2 * Math.PI * 16;
          const dash = (tour.score / 100) * circumference;

          return (
            <div key={tour.tour_id}>
              <button
                className="flex w-full items-center gap-3 px-5 py-3 hover:bg-stone-50 transition text-left"
                onClick={() => setExpanded(isExpanded ? null : tour.tour_id)}
              >
                {/* Score ring */}
                <div className="relative h-10 w-10 shrink-0">
                  <svg className="h-10 w-10 -rotate-90" viewBox="0 0 40 40">
                    <circle cx="20" cy="20" r="16" fill="none" stroke="#e7e5e4" strokeWidth="3" />
                    <circle
                      cx="20" cy="20" r="16" fill="none" strokeWidth="3"
                      className={scoreRingColor(tour.score)}
                      strokeDasharray={`${dash} ${circumference - dash}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className={cn('absolute inset-0 flex items-center justify-center text-[11px] font-black tabular-nums', scoreColor(tour.score))}>
                    {tour.score}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Bike className="h-3.5 w-3.5 text-stone-400 shrink-0" />
                    <span className="text-sm font-bold truncate">{tour.fahrer_name}</span>
                    <span className={cn('flex items-center gap-0.5 text-[10px] font-bold', tour.score_delta >= 0 ? 'text-matcha-600' : 'text-red-500')}>
                      {tour.score_delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {tour.score_delta > 0 ? '+' : ''}{tour.score_delta}
                    </span>
                    {tour.status === 'abgeschlossen' && (
                      <span className="rounded-full bg-matcha-100 px-1.5 py-0.5 text-[9px] font-bold text-matcha-700">Fertig</span>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-3">
                    <div className="flex-1 h-1.5 rounded-full bg-stone-100">
                      <div
                        className={cn('h-full rounded-full transition-all', tour.on_time_rate >= 90 ? 'bg-matcha-500' : tour.on_time_rate >= 75 ? 'bg-amber-400' : 'bg-red-400')}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <span className="text-[10px] tabular-nums text-stone-400 shrink-0">{tour.stops_done}/{tour.stops_total}</span>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className={cn('text-xs font-bold tabular-nums', tour.on_time_rate >= 90 ? 'text-matcha-700' : tour.on_time_rate >= 75 ? 'text-amber-600' : 'text-red-600')}>
                    {tour.on_time_rate}% p.
                  </div>
                  <div className="text-[10px] text-stone-400 flex items-center gap-0.5 justify-end">
                    <Clock className="h-2.5 w-2.5" />Ø {tour.avg_stop_min.toFixed(1)} Min
                  </div>
                </div>
              </button>

              {isExpanded && tour.stops.length > 0 && (
                <div className="px-5 pb-3 bg-stone-50">
                  <div className="flex flex-col gap-1.5 pt-2 pl-2 border-l-2 border-stone-200 ml-4">
                    {tour.stops.map(stop => (
                      <div key={stop.sequence} className="flex items-center gap-2">
                        <div className={cn('h-2.5 w-2.5 rounded-full shrink-0 -ml-[5px]', stopStatusDot(stop.status))} />
                        <MapPin className="h-3 w-3 text-stone-400 shrink-0" />
                        <span className="text-xs text-stone-600 truncate flex-1">{stop.address}</span>
                        {stop.status === 'delivered' && stop.delay_min !== null && (
                          <span className={cn('text-[10px] font-bold tabular-nums shrink-0', stop.delay_min <= 0 ? 'text-matcha-600' : 'text-amber-600')}>
                            {stop.delay_min > 0 ? `+${stop.delay_min}` : stop.delay_min === 0 ? '✓' : `${stop.delay_min}`} Min
                          </span>
                        )}
                        {stop.status === 'arrived' && (
                          <span className="text-[10px] font-bold text-amber-600 shrink-0 animate-pulse">Angekommen</span>
                        )}
                        {stop.status === 'pending' && stop.eta_min !== null && (
                          <span className="text-[10px] text-stone-400 tabular-nums shrink-0">~{stop.eta_min} Min</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-4 px-5 py-3 bg-stone-50 border-t border-stone-100">
        <div className="text-center">
          <div className={cn('text-lg font-black tabular-nums', scoreColor(data.fleet_score))}>{data.fleet_score}</div>
          <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">Flotten-Score</div>
        </div>
        <div className="text-center">
          <div className={cn('text-lg font-black tabular-nums', data.on_time_fleet >= 90 ? 'text-matcha-700' : data.on_time_fleet >= 75 ? 'text-amber-600' : 'text-red-600')}>
            {data.on_time_fleet}%
          </div>
          <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">On-Time</div>
        </div>
        <div className="text-center">
          <div className={cn('text-lg font-black tabular-nums', problemTours.length === 0 ? 'text-matcha-700' : 'text-red-600')}>{activeTours.length}</div>
          <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">Aktive Touren</div>
        </div>
      </div>
    </div>
  );
}

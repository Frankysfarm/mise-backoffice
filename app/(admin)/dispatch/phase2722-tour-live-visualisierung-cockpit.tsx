'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, Bike, CheckCircle2, Clock, MapPin, Navigation2, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TourStop {
  stop_nr: number;
  adresse: string;
  status: 'offen' | 'unterwegs' | 'geliefert';
  eta_min: number | null;
}

interface DriverTour {
  driver_id: string;
  driver_name: string;
  score: number;
  tour_progress_pct: number;
  stops: TourStop[];
  eta_rueckkehr_min: number | null;
  on_time: boolean;
}

interface ApiData {
  tours: DriverTour[];
  team_avg_score: number;
}

const MOCK: ApiData = {
  tours: [
    {
      driver_id: 'd1',
      driver_name: 'Felix R.',
      score: 87,
      tour_progress_pct: 60,
      stops: [
        { stop_nr: 1, adresse: 'Hauptstr. 12', status: 'geliefert', eta_min: null },
        { stop_nr: 2, adresse: 'Gartenweg 5', status: 'unterwegs', eta_min: 4 },
        { stop_nr: 3, adresse: 'Lindenstr. 8', status: 'offen', eta_min: 12 },
      ],
      eta_rueckkehr_min: 22,
      on_time: true,
    },
    {
      driver_id: 'd2',
      driver_name: 'Mia S.',
      score: 54,
      tour_progress_pct: 33,
      stops: [
        { stop_nr: 1, adresse: 'Bahnhofstr. 1', status: 'geliefert', eta_min: null },
        { stop_nr: 2, adresse: 'Marktplatz 3', status: 'offen', eta_min: 8 },
        { stop_nr: 3, adresse: 'Kirchstr. 22', status: 'offen', eta_min: 18 },
      ],
      eta_rueckkehr_min: 35,
      on_time: false,
    },
  ],
  team_avg_score: 71,
};

function scoreRingColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}

function ScoreRing({ score, size = 40 }: { score: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dashArr = circ;
  const dashOff = circ * (1 - score / 100);
  const color = scoreRingColor(score);
  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={5}
        strokeDasharray={dashArr} strokeDashoffset={dashOff}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fontSize={10} fontWeight="700" fill={color}>{score}</text>
    </svg>
  );
}

export function DispatchPhase2722TourLiveVisualisierungCockpit({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = () =>
      fetch(`/api/delivery/admin/tour-live-cockpit?location_id=${locationId ?? ''}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    if (!locationId) { setData(MOCK); return; }
    load();
    const iv = setInterval(load, 25_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!data) return null;

  const criticalTours = data.tours.filter(t => t.score < 60);
  const toggleExpand = (id: string) => setExpanded(s => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  return (
    <div className="rounded-xl border border-matcha-200 bg-white shadow-sm mb-3 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-matcha-100">
        <div className="flex items-center gap-2">
          <Navigation2 size={16} className="text-matcha-600" />
          <span className="font-semibold text-sm text-gray-900">Tour Live-Visualisierung</span>
          {criticalTours.length > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-red-600 font-semibold bg-red-50 border border-red-200 rounded-full px-1.5 py-0.5">
              <AlertTriangle size={10} /> {criticalTours.length} Score &lt;60
            </span>
          )}
        </div>
        <span className={cn('text-xs font-semibold', data.team_avg_score >= 75 ? 'text-green-600' : data.team_avg_score >= 60 ? 'text-amber-600' : 'text-red-600')}>
          Team Ø {data.team_avg_score}
        </span>
      </div>

      <div className="divide-y divide-matcha-50">
        {data.tours.map(tour => {
          const isOpen = expanded.has(tour.driver_id);
          const currentStop = tour.stops.find(s => s.status === 'unterwegs') ?? tour.stops.find(s => s.status === 'offen');
          return (
            <div key={tour.driver_id}>
              <button
                onClick={() => toggleExpand(tour.driver_id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-matcha-50 transition-colors text-left"
              >
                <ScoreRing score={tour.score} size={40} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-900">{tour.driver_name}</span>
                    {!tour.on_time && (
                      <span className="text-[10px] text-red-600 font-semibold bg-red-50 border border-red-200 rounded px-1">Verspätet</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Stop-Dots */}
                    <div className="flex items-center gap-1">
                      {tour.stops.map(s => (
                        <div key={s.stop_nr} className={cn('w-2.5 h-2.5 rounded-full border',
                          s.status === 'geliefert' ? 'bg-green-400 border-green-500' :
                          s.status === 'unterwegs' ? 'bg-amber-400 border-amber-500 ring-1 ring-amber-200' :
                          'bg-gray-200 border-gray-300'
                        )} title={`Stop ${s.stop_nr}: ${s.adresse}`} />
                      ))}
                    </div>
                    {/* Progress bar */}
                    <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all', tour.score >= 80 ? 'bg-green-400' : tour.score >= 60 ? 'bg-amber-400' : 'bg-red-400')} style={{ width: `${tour.tour_progress_pct}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-500 tabular-nums">{tour.tour_progress_pct}%</span>
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  {tour.eta_rueckkehr_min !== null && (
                    <div className="text-xs text-gray-500">
                      <Clock size={9} className="inline mr-0.5" />
                      {tour.eta_rueckkehr_min} Min
                    </div>
                  )}
                  <span className="text-[10px] text-gray-400">{isOpen ? '▲' : '▼'}</span>
                </div>
              </button>

              {isOpen && (
                <div className="bg-gray-50 border-t border-matcha-100 px-4 py-2 space-y-1.5">
                  {tour.stops.map(s => (
                    <div key={s.stop_nr} className="flex items-center gap-2 text-xs">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold bg-white border border-gray-200 text-gray-600">
                        {s.stop_nr}
                      </div>
                      {s.status === 'geliefert' ? (
                        <CheckCircle2 size={12} className="text-green-500 flex-shrink-0" />
                      ) : s.status === 'unterwegs' ? (
                        <Bike size={12} className="text-amber-500 flex-shrink-0 animate-pulse" />
                      ) : (
                        <MapPin size={12} className="text-gray-400 flex-shrink-0" />
                      )}
                      <span className={cn('flex-1 truncate', s.status === 'geliefert' ? 'line-through text-gray-400' : 'text-gray-700')}>{s.adresse}</span>
                      {s.eta_min !== null && (
                        <span className="text-gray-500 tabular-nums">{s.eta_min} Min</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {data.tours.length === 0 && (
          <div className="px-4 py-4 text-xs text-gray-400 text-center">Keine aktiven Touren</div>
        )}
      </div>
    </div>
  );
}

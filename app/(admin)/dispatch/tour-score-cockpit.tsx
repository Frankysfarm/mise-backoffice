'use client';
import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Target, TrendingUp, Bike, Clock } from 'lucide-react';

type TourStop = {
  id: string;
  order_id: string;
  sequence: number;
  order?: { status?: string } | null;
};

type TourDriver = {
  id: string;
  name: string;
  vehicle: string | null;
  state: string | null;
} | null;

type Tour = {
  id: string;
  state: string;
  dispatch_score: number | null;
  total_distance_km: number | null;
  total_eta_min: number | null;
  created_at: string;
  driver: TourDriver;
  stops: TourStop[];
};

type Props = {
  locationId: string | null;
};

function scoreColor(score: number) {
  if (score >= 80) return { bar: 'bg-matcha-500', text: 'text-matcha-700', bg: 'bg-matcha-50', label: 'Sehr gut' };
  if (score >= 60) return { bar: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50', label: 'Gut' };
  if (score >= 40) return { bar: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', label: 'OK' };
  return { bar: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50', label: 'Kritisch' };
}

export function DispatchTourScoreCockpit({ locationId }: Props) {
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    const load = () => {
      setLoading(true);
      fetch(`/api/delivery/tours?location_id=${locationId}&state=active`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (Array.isArray(d?.tours)) setTours(d.tours);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const toursWithScore = tours.filter(t => t.dispatch_score != null);
  if (!locationId || (!loading && toursWithScore.length === 0)) return null;

  const avgScore = toursWithScore.length > 0
    ? Math.round(toursWithScore.reduce((s, t) => s + (t.dispatch_score ?? 0), 0) / toursWithScore.length)
    : null;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-bold text-foreground">Tour-Score Cockpit</span>
        {avgScore != null && (
          <Badge className={cn('ml-auto text-[10px]', scoreColor(avgScore).bg, scoreColor(avgScore).text)}>
            Ø {avgScore} Punkte
          </Badge>
        )}
      </div>

      {loading && tours.length === 0 && (
        <div className="text-xs text-muted-foreground text-center py-3">Lade Touren…</div>
      )}

      <div className="space-y-2">
        {toursWithScore.map((tour) => {
          const score = tour.dispatch_score ?? 0;
          const cs = scoreColor(score);
          const completedStops = tour.stops.filter(s => s.order?.status === 'geliefert').length;
          const totalStops = tour.stops.length;
          const elapsedMin = tour.created_at
            ? Math.round((Date.now() - new Date(tour.created_at).getTime()) / 60_000)
            : null;
          const driverName = tour.driver?.name ?? 'Kein Fahrer';
          const vehicle = tour.driver?.vehicle ?? '';

          return (
            <div key={tour.id} className={cn('rounded-xl border p-3 space-y-2', cs.bg, 'border-stone-100')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Bike className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-foreground">{driverName}</span>
                  {vehicle && <span className="text-[10px] text-muted-foreground">({vehicle})</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={cn('text-xs font-black tabular-nums', cs.text)}>{score}</span>
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold', cs.bg, cs.text)}>{cs.label}</span>
                </div>
              </div>
              {/* Score bar */}
              <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                <div className={cn('h-full rounded-full transition-all duration-700', cs.bar)} style={{ width: `${score}%` }} />
              </div>
              {/* Stats row */}
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><TrendingUp className="h-2.5 w-2.5" />{completedStops}/{totalStops} Stopps</span>
                {elapsedMin != null && <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{elapsedMin} Min</span>}
                {tour.total_distance_km != null && <span>~{tour.total_distance_km.toFixed(1)} km</span>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

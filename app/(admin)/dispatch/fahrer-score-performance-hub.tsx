'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Trophy, Clock, CheckCircle2, Star, Zap, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DriverScore {
  driver_id: string;
  driver_name: string;
  score: number;
  sub_scores: {
    punctuality: number;
    completion: number;
    customer_rating: number;
    efficiency: number;
  };
}

interface TourInfo {
  id: string;
  driver_id: string;
  driver_name: string;
  status: string;
  stops: {
    total: number;
    completed: number;
  };
  eta_min: number | null;
}

// ─── Mock fallback data ────────────────────────────────────────────────────────

const MOCK_SCORES: DriverScore[] = [
  {
    driver_id: 'drv-1',
    driver_name: 'Max Müller',
    score: 87,
    sub_scores: { punctuality: 90, completion: 95, customer_rating: 4.5, efficiency: 82 },
  },
  {
    driver_id: 'drv-2',
    driver_name: 'Sarah Klein',
    score: 92,
    sub_scores: { punctuality: 88, completion: 98, customer_rating: 4.8, efficiency: 91 },
  },
  {
    driver_id: 'drv-3',
    driver_name: 'Tom Weber',
    score: 76,
    sub_scores: { punctuality: 72, completion: 85, customer_rating: 4.2, efficiency: 78 },
  },
];

const MOCK_TOURS: TourInfo[] = [
  {
    id: 'tour-1',
    driver_id: 'drv-1',
    driver_name: 'Max Müller',
    status: 'active',
    stops: { total: 8, completed: 5 },
    eta_min: 18,
  },
  {
    id: 'tour-2',
    driver_id: 'drv-2',
    driver_name: 'Sarah Klein',
    status: 'active',
    stops: { total: 6, completed: 6 },
    eta_min: null,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 85) return 'text-green-600';
  if (score >= 70) return 'text-amber-500';
  return 'text-red-500';
}

function scoreBg(score: number): string {
  if (score >= 85) return 'bg-green-500 ring-green-200';
  if (score >= 70) return 'bg-amber-400 ring-amber-200';
  return 'bg-red-500 ring-red-200';
}

function scoreBarColor(score: number): string {
  if (score >= 85) return 'bg-green-500';
  if (score >= 70) return 'bg-amber-400';
  return 'bg-red-500';
}

function ratingToPercent(rating: number): number {
  return Math.round((rating / 5) * 100);
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SubScoreBar({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
}) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-[10px] text-gray-500">
          <Icon className="h-2.5 w-2.5" />
          {label}
        </span>
        <span className="text-[10px] font-semibold text-gray-700">{Math.round(pct)}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={cn('h-full rounded-full transition-all duration-500', scoreBarColor(pct))}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function DriverCard({
  driver,
  tour,
}: {
  driver: DriverScore;
  tour: TourInfo | undefined;
}) {
  const { score, sub_scores, driver_name } = driver;

  return (
    <div className="flex w-56 shrink-0 flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white ring-2',
            scoreBg(score),
          )}
        >
          {initials(driver_name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">{driver_name}</p>
          <p className="text-[10px] text-gray-400">Fahrer</p>
        </div>
      </div>

      {/* Big score */}
      <div className="flex items-baseline gap-1">
        <span className={cn('text-4xl font-black tabular-nums leading-none', scoreColor(score))}>
          {score}
        </span>
        <span className="text-xs font-medium text-gray-400">/ 100</span>
      </div>

      {/* Sub-score bars */}
      <div className="flex flex-col gap-2">
        <SubScoreBar
          label="Pünktlichkeit"
          value={sub_scores.punctuality}
          icon={Clock}
        />
        <SubScoreBar
          label="Abschluss"
          value={sub_scores.completion}
          icon={CheckCircle2}
        />
        <SubScoreBar
          label="Kundenwertung"
          value={ratingToPercent(sub_scores.customer_rating)}
          icon={Star}
        />
        <SubScoreBar
          label="Effizienz"
          value={sub_scores.efficiency}
          icon={Zap}
        />
      </div>

      {/* Active tour info */}
      {tour ? (
        <div className="rounded-xl bg-gray-50 px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-gray-500">Aktive Tour</span>
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[9px] font-bold',
                tour.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500',
              )}
            >
              {tour.status === 'active' ? 'Aktiv' : tour.status}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700">
              {tour.stops.completed}/{tour.stops.total} Stops
            </span>
            {tour.eta_min !== null ? (
              <span className="flex items-center gap-0.5 text-[10px] text-amber-600">
                <Clock className="h-2.5 w-2.5" />
                ~{tour.eta_min} min
              </span>
            ) : (
              <span className="text-[10px] text-green-600">Fertig</span>
            )}
          </div>
          {/* Stop progress bar */}
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-500"
              style={{
                width: `${Math.round((tour.stops.completed / Math.max(1, tour.stops.total)) * 100)}%`,
              }}
            />
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-gray-50 px-3 py-2 text-center text-[10px] text-gray-400">
          Keine aktive Tour
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DispatchFahrerScorePerformanceHub() {
  const [drivers, setDrivers] = useState<DriverScore[]>([]);
  const [tours, setTours] = useState<TourInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [scoresRes, toursRes] = await Promise.allSettled([
        fetch('/api/delivery/admin/driver-score?action=live'),
        fetch('/api/delivery/admin/tours'),
      ]);

      let fetchedDrivers: DriverScore[] = MOCK_SCORES;
      let fetchedTours: TourInfo[] = MOCK_TOURS;

      if (scoresRes.status === 'fulfilled' && scoresRes.value.ok) {
        const data = await scoresRes.value.json();
        if (Array.isArray(data) && data.length > 0) {
          fetchedDrivers = data;
        }
      }

      if (toursRes.status === 'fulfilled' && toursRes.value.ok) {
        const data = await toursRes.value.json();
        if (Array.isArray(data) && data.length > 0) {
          fetchedTours = data;
        }
      }

      setDrivers(fetchedDrivers);
      setTours(fetchedTours);
      setLastUpdated(new Date());
    } catch {
      setDrivers(MOCK_SCORES);
      setTours(MOCK_TOURS);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();

    // Auto-refresh every 30 seconds
    intervalRef.current = setInterval(load, 30_000);

    // Supabase realtime subscription for delivery_driver_scores
    const supabase = createClient();
    const channel = supabase
      .channel('driver-score-hub')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'delivery_driver_scores' },
        () => {
          load();
        },
      )
      .subscribe();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived stats ────────────────────────────────────────────────────────────
  const avgScore =
    drivers.length > 0
      ? Math.round(drivers.reduce((sum, d) => sum + d.score, 0) / drivers.length)
      : 0;

  const bestDriver =
    drivers.length > 0
      ? drivers.reduce((best, d) => (d.score > best.score ? d : best), drivers[0])
      : null;

  const activeTourCount = tours.filter((t) => t.status === 'active').length;

  // ── Tour lookup by driver_id ──────────────────────────────────────────────────
  const tourByDriverId = new Map<string, TourInfo>(
    tours
      .filter((t) => t.status === 'active')
      .map((t) => [t.driver_id, t]),
  );

  const formattedTime = lastUpdated
    ? lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          <h2 className="text-base font-bold text-gray-900">Fahrer Score Hub</h2>
          {loading && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-500">
              Lädt…
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {formattedTime && (
            <span className="text-[10px] text-gray-400">{formattedTime}</span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 transition hover:bg-gray-100 disabled:opacity-50"
            aria-label="Aktualisieren"
          >
            <RefreshCw className={cn('h-3.5 w-3.5 text-gray-500', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Driver cards — horizontal scroll */}
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
        {drivers.length === 0 && !loading ? (
          <div className="flex w-full items-center justify-center py-8 text-sm text-gray-400">
            Keine Fahrerdaten verfügbar
          </div>
        ) : (
          drivers.map((driver) => (
            <DriverCard
              key={driver.driver_id}
              driver={driver}
              tour={tourByDriverId.get(driver.driver_id)}
            />
          ))
        )}
      </div>

      {/* Summary row */}
      {drivers.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3">
          {/* Average score */}
          <div className="flex flex-1 flex-col items-center gap-0.5">
            <div className="flex items-center gap-1 text-[10px] text-gray-500">
              <Activity className="h-3 w-3" />
              Ø Score
            </div>
            <span className={cn('text-lg font-black tabular-nums leading-none', scoreColor(avgScore))}>
              {avgScore}
            </span>
          </div>

          <div className="h-8 w-px bg-gray-200" />

          {/* Best driver */}
          <div className="flex flex-1 flex-col items-center gap-0.5">
            <div className="flex items-center gap-1 text-[10px] text-gray-500">
              <Trophy className="h-3 w-3 text-amber-500" />
              Bester Fahrer
            </div>
            {bestDriver ? (
              <span className="text-xs font-bold text-gray-800 text-center leading-tight">
                {bestDriver.driver_name.split(' ')[0]}
                <span className={cn('ml-1 font-black', scoreColor(bestDriver.score))}>
                  {bestDriver.score}
                </span>
              </span>
            ) : (
              <span className="text-xs text-gray-400">–</span>
            )}
          </div>

          <div className="h-8 w-px bg-gray-200" />

          {/* Active tours */}
          <div className="flex flex-1 flex-col items-center gap-0.5">
            <div className="flex items-center gap-1 text-[10px] text-gray-500">
              <CheckCircle2 className="h-3 w-3 text-blue-500" />
              Aktive Touren
            </div>
            <span className="text-lg font-black tabular-nums leading-none text-blue-600">
              {activeTourCount}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

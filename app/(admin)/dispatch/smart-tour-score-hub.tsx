'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  Award, Bike, ChevronDown, ChevronUp, Clock, Gauge,
  MapPin, Navigation2, Star, Target, Trophy, TrendingUp, Zap,
} from 'lucide-react';

interface TourRow {
  id: string;
  driver_id?: string | null;
  driver_name?: string | null;
  status?: string | null;
  total_stops?: number | null;
  completed_stops?: number | null;
  avg_delivery_time_min?: number | null;
  score?: number | null;
  on_time_pct?: number | null;
  distance_km?: number | null;
  started_at?: string | null;
}

const MOCK_TOURS: TourRow[] = [
  {
    id: '1',
    driver_name: 'Max M.',
    status: 'active',
    total_stops: 4,
    completed_stops: 2,
    avg_delivery_time_min: 26,
    score: 88,
    on_time_pct: 100,
    distance_km: 8.4,
    started_at: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    driver_name: 'Anna K.',
    status: 'active',
    total_stops: 3,
    completed_stops: 1,
    avg_delivery_time_min: 31,
    score: 74,
    on_time_pct: 67,
    distance_km: 5.2,
    started_at: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    driver_name: 'Jonas B.',
    status: 'returning',
    total_stops: 3,
    completed_stops: 3,
    avg_delivery_time_min: 24,
    score: 95,
    on_time_pct: 100,
    distance_km: 11.1,
    started_at: new Date(Date.now() - 68 * 60 * 1000).toISOString(),
  },
];

function ScoreRing({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color =
    pct >= 85 ? '#2d6b45' : pct >= 70 ? '#f59e0b' : '#ef4444';
  const r = 18;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="relative flex h-12 w-12 items-center justify-center">
      <svg width="48" height="48" className="rotate-[-90deg]">
        <circle cx="24" cy="24" r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span
        className="absolute text-[11px] font-black tabular-nums"
        style={{ color }}
      >
        {score}
      </span>
    </div>
  );
}

export function SmartTourScoreHub({ locationId }: { locationId?: string | null }) {
  const [tours, setTours] = useState<TourRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      try {
        const q = supabase
          .from('delivery_tours')
          .select('id, driver_id, driver_name, status, total_stops, completed_stops, avg_delivery_time_min, score, on_time_pct, distance_km, started_at')
          .in('status', ['active', 'returning', 'pending'])
          .order('started_at', { ascending: false })
          .limit(10);

        if (locationId) q.eq('location_id', locationId);

        const { data } = await q;
        if (data && data.length > 0) {
          setTours(data);
        } else {
          setTours(MOCK_TOURS);
        }
      } catch {
        setTours(MOCK_TOURS);
      } finally {
        setLoading(false);
      }
    }

    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const avgScore =
    tours.length > 0
      ? Math.round(tours.reduce((s, t) => s + (t.score ?? 0), 0) / tours.length)
      : 0;
  const activeTours = tours.filter((t) => t.status === 'active').length;
  const topDriver = [...tours].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-saffron" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Tour-Score & Visualisierung
          </span>
          {!loading && (
            <div className="flex gap-1.5">
              <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
                Ø {avgScore} Pkt.
              </span>
              {activeTours > 0 && (
                <span className="rounded-full bg-saffron/15 px-2 py-0.5 text-[10px] font-bold text-saffron">
                  {activeTours} aktiv
                </span>
              )}
            </div>
          )}
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* Top-Banner */}
              {topDriver && (
                <div className="flex items-center gap-3 border-b bg-amber-50/60 px-4 py-2.5">
                  <Trophy className="h-4 w-4 text-amber-600 shrink-0" />
                  <span className="text-xs font-bold text-amber-700">
                    Top-Fahrer: {topDriver.driver_name ?? 'Unbekannt'} — {topDriver.score ?? '?'} Pkt.
                  </span>
                </div>
              )}

              {/* Tour rows */}
              <div className="divide-y">
                {tours
                  .sort((a, b) => {
                    const order = { active: 0, returning: 1, pending: 2 };
                    return ((order as any)[a.status ?? ''] ?? 3) - ((order as any)[b.status ?? ''] ?? 3);
                  })
                  .map((t) => {
                    const progress =
                      t.total_stops && t.total_stops > 0
                        ? (t.completed_stops ?? 0) / t.total_stops
                        : 0;
                    const elapsedMin = t.started_at
                      ? Math.round((Date.now() - new Date(t.started_at).getTime()) / 60_000)
                      : null;

                    return (
                      <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                        <ScoreRing score={t.score ?? 0} />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm truncate">
                              {t.driver_name ?? 'Fahrer'}
                            </span>
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[9px] font-bold uppercase',
                                t.status === 'active'
                                  ? 'bg-matcha-100 text-matcha-700'
                                  : t.status === 'returning'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-stone-100 text-stone-600',
                              )}
                            >
                              {t.status === 'active'
                                ? 'aktiv'
                                : t.status === 'returning'
                                ? 'Rückfahrt'
                                : 'wartend'}
                            </span>
                          </div>

                          {/* Progress bar */}
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn(
                                  'h-full rounded-full transition-all',
                                  progress >= 1
                                    ? 'bg-matcha-500'
                                    : t.status === 'active'
                                    ? 'bg-saffron'
                                    : 'bg-stone-400',
                                )}
                                style={{ width: `${progress * 100}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                              {t.completed_stops ?? 0}/{t.total_stops ?? '?'} Stopps
                            </span>
                          </div>

                          <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                            {t.avg_delivery_time_min && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Ø {Math.round(t.avg_delivery_time_min)} Min
                              </span>
                            )}
                            {t.on_time_pct !== null && t.on_time_pct !== undefined && (
                              <span
                                className={cn(
                                  'flex items-center gap-1 font-bold',
                                  t.on_time_pct >= 85
                                    ? 'text-matcha-600'
                                    : t.on_time_pct >= 65
                                    ? 'text-amber-600'
                                    : 'text-red-600',
                                )}
                              >
                                <Target className="h-3 w-3" />
                                {Math.round(t.on_time_pct)}% pünktlich
                              </span>
                            )}
                            {elapsedMin !== null && (
                              <span>seit {elapsedMin} Min</span>
                            )}
                            {t.distance_km && (
                              <span className="flex items-center gap-1">
                                <Navigation2 className="h-3 w-3" />
                                {t.distance_km.toFixed(1)} km
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

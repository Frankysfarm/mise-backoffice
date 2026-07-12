'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Route, Star, TrendingUp, Clock, MapPin } from 'lucide-react';

// Phase 1205 — Tour-Score-Visualisierung-Dashboard (Dispatch)
// Alle aktiven Touren als Score-Karten: Fahrer-Score-Ampel, Tour-Fortschritt-Ring,
// Stop-Sequenz-Timeline + Verbleibende ETA

interface Props {
  locationId: string | null;
}

type TourStop = {
  reihenfolge: number;
  status: 'pending' | 'arrived' | 'delivered';
  zone: string | null;
};

type TourRow = {
  batchId: string;
  driverName: string;
  vehicle: string;
  score: number | null;       // 0-100
  scoreLabel: string | null;  // 'Exzellent' | 'Gut' | 'OK' | 'Schwach'
  stops: TourStop[];
  completedStops: number;
  totalStops: number;
  startedAt: string | null;
  etaMin: number | null;
  remainMin: number | null;
  zone: string | null;
  health: 'on-time' | 'tight' | 'late' | 'unknown';
};

type ApiData = {
  tours: TourRow[];
  updatedAt: string;
};

const MOCK_DATA: ApiData = {
  tours: [
    {
      batchId: 't1', driverName: 'Max Müller', vehicle: 'Auto', score: 87, scoreLabel: 'Exzellent',
      stops: [
        { reihenfolge: 1, status: 'delivered', zone: 'Nord' },
        { reihenfolge: 2, status: 'arrived',   zone: 'Nord' },
        { reihenfolge: 3, status: 'pending',   zone: 'Mitte' },
      ],
      completedStops: 1, totalStops: 3, startedAt: new Date(Date.now() - 18 * 60_000).toISOString(),
      etaMin: 32, remainMin: 14, zone: 'Nord', health: 'on-time',
    },
    {
      batchId: 't2', driverName: 'Anna Schmidt', vehicle: 'Fahrrad', score: 61, scoreLabel: 'OK',
      stops: [
        { reihenfolge: 1, status: 'delivered', zone: 'Süd' },
        { reihenfolge: 2, status: 'delivered', zone: 'Süd' },
        { reihenfolge: 3, status: 'pending',   zone: 'West' },
        { reihenfolge: 4, status: 'pending',   zone: 'West' },
      ],
      completedStops: 2, totalStops: 4, startedAt: new Date(Date.now() - 35 * 60_000).toISOString(),
      etaMin: 45, remainMin: 10, zone: 'Süd', health: 'tight',
    },
    {
      batchId: 't3', driverName: 'Tom Weber', vehicle: 'Auto', score: 43, scoreLabel: 'Schwach',
      stops: [
        { reihenfolge: 1, status: 'pending', zone: 'Ost' },
        { reihenfolge: 2, status: 'pending', zone: 'Ost' },
      ],
      completedStops: 0, totalStops: 2, startedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      etaMin: 25, remainMin: 25, zone: 'Ost', health: 'late',
    },
  ],
  updatedAt: new Date().toISOString(),
};

function scoreColor(score: number | null): string {
  if (score === null) return 'text-muted-foreground';
  if (score >= 80) return 'text-matcha-600 dark:text-matcha-400';
  if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
  if (score >= 40) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

function scoreBg(score: number | null): string {
  if (score === null) return 'bg-muted';
  if (score >= 80) return 'bg-matcha-500';
  if (score >= 60) return 'bg-yellow-400';
  if (score >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

const HEALTH_STYLE = {
  'on-time': { label: 'Pünktlich',  badge: 'bg-matcha-500 text-white',           ring: 'ring-matcha-300'  },
  tight:     { label: 'Knapp',      badge: 'bg-amber-400 text-white',             ring: 'ring-amber-300'   },
  late:      { label: 'Verspätet', badge: 'bg-red-500 text-white',               ring: 'ring-red-300'     },
  unknown:   { label: 'Unbekannt', badge: 'bg-muted text-muted-foreground',       ring: ''                 },
};

function ProgressRing({ pct, color }: { pct: number; color: string }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0">
      <circle cx="22" cy="22" r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/30" />
      <circle
        cx="22" cy="22" r={r} fill="none" stroke="currentColor" strokeWidth="4"
        className={color} strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 22 22)"
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
      <text x="22" y="26" textAnchor="middle" fontSize="10" fontWeight="900" className={cn('fill-current', color)}>
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

export function DispatchPhase1205TourScoreVisualisierungDashboard({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) { setData(MOCK_DATA); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/batches/active?location_id=${locationId}&include_stops=true&include_drivers=true`);
      if (!res.ok) throw new Error('err');
      const json = await res.json();
      // Transform API response to our format, fall back to mock if empty
      if (json?.batches?.length) {
        const tours: TourRow[] = (json.batches as Array<{
          id: string;
          driver?: { vorname?: string; nachname?: string; fahrzeug?: string } | null;
          dispatch_score?: number | null;
          stops?: Array<{ reihenfolge: number; geliefert_am: string | null; angekommen_am: string | null; zone?: string | null }>;
          started_at?: string | null;
          total_eta_min?: number | null;
          zone?: string | null;
        }>).map(b => {
          const stops: TourStop[] = (b.stops ?? []).map(s => ({
            reihenfolge: s.reihenfolge,
            status: s.geliefert_am ? 'delivered' : s.angekommen_am ? 'arrived' : 'pending',
            zone: s.zone ?? null,
          }));
          const completed = stops.filter(s => s.status === 'delivered').length;
          const score = b.dispatch_score ?? null;
          const scoreLabel = score == null ? null : score >= 80 ? 'Exzellent' : score >= 60 ? 'Gut' : score >= 40 ? 'OK' : 'Schwach';
          const etaMin = b.total_eta_min ?? null;
          const elapsedMin = b.started_at ? Math.floor((Date.now() - new Date(b.started_at).getTime()) / 60_000) : 0;
          const remainMin = etaMin != null ? Math.max(0, etaMin - elapsedMin) : null;
          const health: TourRow['health'] = remainMin == null ? 'unknown'
            : remainMin <= 0 ? 'late' : remainMin <= 10 ? 'tight' : 'on-time';
          return {
            batchId: b.id,
            driverName: b.driver ? `${b.driver.vorname ?? ''} ${b.driver.nachname ?? ''}`.trim() : 'Unbekannt',
            vehicle: b.driver?.fahrzeug ?? 'Auto',
            score, scoreLabel, stops, completedStops: completed, totalStops: stops.length,
            startedAt: b.started_at ?? null, etaMin, remainMin, zone: b.zone ?? null, health,
          };
        });
        setData({ tours, updatedAt: new Date().toISOString() });
      } else {
        setData(MOCK_DATA);
      }
    } catch {
      setData(MOCK_DATA);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    void load();
    const iv = setInterval(() => void load(), 30_000);
    return () => clearInterval(iv);
  }, [load]);

  const tours = data?.tours ?? [];
  if (tours.length === 0) return null;

  const avgScore = tours.filter(t => t.score != null).reduce((a, t) => a + (t.score ?? 0), 0) / (tours.filter(t => t.score != null).length || 1);
  const lateCount = tours.filter(t => t.health === 'late').length;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/40 transition"
      >
        <Route className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">
          Tour-Score-Visualisierung
        </span>
        {lateCount > 0 && (
          <span className="rounded-full bg-red-500 text-white px-2 py-0.5 text-[10px] font-black animate-pulse">
            {lateCount} verspätet
          </span>
        )}
        <span className="ml-auto mr-1 rounded-full bg-matcha-100 text-matcha-700 px-2 py-0.5 text-[10px] font-bold tabular-nums">
          Ø {Math.round(avgScore)} Pkt.
        </span>
        <Badge variant="secondary" className="text-[10px]">{tours.length} Touren</Badge>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="divide-y">
          {tours.map(tour => {
            const hs = HEALTH_STYLE[tour.health];
            const pct = tour.totalStops > 0 ? Math.round((tour.completedStops / tour.totalStops) * 100) : 0;
            const ringColor = tour.health === 'on-time' ? 'text-matcha-500'
              : tour.health === 'tight' ? 'text-amber-500'
              : tour.health === 'late' ? 'text-red-500'
              : 'text-muted-foreground';

            return (
              <div key={tour.batchId} className="px-4 py-3">
                {/* Row header */}
                <div className="flex items-center gap-3">
                  {/* Progress ring */}
                  <ProgressRing pct={pct} color={ringColor} />

                  {/* Driver + zone info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black truncate">{tour.driverName}</span>
                      <span className="text-[10px] rounded-full bg-muted px-1.5 py-0.5 font-bold">
                        {tour.vehicle}
                      </span>
                      {tour.zone && (
                        <span className="text-[10px] rounded-full bg-matcha-100 text-matcha-700 px-1.5 py-0.5 font-bold">
                          <MapPin className="inline h-2.5 w-2.5 mr-0.5" />{tour.zone}
                        </span>
                      )}
                      <span className={cn('text-[9px] rounded-full px-2 py-0.5 font-black ml-auto', hs.badge)}>
                        {hs.label}
                      </span>
                    </div>

                    {/* Score bar */}
                    {tour.score !== null && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <Star className={cn('h-3 w-3 shrink-0', scoreColor(tour.score))} />
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all duration-700', scoreBg(tour.score))}
                            style={{ width: `${tour.score}%` }}
                          />
                        </div>
                        <span className={cn('text-xs font-black tabular-nums shrink-0', scoreColor(tour.score))}>
                          {tour.score} <span className="text-[9px] font-normal">{tour.scoreLabel}</span>
                        </span>
                      </div>
                    )}

                    {/* ETA + elapsed */}
                    <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                      {tour.remainMin !== null && (
                        <span className={cn('flex items-center gap-0.5 font-bold', tour.health === 'late' ? 'text-red-600' : tour.health === 'tight' ? 'text-amber-600' : 'text-matcha-600')}>
                          <Clock className="h-3 w-3" />
                          ~{tour.remainMin} Min verbleibend
                        </span>
                      )}
                      <span>{tour.completedStops}/{tour.totalStops} Stopps</span>
                      {tour.etaMin && <span>ETA-Budget: {tour.etaMin} Min</span>}
                    </div>
                  </div>
                </div>

                {/* Stop-Timeline */}
                {tour.stops.length > 0 && (
                  <div className="mt-2 flex items-center gap-1 ml-11 flex-wrap">
                    {tour.stops.map(stop => (
                      <div
                        key={stop.reihenfolge}
                        className={cn(
                          'flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[9px] font-bold border',
                          stop.status === 'delivered' ? 'bg-matcha-100 border-matcha-300 text-matcha-700'
                          : stop.status === 'arrived'  ? 'bg-amber-100 border-amber-300 text-amber-700 animate-pulse'
                          :                              'bg-muted border-border text-muted-foreground',
                        )}
                      >
                        {stop.reihenfolge}
                        {stop.zone && <span className="ml-0.5 opacity-70">{stop.zone}</span>}
                        {stop.status === 'delivered' && <span className="ml-0.5">✓</span>}
                        {stop.status === 'arrived'   && <span className="ml-0.5">→</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

'use client';

// Phase 1309 — Tour-Score-Dashboard (Dispatch)
// Übersicht aller aktiver Touren mit Live-Score (Pünktlichkeit, Effizienz, Kundenzufriedenheit).
// 5-Min-Polling · API /api/delivery/admin/tour-score-dashboard · Mock-Fallback
// Integration in dispatch/client.tsx nach Phase1306.

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Minus, Trophy, Star, Clock, Route } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TourScore {
  tour_id: string;
  fahrer_name: string;
  stopps_gesamt: number;
  stopps_erledigt: number;
  score_gesamt: number; // 0–100
  score_puenktlichkeit: number;
  score_effizienz: number;
  score_kundenzufriedenheit: number;
  trend: 'up' | 'down' | 'stable';
  eta_abweichung_min: number; // negativ = früher
  status: 'aktiv' | 'abgeschlossen' | 'pausiert';
}

interface Props {
  locationId: string | null;
}

const MOCK: TourScore[] = [
  {
    tour_id: 't1',
    fahrer_name: 'Thomas K.',
    stopps_gesamt: 4,
    stopps_erledigt: 2,
    score_gesamt: 88,
    score_puenktlichkeit: 92,
    score_effizienz: 85,
    score_kundenzufriedenheit: 90,
    trend: 'up',
    eta_abweichung_min: -3,
    status: 'aktiv',
  },
  {
    tour_id: 't2',
    fahrer_name: 'Maria S.',
    stopps_gesamt: 3,
    stopps_erledigt: 1,
    score_gesamt: 71,
    score_puenktlichkeit: 68,
    score_effizienz: 74,
    score_kundenzufriedenheit: 75,
    trend: 'stable',
    eta_abweichung_min: 5,
    status: 'aktiv',
  },
  {
    tour_id: 't3',
    fahrer_name: 'Ahmed R.',
    stopps_gesamt: 5,
    stopps_erledigt: 4,
    score_gesamt: 95,
    score_puenktlichkeit: 98,
    score_effizienz: 93,
    score_kundenzufriedenheit: 97,
    trend: 'up',
    eta_abweichung_min: -8,
    status: 'aktiv',
  },
];

const POLL_MS = 5 * 60_000;

function scoreColor(score: number): string {
  if (score >= 90) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 75) return 'text-blue-600 dark:text-blue-400';
  if (score >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function scoreBg(score: number): string {
  if (score >= 90) return 'bg-emerald-500';
  if (score >= 75) return 'bg-blue-500';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

export function DispatchPhase1309TourScoreDashboard({ locationId }: Props) {
  const [data, setData] = useState<TourScore[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/tour-score-dashboard?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
      else setData(MOCK);
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  if (!data || data.length === 0) return null;

  const aktive = data.filter(t => t.status === 'aktiv');
  const avgScore = aktive.length > 0
    ? Math.round(aktive.reduce((sum, t) => sum + t.score_gesamt, 0) / aktive.length)
    : 0;

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-sm overflow-hidden mb-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-800 to-slate-700 text-white">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-yellow-400" />
          <span className="text-sm font-bold">Tour-Score-Dashboard</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className={cn('text-lg font-black', scoreColor(avgScore))}>{avgScore}</div>
            <div className="text-[9px] text-slate-300">Ø Score</div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Tour-Kacheln */}
      <div className="p-3 space-y-2">
        {aktive.map((tour, idx) => (
          <div key={tour.tour_id} className="rounded-xl border border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 p-3">
            {/* Top Row */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {idx === 0 && <span className="text-sm">🥇</span>}
                {idx === 1 && <span className="text-sm">🥈</span>}
                {idx === 2 && <span className="text-sm">🥉</span>}
                {idx > 2 && <span className="text-xs font-bold text-stone-400">#{idx + 1}</span>}
                <span className="text-sm font-semibold text-stone-700 dark:text-stone-200">{tour.fahrer_name}</span>
              </div>
              <div className="flex items-center gap-2">
                {tour.trend === 'up' && <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />}
                {tour.trend === 'down' && <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
                {tour.trend === 'stable' && <Minus className="h-3.5 w-3.5 text-stone-400" />}
                <span className={cn('text-xl font-black', scoreColor(tour.score_gesamt))}>{tour.score_gesamt}</span>
              </div>
            </div>

            {/* Score-Balken */}
            <div className="w-full bg-stone-200 dark:bg-stone-700 rounded-full h-2 mb-2">
              <div
                className={cn('h-2 rounded-full transition-all duration-700', scoreBg(tour.score_gesamt))}
                style={{ width: `${tour.score_gesamt}%` }}
              />
            </div>

            {/* Sub-Scores */}
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              {[
                { label: 'Pünktl.', value: tour.score_puenktlichkeit, icon: <Clock className="h-3 w-3" /> },
                { label: 'Effizien.', value: tour.score_effizienz, icon: <Route className="h-3 w-3" /> },
                { label: 'Kunden', value: tour.score_kundenzufriedenheit, icon: <Star className="h-3 w-3" /> },
              ].map(sub => (
                <div key={sub.label} className="rounded-lg bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-700 px-2 py-1.5 text-center">
                  <div className={cn('flex items-center justify-center gap-0.5 mb-0.5', scoreColor(sub.value))}>
                    {sub.icon}
                    <span className="text-xs font-black">{sub.value}</span>
                  </div>
                  <div className="text-[9px] text-stone-400">{sub.label}</div>
                </div>
              ))}
            </div>

            {/* Bottom Row */}
            <div className="flex items-center justify-between text-[10px] text-stone-500 dark:text-stone-400">
              <span>{tour.stopps_erledigt}/{tour.stopps_gesamt} Stopps</span>
              <span className={tour.eta_abweichung_min < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                ETA {tour.eta_abweichung_min > 0 ? '+' : ''}{tour.eta_abweichung_min} Min
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

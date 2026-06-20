'use client';

/**
 * KitchenStandortHealthStreifen — Phase 347
 *
 * Kompakter Streifen im Küchen-Dashboard der den Gesundheits-Score des
 * Standorts (A+ bis F) mit Trend-Pfeil und schwächster Dimension zeigt.
 *
 * Bezieht Daten von GET /api/delivery/admin/location-health — pollt alle 5 Min.
 */

import { useEffect, useState } from 'react';
import { Activity, TrendingDown, TrendingUp, Minus, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HealthSnapshot {
  overallScore: number;
  grade: string;
  trend: 'up' | 'stable' | 'down';
  scoreDelta: number;
  weakestDimension: string | null;
  onTimeScore: number;
  driverScore: number;
  cancelScore: number;
  ratingScore: number;
}

interface HealthDashboard {
  latest: HealthSnapshot | null;
  recommendations: string[];
}

function gradeColor(grade: string): string {
  if (grade === 'A+' || grade === 'A') return 'text-matcha-700 bg-matcha-100 border-matcha-300';
  if (grade === 'B+' || grade === 'B') return 'text-amber-700 bg-amber-50 border-amber-200';
  if (grade === 'C') return 'text-orange-700 bg-orange-50 border-orange-200';
  return 'text-red-700 bg-red-50 border-red-200';
}

function dimLabel(dim: string | null): string {
  if (!dim) return '';
  const MAP: Record<string, string> = {
    pünktlichkeit: 'Pünktlichkeit',
    fahrerverfügbarkeit: 'Fahrer',
    stornoquote: 'Stornoquote',
    kundenzufriedenheit: 'Bewertung',
  };
  return MAP[dim] ?? dim;
}

export function KitchenStandortHealthStreifen({ locationId }: { locationId: string }) {
  const [data, setData] = useState<HealthDashboard | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    const load = () => {
      fetch(`/api/delivery/admin/location-health?location_id=${encodeURIComponent(locationId)}`, { cache: 'no-store' })
        .then((r) => r.ok ? r.json() : null)
        .then((d: HealthDashboard | null) => { if (!cancelled && d) setData(d); })
        .catch(() => { if (!cancelled) setError(true); });
    };
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (error || !data?.latest) return null;

  const { overallScore, grade, trend, scoreDelta, weakestDimension, recommendations } = data;
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-matcha-600' : trend === 'down' ? 'text-red-500' : 'text-stone-400';

  return (
    <div className="rounded-xl border bg-white px-4 py-3 flex items-center gap-3 shadow-sm">
      <Activity className="h-4 w-4 shrink-0 text-matcha-600" />
      <span className="text-xs font-bold text-stone-600 shrink-0">Standort-Note</span>

      {/* Grade badge */}
      <span className={cn('shrink-0 rounded-md border px-2 py-0.5 text-sm font-black tabular-nums', gradeColor(grade))}>
        {grade}
      </span>

      {/* Score */}
      <span className="text-sm font-bold tabular-nums text-stone-700 shrink-0">
        {Math.round(overallScore)}/100
      </span>

      {/* Trend */}
      <div className={cn('flex items-center gap-0.5 shrink-0', trendColor)}>
        <TrendIcon className="h-3.5 w-3.5" />
        {scoreDelta !== 0 && (
          <span className="text-[10px] font-bold tabular-nums">
            {scoreDelta > 0 ? '+' : ''}{Math.round(scoreDelta)}
          </span>
        )}
      </div>

      {/* Weakest dimension */}
      {weakestDimension && (
        <div className="flex items-center gap-1 text-amber-600 shrink-0">
          <AlertTriangle className="h-3 w-3" />
          <span className="text-[10px] font-semibold">Schwach: {dimLabel(weakestDimension)}</span>
        </div>
      )}

      {/* Top recommendation */}
      {recommendations.length > 0 && (
        <span className="hidden sm:block text-[10px] text-stone-400 truncate flex-1 min-w-0 italic">
          {recommendations[0]}
        </span>
      )}
    </div>
  );
}

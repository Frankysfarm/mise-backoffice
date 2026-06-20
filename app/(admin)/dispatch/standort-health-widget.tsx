'use client';

/**
 * DispatchStandortHealthWidget — Phase 347
 *
 * Aufklappbares Dispatch-Widget: Gesundheits-Score (0–100) + alle 4 Dimensionen
 * als Fortschrittsbalken + Top-Empfehlungen.
 *
 * API: GET /api/delivery/admin/location-health?location_id=...
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Activity, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, Minus, Loader2,
} from 'lucide-react';

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

function gradeStyle(grade: string) {
  if (grade === 'A+' || grade === 'A')  return { bg: 'bg-matcha-500',  text: 'text-white' };
  if (grade === 'B+' || grade === 'B')  return { bg: 'bg-amber-400',   text: 'text-white' };
  if (grade === 'C')                    return { bg: 'bg-orange-500',  text: 'text-white' };
  return { bg: 'bg-red-500', text: 'text-white' };
}

function barColor(score: number): string {
  if (score >= 70) return 'bg-matcha-500';
  if (score >= 45) return 'bg-amber-400';
  return 'bg-red-400';
}

const DIMENSIONS = [
  { key: 'onTimeScore',  label: 'Pünktlichkeit',      weight: '40%' },
  { key: 'driverScore',  label: 'Fahrerverfüg.',       weight: '25%' },
  { key: 'cancelScore',  label: 'Stornoquote (inv.)',  weight: '20%' },
  { key: 'ratingScore',  label: 'Kundenzufriedenheit', weight: '15%' },
] as const;

export function DispatchStandortHealthWidget({ locationId }: { locationId: string }) {
  const [data, setData] = useState<HealthDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    const load = () => {
      fetch(`/api/delivery/admin/location-health?location_id=${encodeURIComponent(locationId)}`, { cache: 'no-store' })
        .then((r) => r.ok ? r.json() : null)
        .then((d: HealthDashboard | null) => { if (!cancelled) { setData(d); setLoading(false); } })
        .catch(() => { if (!cancelled) setLoading(false); });
    };
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-3 flex items-center gap-2 text-xs text-stone-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Standort-Score lädt…
      </div>
    );
  }
  if (!data?.latest) return null;

  const snap = data.latest;
  const gs = gradeStyle(snap.grade);
  const TrendIcon = snap.trend === 'up' ? TrendingUp : snap.trend === 'down' ? TrendingDown : Minus;
  const trendColor = snap.trend === 'up' ? 'text-matcha-600' : snap.trend === 'down' ? 'text-red-500' : 'text-stone-400';

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-stone-50 transition-colors text-left"
      >
        <Activity className="h-4 w-4 shrink-0 text-matcha-600" />
        <span className="text-xs font-bold text-stone-600 flex-1">Standort-Gesundheit</span>

        {/* Grade */}
        <span className={cn('rounded-md px-2 py-0.5 text-sm font-black', gs.bg, gs.text)}>
          {snap.grade}
        </span>
        {/* Score */}
        <span className="text-sm font-bold tabular-nums text-stone-700">
          {Math.round(snap.overallScore)}/100
        </span>
        {/* Trend */}
        <TrendIcon className={cn('h-4 w-4', trendColor)} />
        {/* Toggle */}
        {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
      </button>

      {/* Expanded body */}
      {open && (
        <div className="px-4 pb-4 border-t border-stone-100 space-y-3 pt-3">
          {/* Dimension bars */}
          <div className="space-y-2">
            {DIMENSIONS.map((dim) => {
              const score = snap[dim.key];
              return (
                <div key={dim.key} className="flex items-center gap-2">
                  <span className="w-36 shrink-0 text-[11px] text-stone-500 truncate">
                    {dim.label} <span className="text-stone-300">({dim.weight})</span>
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', barColor(score))}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-[11px] font-bold tabular-nums text-stone-700">
                    {Math.round(score)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Delta */}
          {snap.scoreDelta !== 0 && (
            <div className={cn('text-xs font-semibold', trendColor)}>
              Score-Änderung: {snap.scoreDelta > 0 ? '+' : ''}{snap.scoreDelta.toFixed(1)} Punkte vs. Vortag
            </div>
          )}

          {/* Recommendations */}
          {data.recommendations.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Empfehlungen</div>
              {data.recommendations.slice(0, 3).map((rec, i) => (
                <div key={i} className="text-xs text-stone-600 flex items-start gap-1.5">
                  <span className="shrink-0 mt-0.5 h-1.5 w-1.5 rounded-full bg-matcha-400" />
                  {rec}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

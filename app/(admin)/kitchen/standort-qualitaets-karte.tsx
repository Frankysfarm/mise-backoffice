'use client';

import { useEffect, useState } from 'react';
import { Award, TrendingUp, TrendingDown, Minus, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type QualityComponents = {
  scoreOntime: number;
  scoreSatisfaction: number;
  scoreAccuracy: number;
  scoreSla: number;
  scoreCancel: number;
};

type QualitySnapshot = {
  overallScore: number;
  grade: string;
  components: QualityComponents;
  weakestDimension: string;
  totalOrders: number;
  ontimeOrders: number;
};

type QualityDashboard = {
  today: QualitySnapshot | null;
  yesterday: QualitySnapshot | null;
  weeklyAvg: number;
};

const GRADE_COLOR: Record<string, string> = {
  A: 'bg-matcha-100 text-matcha-700 border-matcha-300',
  B: 'bg-lime-100 text-lime-700 border-lime-300',
  C: 'bg-amber-100 text-amber-700 border-amber-300',
  D: 'bg-orange-100 text-orange-700 border-orange-300',
  F: 'bg-red-100 text-red-700 border-red-300',
};

const DIM_LABELS: Record<string, string> = {
  scoreOntime: 'Pünktlichkeit',
  scoreSatisfaction: 'Zufriedenheit',
  scoreAccuracy: 'Genauigkeit',
  scoreSla: 'SLA',
  scoreCancel: 'Storno',
};

const BARS: Array<{ key: keyof QualityComponents; label: string; weight: string }> = [
  { key: 'scoreOntime', label: 'Pünktl.', weight: '30%' },
  { key: 'scoreSatisfaction', label: 'Zufr.', weight: '25%' },
  { key: 'scoreAccuracy', label: 'Genau.', weight: '20%' },
  { key: 'scoreSla', label: 'SLA', weight: '15%' },
  { key: 'scoreCancel', label: 'Storno', weight: '10%' },
];

export function KitchenStandortQualitaetsKarte() {
  const [data, setData] = useState<QualityDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    function load() {
      fetch('/api/delivery/admin/quality-score?action=dashboard')
        .then((r) => r.json())
        .then((d) => { if (!cancelled && d.dashboard) setData(d.dashboard); })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
    }
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 flex items-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Qualitäts-Score wird geladen…</span>
      </div>
    );
  }

  if (!data?.today) return null;

  const { today, yesterday, weeklyAvg } = data;
  const delta = yesterday ? today.overallScore - yesterday.overallScore : null;
  const gradeClass = GRADE_COLOR[today.grade] ?? GRADE_COLOR['F'];
  const weakLabel = DIM_LABELS[today.weakestDimension] ?? today.weakestDimension;

  const scoreColor =
    today.overallScore >= 80 ? 'text-matcha-700'
    : today.overallScore >= 60 ? 'text-amber-600'
    : 'text-red-600';

  const borderColor =
    today.overallScore >= 80 ? 'border-matcha-200'
    : today.overallScore >= 60 ? 'border-amber-200'
    : 'border-red-200';

  return (
    <div className={cn('rounded-2xl border bg-white p-4', borderColor)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-matcha-100">
            <Award className="h-4 w-4 text-matcha-700" />
          </div>
          <span className="text-sm font-bold text-stone-800">Standort-Qualitätsscore</span>
        </div>
        <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-black', gradeClass)}>
          Note {today.grade}
        </span>
      </div>

      {/* Main score */}
      <div className="flex items-end gap-3 mb-4">
        <span className={cn('text-4xl font-black tabular-nums leading-none', scoreColor)}>
          {Math.round(today.overallScore)}
        </span>
        <div className="mb-0.5 flex flex-col gap-0.5">
          <span className="text-xs text-stone-400 font-medium">/ 100</span>
          {delta !== null && (
            <div className={cn(
              'flex items-center gap-0.5 text-[11px] font-bold',
              delta > 0 ? 'text-matcha-600' : delta < 0 ? 'text-red-500' : 'text-stone-400',
            )}>
              {delta > 0 ? <TrendingUp className="h-3 w-3" /> : delta < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
              {delta > 0 ? '+' : ''}{delta.toFixed(1)} gg. gestern
            </div>
          )}
        </div>
        <div className="ml-auto text-right">
          <div className="text-xs text-stone-400">Ø Woche</div>
          <div className="text-sm font-bold text-stone-700 tabular-nums">{weeklyAvg.toFixed(1)}</div>
        </div>
      </div>

      {/* Component bars */}
      <div className="space-y-1.5 mb-3">
        {BARS.map(({ key, label, weight }) => {
          const val = today.components[key];
          const isWeakest = today.weakestDimension === key;
          return (
            <div key={key} className="flex items-center gap-2">
              <span className={cn('w-14 shrink-0 text-[10px] font-semibold truncate', isWeakest ? 'text-red-600' : 'text-stone-500')}>
                {label}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-stone-100 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-700',
                    val >= 80 ? 'bg-matcha-500' : val >= 60 ? 'bg-amber-400' : 'bg-red-400',
                  )}
                  style={{ width: `${val}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-right text-[10px] font-bold tabular-nums text-stone-600">
                {Math.round(val)}
              </span>
              <span className="w-7 shrink-0 text-right text-[9px] text-stone-300">{weight}</span>
            </div>
          );
        })}
      </div>

      {/* Weakest dimension alert */}
      {today.overallScore < 80 && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
          <span className="text-[11px] text-amber-700 font-medium">
            Schwächste Dimension: <strong>{weakLabel}</strong> — Optimierungspotenzial
          </span>
        </div>
      )}

      <div className="mt-2 text-[9px] text-stone-300 text-right">
        {today.totalOrders} Bestellungen · {today.ontimeOrders} pünktlich
      </div>
    </div>
  );
}

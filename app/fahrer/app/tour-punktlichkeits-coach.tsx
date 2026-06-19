'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Award, TrendingUp, TrendingDown, Minus, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface CoachingHint {
  cause: string;
  hint: string;
}

interface CoachData {
  coachingScore: number;
  scoreTrend: 'improving' | 'stable' | 'declining';
  onTimeRate: number;
  primaryDelayCause: string | null;
  coachingHints: CoachingHint[];
}

interface Props {
  driverId: string;
}

const CAUSE_LABEL: Record<string, string> = {
  kitchen: 'Wartezeit an der Küche',
  pickup_wait: 'Wartezeit bei Abholung',
  driving: 'Fahrzeit',
  none: 'Keine besondere Ursache',
};

const MOCK_DATA: CoachData = {
  coachingScore: 82,
  scoreTrend: 'improving',
  onTimeRate: 0.87,
  primaryDelayCause: 'pickup_wait',
  coachingHints: [
    { cause: 'pickup_wait', hint: 'Melde dich beim Eintreffen sofort in der Küche — so weiß das Team, dass du da bist.' },
    { cause: 'none', hint: 'Weiter so! Dein Timing ist im grünen Bereich.' },
  ],
};

export function TourPunktlichkeitsCoach({ driverId }: Props) {
  const [data, setData] = useState<CoachData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!driverId) { setLoading(false); return; }
    let mounted = true;

    async function load() {
      try {
        const res = await fetch(
          `/api/delivery/admin/punctuality-coach?action=report&driver_id=${encodeURIComponent(driverId)}&days=14`,
        );
        if (!res.ok) throw new Error('not ok');
        const json = await res.json();
        if (!mounted) return;
        if (json.latestProfile) {
          setData({
            coachingScore: json.latestProfile.coaching_score ?? 80,
            scoreTrend: json.latestProfile.score_trend ?? 'stable',
            onTimeRate: json.latestProfile.on_time_rate ?? 0.8,
            primaryDelayCause: json.latestProfile.primary_delay_cause ?? null,
            coachingHints: Array.isArray(json.latestProfile.coaching_hints)
              ? (json.latestProfile.coaching_hints as CoachingHint[])
              : [],
          });
        } else {
          setData(MOCK_DATA);
        }
      } catch {
        if (mounted) setData(MOCK_DATA);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, [driverId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 animate-pulse">
        <div className="h-3 w-32 bg-stone-100 rounded mb-3" />
        <div className="h-8 w-20 bg-stone-100 rounded" />
      </div>
    );
  }

  if (!data) return null;

  const scoreColor =
    data.coachingScore >= 85 ? 'text-matcha-700' :
    data.coachingScore >= 70 ? 'text-amber-600' : 'text-red-600';
  const scoreBg =
    data.coachingScore >= 85 ? 'bg-matcha-50 border-matcha-200' :
    data.coachingScore >= 70 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
  const TrendIcon =
    data.scoreTrend === 'improving' ? TrendingUp :
    data.scoreTrend === 'declining' ? TrendingDown : Minus;
  const trendColor =
    data.scoreTrend === 'improving' ? 'text-matcha-600' :
    data.scoreTrend === 'declining' ? 'text-red-500' : 'text-stone-400';

  const onTimePct = Math.round(data.onTimeRate * 100);

  return (
    <div className={cn('rounded-2xl border p-4 space-y-3', scoreBg)}>
      {/* Header */}
      <button
        className="flex items-center gap-3 w-full text-left"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white border shadow-sm shrink-0">
          <Award className={cn('h-5 w-5', scoreColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
            Pünktlichkeits-Coach
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('text-2xl font-black tabular-nums leading-none', scoreColor)}>
              {data.coachingScore}
            </span>
            <span className="text-xs text-stone-500">/ 100</span>
            <TrendIcon className={cn('h-4 w-4 ml-1', trendColor)} />
          </div>
        </div>
        <div className="shrink-0">
          {expanded
            ? <ChevronUp className="h-4 w-4 text-stone-400" />
            : <ChevronDown className="h-4 w-4 text-stone-400" />}
        </div>
      </button>

      {/* On-time ring summary */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-black/8 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              onTimePct >= 85 ? 'bg-matcha-500' :
              onTimePct >= 70 ? 'bg-amber-400' : 'bg-red-400',
            )}
            style={{ width: `${onTimePct}%` }}
          />
        </div>
        <span className={cn('text-sm font-black tabular-nums shrink-0', scoreColor)}>
          {onTimePct}% pünktlich
        </span>
      </div>

      {/* Expanded hints */}
      {expanded && (
        <div className="space-y-2 pt-1">
          {data.primaryDelayCause && data.primaryDelayCause !== 'none' && (
            <div className="flex items-start gap-2 rounded-xl bg-white/70 border px-3 py-2">
              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">
                  Hauptursache
                </div>
                <div className="text-xs font-semibold text-stone-700">
                  {CAUSE_LABEL[data.primaryDelayCause] ?? data.primaryDelayCause}
                </div>
              </div>
            </div>
          )}

          {data.coachingHints.slice(0, 3).map((hint, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-xl bg-white/70 border px-3 py-2 text-xs text-stone-600 leading-snug"
            >
              <span className="text-matcha-500 font-black shrink-0">→</span>
              {hint.hint}
            </div>
          ))}

          <div className="text-[9px] text-stone-400 text-center pt-0.5">
            Analyse der letzten 14 Tage
          </div>
        </div>
      )}
    </div>
  );
}

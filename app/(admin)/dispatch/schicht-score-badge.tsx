'use client';

/**
 * DispatchSchichtScoreBadge — Phase 412
 *
 * Kompaktes Schicht-Score-Badge für Dispatch.
 * Zeigt: ShiftScore, isOnTrack, Pünktlichkeits-Delta.
 * API: GET /api/delivery/admin/schicht-vergleich?location_id=...
 */

import { useEffect, useState } from 'react';
import { Target, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScoreData {
  shiftScore: number;
  scoreLabel: 'exzellent' | 'gut' | 'okay' | 'schwach';
  isOnTrack: boolean;
  delta: { onTimePtsDiff: number | null; deliveryMinPct: number | null };
}

const SCORE_COLORS = {
  exzellent: { bg: 'bg-matcha-50', border: 'border-matcha-200', text: 'text-matcha-700', dot: 'bg-matcha-500' },
  gut:       { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  okay:      { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-400' },
  schwach:   { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', dot: 'bg-red-500' },
};

export function DispatchSchichtScoreBadge({ locationId }: { locationId: string }) {
  const [data, setData] = useState<ScoreData | null>(null);

  useEffect(() => {
    if (!locationId) return;
    const load = () =>
      fetch(`/api/delivery/admin/schicht-vergleich?location_id=${encodeURIComponent(locationId)}`)
        .then(r => r.ok ? r.json() : null)
        .then(j => j && setData({
          shiftScore: j.shiftScore ?? 0,
          scoreLabel: j.scoreLabel ?? 'okay',
          isOnTrack: j.isOnTrack ?? false,
          delta: {
            onTimePtsDiff: j.delta?.onTimePtsDiff ?? null,
            deliveryMinPct: j.delta?.deliveryMinPct ?? null,
          },
        }))
        .catch(() => {});
    load();
    const t = setInterval(load, 5 * 60_000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const scoreLabel = data.scoreLabel as keyof typeof SCORE_COLORS;
  const c = SCORE_COLORS[scoreLabel];
  const label = { exzellent: 'Exzellent', gut: 'Gut', okay: 'Okay', schwach: 'Schwach' }[scoreLabel];

  return (
    <div className={cn('flex items-center gap-3 rounded-xl border px-4 py-2.5', c.bg, c.border)}>
      <div className="flex items-center gap-2 shrink-0">
        <div className={cn('h-2.5 w-2.5 rounded-full', c.dot)} />
        <Target className={cn('h-3.5 w-3.5', c.text)} />
        <span className={cn('text-sm font-black tabular-nums', c.text)}>
          {Math.round(data.shiftScore)}
        </span>
        <span className={cn('text-[11px] font-bold', c.text)}>{label}</span>
      </div>

      <div className="h-4 w-px bg-stone-200 shrink-0" />

      {data.isOnTrack ? (
        <span className="flex items-center gap-1 text-[10px] font-bold text-matcha-700">
          <CheckCircle2 className="h-3 w-3" /> On Track
        </span>
      ) : (
        <span className="flex items-center gap-1 text-[10px] font-bold text-red-600">
          <AlertCircle className="h-3 w-3" /> Abweichung
        </span>
      )}

      {data.delta.onTimePtsDiff !== null && (
        <>
          <div className="h-4 w-px bg-stone-200 shrink-0" />
          <span className={cn('flex items-center gap-1 text-[10px] font-bold',
            data.delta.onTimePtsDiff >= 0 ? 'text-matcha-700' : 'text-red-600'
          )}>
            <Clock className="h-3 w-3" />
            {data.delta.onTimePtsDiff > 0 ? '+' : ''}{data.delta.onTimePtsDiff.toFixed(1)} Pkt Pünktlichkeit
          </span>
        </>
      )}
    </div>
  );
}

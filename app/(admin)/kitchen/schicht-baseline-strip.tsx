'use client';

/**
 * KitchenSchichtBaselineStrip — Phase 412
 *
 * Kompakter Schicht-Score-Strip für die Küche.
 * Zeigt: ShiftScore, isOnTrack, Umsatz- und Lieferungs-Delta vs. Baseline.
 * API: GET /api/delivery/admin/schicht-vergleich?location_id=...
 */

import { useEffect, useState } from 'react';
import { Target, CheckCircle2, AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VergleichData {
  shiftScore: number;
  scoreLabel: 'exzellent' | 'gut' | 'okay' | 'schwach';
  isOnTrack: boolean;
  delta: {
    umsatzPct: number | null;
    lieferungenPct: number | null;
  };
  recommendation: string | null;
}

const SCORE_STYLE = {
  exzellent: { text: 'text-matcha-700', bg: 'bg-matcha-500', pill: 'bg-matcha-100 text-matcha-700' },
  gut:       { text: 'text-emerald-700', bg: 'bg-emerald-500', pill: 'bg-emerald-100 text-emerald-700' },
  okay:      { text: 'text-amber-700', bg: 'bg-amber-500', pill: 'bg-amber-100 text-amber-700' },
  schwach:   { text: 'text-red-700', bg: 'bg-red-500', pill: 'bg-red-100 text-red-700' },
};

function DeltaChip({ value, label }: { value: number | null; label: string }) {
  if (value === null) return <span className="text-[10px] text-stone-400">{label}: —</span>;
  const Icon = Math.abs(value) < 1 ? Minus : value > 0 ? TrendingUp : TrendingDown;
  const color = Math.abs(value) < 1 ? 'text-stone-400' : value > 0 ? 'text-matcha-600' : 'text-red-500';
  return (
    <span className={cn('flex items-center gap-0.5 text-[10px] font-bold', color)}>
      <Icon className="h-2.5 w-2.5" />
      {value > 0 ? '+' : ''}{value.toFixed(1)}%
      <span className="font-normal text-stone-400 ml-0.5">{label}</span>
    </span>
  );
}

export function KitchenSchichtBaselineStrip({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<VergleichData | null>(null);

  useEffect(() => {
    if (!locationId) return;
    fetch(`/api/delivery/admin/schicht-vergleich?location_id=${encodeURIComponent(locationId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(j => j && setData({
        shiftScore: j.shiftScore ?? 0,
        scoreLabel: j.scoreLabel ?? 'okay',
        isOnTrack: j.isOnTrack ?? false,
        delta: {
          umsatzPct: j.delta?.umsatzPct ?? null,
          lieferungenPct: j.delta?.lieferungenPct ?? null,
        },
        recommendation: j.recommendation ?? null,
      }))
      .catch(() => {});
  }, [locationId]);

  if (!data) return null;

  const ss = SCORE_STYLE[data.scoreLabel];
  const scoreLabel = { exzellent: 'Exzellent', gut: 'Gut', okay: 'Okay', schwach: 'Schwach' }[data.scoreLabel];

  return (
    <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-2.5">
      {/* Score pill */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Target className={cn('h-3.5 w-3.5', ss.text)} />
        <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-black', ss.pill)}>
          {Math.round(data.shiftScore)} · {scoreLabel}
        </span>
      </div>

      {/* Track badge */}
      {data.isOnTrack ? (
        <span className="flex items-center gap-1 text-[10px] font-bold text-matcha-700 shrink-0">
          <CheckCircle2 className="h-3 w-3" /> On Track
        </span>
      ) : (
        <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 shrink-0">
          <AlertCircle className="h-3 w-3" /> Abweichung
        </span>
      )}

      {/* Deltas */}
      <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
        <DeltaChip value={data.delta.umsatzPct} label="Umsatz" />
        <DeltaChip value={data.delta.lieferungenPct} label="Ltg." />
      </div>

      {/* Recommendation (truncated) */}
      {data.recommendation && (
        <p className="hidden sm:block text-[10px] text-stone-500 truncate max-w-[200px]">{data.recommendation}</p>
      )}
    </div>
  );
}

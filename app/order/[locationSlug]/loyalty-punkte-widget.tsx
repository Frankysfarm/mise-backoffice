'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Star, Gift, TrendingUp, ChevronRight } from 'lucide-react';

interface LoyaltyBalance {
  points: number;
  tier: string | null;
  tierLabel: string | null;
  nextTierPoints: number | null;
  nextTierLabel: string | null;
  earnedToday: number;
}

interface Props {
  orderTotal: number;
  className?: string;
}

const POINTS_PER_EUR = 10;
const TIER_THRESHOLDS = [
  { points: 0,    tier: 'bronze',   label: 'Bronze',   color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  { points: 500,  tier: 'silver',   label: 'Silber',   color: 'text-gray-500',  bg: 'bg-gray-50',  border: 'border-gray-200' },
  { points: 1500, tier: 'gold',     label: 'Gold',     color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  { points: 3000, tier: 'platinum', label: 'Platin',   color: 'text-cyan-600',  bg: 'bg-cyan-50',  border: 'border-cyan-200' },
];

function getTierStyle(points: number) {
  let active = TIER_THRESHOLDS[0];
  for (const t of TIER_THRESHOLDS) {
    if (points >= t.points) active = t;
  }
  return active;
}

function getNextTier(points: number) {
  for (const t of TIER_THRESHOLDS) {
    if (points < t.points) return t;
  }
  return null;
}

export function LoyaltyPunkteWidget({ orderTotal, className }: Props) {
  const [data, setData] = useState<LoyaltyBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch('/api/delivery/loyalty/balance', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (cancelled) return;
        if (json && typeof json.points === 'number') {
          setData(json as LoyaltyBalance);
        } else {
          // Keine Loyalty-Daten — Komponente ausblenden
          setData(null);
        }
        setLoading(false);
        // Animate in
        setTimeout(() => setShown(true), 50);
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className={cn('rounded-2xl border bg-white/80 p-4 animate-pulse', className)}>
        <div className="h-3 w-32 bg-gray-100 rounded mb-2" />
        <div className="h-8 w-24 bg-gray-100 rounded" />
      </div>
    );
  }

  if (!data) return null;

  const earnedNow = Math.round(orderTotal * POINTS_PER_EUR);
  const totalPoints = data.points + earnedNow;
  const tierStyle = getTierStyle(totalPoints);
  const nextTier = getNextTier(totalPoints);
  const progressPct = nextTier
    ? Math.min(100, ((totalPoints - (getTierStyle(data.points).points)) / (nextTier.points - getTierStyle(data.points).points)) * 100)
    : 100;

  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden transition-all duration-500',
      tierStyle.bg, tierStyle.border,
      shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
      className,
    )}>
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
        <div className={cn(
          'h-8 w-8 rounded-full flex items-center justify-center shrink-0',
          tierStyle.bg, 'border', tierStyle.border,
        )}>
          <Star size={16} className={tierStyle.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-foreground">Treuepunkte</div>
          <div className={cn('text-[10px] font-semibold', tierStyle.color)}>{tierStyle.label}-Mitglied</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[11px] text-muted-foreground">Gesamt</div>
          <div className={cn('text-base font-black tabular-nums', tierStyle.color)}>
            {totalPoints.toLocaleString('de')}
          </div>
        </div>
      </div>

      {/* Earned now banner */}
      {earnedNow > 0 && (
        <div className="mx-3 mb-2 rounded-xl bg-white/70 border border-white/60 px-3 py-1.5 flex items-center gap-2">
          <TrendingUp size={12} className="text-matcha-600 shrink-0" />
          <span className="text-[11px] text-muted-foreground flex-1">Diese Bestellung</span>
          <span className="text-[12px] font-black text-matcha-600">+{earnedNow} Punkte</span>
        </div>
      )}

      {/* Progress to next tier */}
      {nextTier && (
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>{tierStyle.label}</span>
            <span className="flex items-center gap-0.5">
              <Gift size={9} /> Noch {(nextTier.points - totalPoints).toLocaleString('de')} Punkte bis {nextTier.label}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/70 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-1000', 'bg-current', tierStyle.color)}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {!nextTier && (
        <div className="px-4 pb-3 flex items-center gap-1 text-[11px] font-bold text-cyan-700">
          <Star size={11} /> Höchste Stufe erreicht — Platin-Mitglied!
        </div>
      )}
    </div>
  );
}

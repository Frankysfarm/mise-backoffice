'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Award, Star, Target, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  fertig_am: string | null;
  dispatch_score: number | null;
  delivery_zone: string | null;
};

type Props = {
  orders: Order[];
};

// ---------------------------------------------------------------------------
// Score-tier helpers
// ---------------------------------------------------------------------------

type Tier = 'optimal' | 'gut' | 'niedrig';

function getTier(score: number): Tier {
  if (score >= 80) return 'optimal';
  if (score >= 60) return 'gut';
  return 'niedrig';
}

const TIER_META: Record<Tier, {
  label: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
  barClass: string;
  icon: React.ReactNode;
}> = {
  optimal: {
    label: 'Optimal',
    textClass: 'text-matcha-700',
    bgClass: 'bg-matcha-50',
    borderClass: 'border-matcha-200',
    barClass: 'bg-matcha-600',
    icon: <Star className="h-2.5 w-2.5" />,
  },
  gut: {
    label: 'Gut',
    textClass: 'text-amber-700',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
    barClass: 'bg-amber-400',
    icon: <Target className="h-2.5 w-2.5" />,
  },
  niedrig: {
    label: 'Niedrig',
    textClass: 'text-red-700',
    bgClass: 'bg-red-50',
    borderClass: 'border-red-200',
    barClass: 'bg-red-500',
    icon: <TrendingDown className="h-2.5 w-2.5" />,
  },
};

function scoreTextClass(score: number): string {
  const tier = getTier(score);
  return TIER_META[tier].textClass;
}

function scoreBarClass(score: number): string {
  const tier = getTier(score);
  return TIER_META[tier].barClass;
}

// ---------------------------------------------------------------------------
// useTick — re-renders every `ms` milliseconds
// ---------------------------------------------------------------------------

function useTick(ms: number): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return tick;
}

// ---------------------------------------------------------------------------
// Wait-time formatting
// ---------------------------------------------------------------------------

function formatWait(fertigAm: string | null, now: Date): string {
  if (!fertigAm) return '—';
  const diff = Math.max(0, now.getTime() - new Date(fertigAm).getTime());
  const totalSec = Math.floor(diff / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (mins === 0) return `${secs}s`;
  if (mins < 60) return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins.toString().padStart(2, '0')}m`;
}

function waitUrgencyClass(fertigAm: string | null, now: Date): string {
  if (!fertigAm) return 'text-muted-foreground';
  const mins = (now.getTime() - new Date(fertigAm).getTime()) / 60_000;
  if (mins >= 20) return 'text-red-600 font-black';
  if (mins >= 10) return 'text-orange-500 font-bold';
  return 'text-muted-foreground';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="w-full h-1.5 rounded-full bg-matcha-100 overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all duration-500', scoreBarClass(score))}
        style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
      />
    </div>
  );
}

function TierBadge({ score }: { score: number }) {
  const tier = getTier(score);
  const meta = TIER_META[tier];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide',
        meta.textClass,
        meta.bgClass,
        meta.borderClass,
      )}
    >
      {meta.icon}
      {meta.label}
    </span>
  );
}

function ZoneBadge({ zone }: { zone: string | null }) {
  if (!zone) return null;
  return (
    <span className="rounded bg-matcha-100 text-matcha-700 px-1.5 py-0.5 text-[9px] font-bold">
      Zone {zone}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Score-Verteilung bar
// ---------------------------------------------------------------------------

function VerteilungBar({ label, count, total, tier }: {
  label: string;
  count: number;
  total: number;
  tier: Tier;
}) {
  const meta = TIER_META[tier];
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between gap-2">
        <span className={cn('text-[10px] font-bold flex items-center gap-1', meta.textClass)}>
          {meta.icon}
          {label}
        </span>
        <span className={cn('text-[10px] font-black tabular-nums', meta.textClass)}>
          {count}
          <span className="ml-1 font-normal text-muted-foreground">({pct}%)</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-matcha-100 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', meta.barClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function DispatchScoreInsightPanel({ orders }: Props) {
  useTick(1_000); // re-render every second for live wait times
  const now = new Date();

  // Only consider fertig orders with a dispatch_score
  const scored = orders.filter(
    (o) => o.status === 'fertig' && o.dispatch_score !== null,
  ) as (Order & { dispatch_score: number })[];

  if (scored.length === 0) return null;

  // Sort highest score first
  const sorted = [...scored].sort((a, b) => b.dispatch_score - a.dispatch_score);

  // Aggregate stats
  const scores = sorted.map((o) => o.dispatch_score);
  const avgScore = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
  const highestScore = scores[0];
  const lowestScore = scores[scores.length - 1];

  const tierCounts: Record<Tier, number> = { optimal: 0, gut: 0, niedrig: 0 };
  for (const s of scores) tierCounts[getTier(s)]++;

  const topOrder = sorted[0];

  return (
    <Card className="rounded-xl border border-matcha-200 bg-matcha-50 overflow-hidden">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="px-4 py-3 border-b border-matcha-200 bg-matcha-100/60">
        <div className="flex items-center gap-2 flex-wrap">
          <Zap className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="text-sm font-black text-matcha-900">Dispatch-Score Übersicht</span>

          {/* Waiting count */}
          <span className="rounded-full bg-matcha-200 text-matcha-800 px-2 py-0.5 text-[10px] font-black">
            {scored.length} wartend
          </span>

          {/* Zuweisung empfohlen badge for top scorer */}
          {topOrder.dispatch_score >= 60 && (
            <span className="flex items-center gap-1 rounded-full bg-matcha-600 text-white px-2 py-0.5 text-[9px] font-black">
              <Award className="h-2.5 w-2.5" />
              Zuweisung empfohlen
            </span>
          )}
        </div>

        {/* Stat strip */}
        <div className="mt-2 flex items-center gap-4 flex-wrap">
          {/* Avg */}
          <div className="flex items-center gap-1">
            <Target className="h-3 w-3 text-matcha-500" />
            <span className="text-[10px] text-matcha-700">
              Ø Score:{' '}
              <span className={cn('font-black tabular-nums', scoreTextClass(avgScore))}>
                {avgScore}
              </span>
            </span>
          </div>

          {/* Highest */}
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-matcha-500" />
            <span className="text-[10px] text-matcha-700">
              Höchst:{' '}
              <span className={cn('font-black tabular-nums', scoreTextClass(highestScore))}>
                {highestScore}
              </span>
            </span>
          </div>

          {/* Lowest */}
          <div className="flex items-center gap-1">
            <TrendingDown className="h-3 w-3 text-matcha-500" />
            <span className="text-[10px] text-matcha-700">
              Tiefst:{' '}
              <span className={cn('font-black tabular-nums', scoreTextClass(lowestScore))}>
                {lowestScore}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Live leaderboard                                                     */}
      {/* ------------------------------------------------------------------ */}
      <div className="divide-y divide-matcha-100 max-h-72 overflow-y-auto">
        {/* Column headers */}
        <div className="grid grid-cols-[1.5rem_1fr_auto_auto] gap-2 items-center px-4 py-1.5 bg-matcha-100/40 text-[9px] font-black uppercase tracking-widest text-matcha-600">
          <span>#</span>
          <span>Bestellung</span>
          <span className="text-right">Warte seit</span>
          <span className="text-right">Score</span>
        </div>

        {sorted.map((order, idx) => {
          const tier = getTier(order.dispatch_score);
          const meta = TIER_META[tier];
          const isTop = idx === 0;

          return (
            <div
              key={order.id}
              className={cn(
                'grid grid-cols-[1.5rem_1fr_auto_auto] gap-2 items-start px-4 py-2.5 transition',
                isTop ? cn(meta.bgClass, 'border-l-2', meta.borderClass.replace('border-', 'border-l-')) : 'hover:bg-matcha-50/60',
              )}
            >
              {/* Rank */}
              <span className={cn(
                'text-[10px] font-black tabular-nums mt-0.5',
                isTop ? meta.textClass : 'text-muted-foreground',
              )}>
                {idx + 1}
              </span>

              {/* Order info */}
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-matcha-900 truncate">
                    {order.bestellnummer}
                  </span>
                  <ZoneBadge zone={order.delivery_zone} />
                  <TierBadge score={order.dispatch_score} />
                </div>
                {/* Score bar */}
                <ScoreBar score={order.dispatch_score} />
              </div>

              {/* Wait time */}
              <span
                className={cn(
                  'shrink-0 text-[11px] tabular-nums mt-0.5',
                  waitUrgencyClass(order.fertig_am, now),
                )}
                title={order.fertig_am ? `Fertig seit: ${new Date(order.fertig_am).toLocaleTimeString('de-DE')}` : undefined}
              >
                {formatWait(order.fertig_am, now)}
              </span>

              {/* Score number */}
              <span
                className={cn(
                  'shrink-0 text-base font-black tabular-nums leading-none mt-0.5',
                  scoreTextClass(order.dispatch_score),
                )}
              >
                {Math.round(order.dispatch_score)}
              </span>
            </div>
          );
        })}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Score-Verteilung                                                     */}
      {/* ------------------------------------------------------------------ */}
      <div className="px-4 py-3 border-t border-matcha-200 bg-white/60 space-y-2">
        <div className="flex items-center gap-1.5 mb-1">
          <Star className="h-3 w-3 text-matcha-600" />
          <span className="text-[10px] font-black uppercase tracking-wider text-matcha-700">
            Score-Verteilung
          </span>
        </div>

        <VerteilungBar
          label="Optimal (≥ 80)"
          count={tierCounts.optimal}
          total={scored.length}
          tier="optimal"
        />
        <VerteilungBar
          label="Gut (60–79)"
          count={tierCounts.gut}
          total={scored.length}
          tier="gut"
        />
        <VerteilungBar
          label="Niedrig (< 60)"
          count={tierCounts.niedrig}
          total={scored.length}
          tier="niedrig"
        />
      </div>
    </Card>
  );
}

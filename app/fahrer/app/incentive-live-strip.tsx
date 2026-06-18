'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, Target, TrendingUp } from 'lucide-react';

type IncentiveType =
  | 'surge_multiplier'
  | 'quality_bonus'
  | 'shift_milestone'
  | 'rush_hour_flat'
  | 'comeback_bonus';

type RecentEvent = {
  id: string;
  incentiveType: IncentiveType;
  triggerLabel: string;
  bonusEur: number;
  status: 'pending' | 'approved' | 'paid' | 'cancelled';
  earnedAt: string;
};

type Summary = {
  totalEurToday: number;
  pendingEur: number;
  confirmedEur: number;
  eventsToday: number;
  nextMilestoneAt: number | null;
  deliveriesToNextMilestone: number | null;
  recentEvents: RecentEvent[];
};

const TYPE_META: Record<IncentiveType, { label: string; icon: string }> = {
  surge_multiplier: { label: 'Surge-Bonus',      icon: '⚡' },
  quality_bonus:    { label: 'Qualitäts-Bonus',   icon: '⭐' },
  shift_milestone:  { label: 'Meilenstein',        icon: '🏆' },
  rush_hour_flat:   { label: 'Stoßzeit-Bonus',     icon: '🔥' },
  comeback_bonus:   { label: 'Comeback-Bonus',     icon: '🎯' },
};

export function FahrerIncentiveLiveStrip({ className }: { className?: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch('/api/delivery/driver/incentives');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.ok) setSummary(data.summary);
      } catch {
        // network error — silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const iv = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  if (loading || !summary) return null;
  if (summary.eventsToday === 0 && summary.deliveriesToNextMilestone === null) return null;

  return (
    <section className={cn(
      'bg-gradient-to-br from-emerald-900/70 to-emerald-800/70 border border-emerald-700/50 rounded-2xl p-4 space-y-3',
      className,
    )}>
      {/* Gesamt */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">💰</span>
          <span className="text-sm font-semibold text-emerald-200">Boni heute</span>
        </div>
        <div className="text-xl font-bold text-white">
          {summary.totalEurToday.toFixed(2)} €
        </div>
      </div>

      {/* Aufschlüsselung pending vs. confirmed */}
      {(summary.pendingEur > 0 || summary.confirmedEur > 0) && (
        <div className="flex gap-4 text-xs">
          <div className="flex items-center gap-1.5 text-yellow-300">
            <Clock className="h-3 w-3" />
            <span>Ausstehend: {summary.pendingEur.toFixed(2)} €</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-300">
            <TrendingUp className="h-3 w-3" />
            <span>Bestätigt: {summary.confirmedEur.toFixed(2)} €</span>
          </div>
        </div>
      )}

      {/* Meilenstein-Fortschritt */}
      {summary.deliveriesToNextMilestone !== null && summary.nextMilestoneAt !== null && (
        <div className="bg-emerald-700/40 rounded-xl px-3 py-2 flex items-center gap-2">
          <Target className="h-4 w-4 text-emerald-300 shrink-0" />
          <span className="text-xs text-emerald-200">
            Noch{' '}
            <span className="font-bold text-white">{summary.deliveriesToNextMilestone}</span>{' '}
            Lieferungen bis Meilenstein-Bonus 🏆
          </span>
        </div>
      )}

      {/* Letzte Boni */}
      {summary.recentEvents.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-emerald-400 uppercase tracking-wide">Letzte Boni</div>
          {summary.recentEvents.slice(0, 3).map((ev) => {
            const meta = TYPE_META[ev.incentiveType] ?? { label: ev.incentiveType, icon: '💡' };
            const confirmed = ev.status === 'approved' || ev.status === 'paid';
            return (
              <div key={ev.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span>{meta.icon}</span>
                  <span className="font-medium text-emerald-200">{meta.label}</span>
                  {ev.triggerLabel && (
                    <>
                      <span className="text-emerald-600">·</span>
                      <span className="text-emerald-400 truncate max-w-[100px]">{ev.triggerLabel}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-semibold text-white">+{ev.bonusEur.toFixed(2)} €</span>
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full',
                    confirmed
                      ? 'bg-emerald-700/50 text-emerald-300'
                      : 'bg-yellow-700/50 text-yellow-300',
                  )}>
                    {confirmed ? '✓' : '⏳'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

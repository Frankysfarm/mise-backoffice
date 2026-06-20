'use client';

/**
 * TourRewardProgress — Live-Fortschrittsanzeige für Fahrer-Prämien.
 * Zeigt wie nah der Fahrer am nächsten Bonus-Meilenstein ist (z.B. 8/10 Lieferungen).
 * Motiviert Fahrer durch sichtbare Fortschritte.
 */

import { useEffect, useState } from 'react';
import { Trophy, Star, Zap, ChevronDown, ChevronUp, Gift, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RewardMilestone {
  id: string;
  label: string;
  target: number;
  current: number;
  rewardEur: number;
  type: 'deliveries' | 'rating' | 'streak' | 'revenue';
  achieved: boolean;
}

interface Props {
  driverId: string | null;
  sessionDeliveries?: number;
  sessionRating?: number | null;
  streakDays?: number;
  sessionRevenueEur?: number;
}

function MilestoneBar({ milestone }: { milestone: RewardMilestone }) {
  const pct = Math.min(100, milestone.target > 0 ? (milestone.current / milestone.target) * 100 : 0);
  const remaining = Math.max(0, milestone.target - milestone.current);

  return (
    <div className={cn(
      'rounded-xl border p-3',
      milestone.achieved ? 'bg-matcha-50 border-matcha-300' : 'bg-card border-border'
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {milestone.achieved
            ? <Star className="h-3.5 w-3.5 text-matcha-600 fill-matcha-400" />
            : <Trophy className="h-3.5 w-3.5 text-muted-foreground" />
          }
          <span className="text-[11px] font-bold text-foreground">{milestone.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Gift className="h-3 w-3 text-amber-600" />
          <span className="text-[11px] font-black text-amber-700">{milestone.rewardEur.toFixed(0)} €</span>
        </div>
      </div>

      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700',
            milestone.achieved ? 'bg-matcha-500' : pct >= 80 ? 'bg-amber-500' : 'bg-blue-500'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {milestone.current} / {milestone.target}
        </span>
        {milestone.achieved
          ? <span className="text-[10px] font-bold text-matcha-700">✓ Erreicht!</span>
          : <span className="text-[10px] text-muted-foreground">noch {remaining} {milestone.type === 'revenue' ? '€' : ''}</span>
        }
      </div>
    </div>
  );
}

export function TourRewardProgress({
  driverId,
  sessionDeliveries = 0,
  sessionRating = null,
  streakDays = 0,
  sessionRevenueEur = 0,
}: Props) {
  const [open, setOpen] = useState(true);

  const milestones: RewardMilestone[] = [
    {
      id: 'del10',
      label: '10 Lieferungen heute',
      target: 10,
      current: sessionDeliveries,
      rewardEur: 5,
      type: 'deliveries',
      achieved: sessionDeliveries >= 10,
    },
    {
      id: 'del15',
      label: '15 Lieferungen heute',
      target: 15,
      current: sessionDeliveries,
      rewardEur: 12,
      type: 'deliveries',
      achieved: sessionDeliveries >= 15,
    },
    {
      id: 'streak3',
      label: '3 Tage ununterbrochen',
      target: 3,
      current: streakDays,
      rewardEur: 8,
      type: 'streak',
      achieved: streakDays >= 3,
    },
    {
      id: 'rev100',
      label: '100 € Umsatz heute',
      target: 100,
      current: Math.round(sessionRevenueEur),
      rewardEur: 6,
      type: 'revenue',
      achieved: sessionRevenueEur >= 100,
    },
  ].filter((m) => !m.achieved || m.id === milestones?.find((x) => x.achieved)?.id);

  const achievedCount = milestones.filter((m) => m.achieved).length;
  const nextMilestone = milestones.find((m) => !m.achieved);
  const totalRewardEarned = milestones.filter((m) => m.achieved).reduce((s, m) => s + m.rewardEur, 0);

  if (!driverId && sessionDeliveries === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-muted/40 transition"
      >
        <Trophy className="h-4 w-4 text-amber-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Prämien-Fortschritt</span>
        {achievedCount > 0 && (
          <span className="ml-1 rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
            {achievedCount} erreicht
          </span>
        )}
        {totalRewardEarned > 0 && (
          <span className="ml-auto mr-2 text-[11px] font-black text-amber-700">
            +{totalRewardEarned.toFixed(0)} €
          </span>
        )}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="border-t px-4 py-3 space-y-2.5">
          {/* Next milestone highlight */}
          {nextMilestone && (
            <div className="rounded-xl bg-blue-50 border border-blue-200 px-3 py-2.5 flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold text-blue-800">Nächste Prämie</div>
                <div className="text-[10px] text-blue-600">
                  {nextMilestone.label} · +{nextMilestone.rewardEur} €
                </div>
              </div>
              <div className="text-sm font-black text-blue-700">
                {Math.max(0, nextMilestone.target - nextMilestone.current)} noch
              </div>
            </div>
          )}

          {/* All milestones */}
          {milestones.slice(0, 3).map((m) => (
            <MilestoneBar key={m.id} milestone={m} />
          ))}

          {/* Revenue earned today */}
          {totalRewardEarned > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-matcha-50 border border-matcha-200 px-3 py-2">
              <TrendingUp className="h-3.5 w-3.5 text-matcha-600" />
              <span className="text-[11px] font-bold text-matcha-700">
                {totalRewardEarned.toFixed(0)} € Prämien heute verdient
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

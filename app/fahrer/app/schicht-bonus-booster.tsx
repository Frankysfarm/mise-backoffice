'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Gift, Zap } from 'lucide-react';

type Summary = {
  totalEurToday: number;
  pendingEur: number;
  confirmedEur: number;
  eventsToday: number;
  nextMilestoneAt: number | null;
  deliveriesToNextMilestone: number | null;
  recentEvents: {
    id: string;
    incentiveType: string;
    triggerLabel: string;
    bonusEur: number;
    status: string;
    earnedAt: string;
  }[];
};

function AnimatedArc({ pct }: { pct: number }) {
  const size = 72;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, pct)) / 100) * circ;
  const isClose = pct >= 80;
  const color = pct >= 100 ? '#22c55e' : isClose ? '#f59e0b' : '#818cf8';

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s ease, stroke 0.5s ease' }}
      />
    </svg>
  );
}

export function SchichtBonusBooster({ className }: { className?: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [burst, setBurst] = useState(false);
  const prevMilestone = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch('/api/delivery/driver/incentives');
        if (!res.ok || cancelled) return;
        const data = await res.json() as { ok: boolean; summary?: Summary };
        if (data.ok && data.summary) {
          const s = data.summary;
          if (
            prevMilestone.current !== null &&
            s.nextMilestoneAt !== null &&
            prevMilestone.current !== s.nextMilestoneAt
          ) {
            setBurst(true);
            setTimeout(() => setBurst(false), 2000);
          }
          prevMilestone.current = s.nextMilestoneAt;
          if (!cancelled) setSummary(s);
        }
      } catch { /* silent */ }
    };

    load();
    const iv = setInterval(load, 45_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  if (!summary) return null;
  if (summary.nextMilestoneAt === null && summary.eventsToday === 0) return null;

  const remaining = summary.deliveriesToNextMilestone ?? 0;
  const milestone = summary.nextMilestoneAt ?? 0;
  const done = milestone - remaining;
  const pct = milestone > 0 ? Math.round((done / milestone) * 100) : 100;
  const isAchieved = remaining === 0 && milestone > 0;
  const isClose = !isAchieved && pct >= 80;

  return (
    <div className={cn(
      'relative rounded-2xl border p-4 overflow-hidden transition-all duration-500',
      isAchieved
        ? 'border-emerald-500/50 bg-gradient-to-br from-emerald-900/60 to-emerald-800/60'
        : isClose
          ? 'border-amber-500/40 bg-gradient-to-br from-amber-900/40 to-orange-900/40'
          : 'border-indigo-500/30 bg-gradient-to-br from-indigo-900/40 to-purple-900/40',
      burst && 'scale-[1.02]',
      className,
    )}>
      {/* Burst overlay */}
      {burst && (
        <div className="absolute inset-0 rounded-2xl bg-emerald-400/20 animate-ping pointer-events-none" />
      )}

      <div className="flex items-center gap-4">
        {/* Arc */}
        <div className="relative shrink-0 flex items-center justify-center">
          <AnimatedArc pct={pct} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[11px] font-black tabular-nums text-white leading-none">
              {isAchieved ? '✓' : `${pct}%`}
            </span>
          </div>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <Gift className={cn('h-3.5 w-3.5 shrink-0', isAchieved ? 'text-emerald-400' : isClose ? 'text-amber-400' : 'text-indigo-400')} />
            <span className={cn('text-xs font-bold', isAchieved ? 'text-emerald-200' : 'text-white')}>
              {isAchieved
                ? `Meilenstein ${milestone} erreicht! 🎉`
                : `Noch ${remaining} Stop${remaining !== 1 ? 's' : ''} bis Bonus`}
            </span>
          </div>

          <div className="text-[10px] text-gray-400">
            {done} / {milestone} Lieferungen
            {summary.totalEurToday > 0 && (
              <span className="ml-2 text-emerald-400 font-bold">
                +{summary.totalEurToday.toFixed(2)} € heute
              </span>
            )}
          </div>

          {/* Mini progress bar */}
          <div className="h-1 rounded-full bg-white/10 overflow-hidden mt-1.5">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-1000',
                isAchieved ? 'bg-emerald-400' : isClose ? 'bg-amber-400' : 'bg-indigo-400',
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Zap icon for surge */}
        {isClose && !isAchieved && (
          <div className="shrink-0 w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center animate-pulse">
            <Zap className="h-4 w-4 text-amber-400" />
          </div>
        )}
        {isAchieved && (
          <div className="shrink-0 text-2xl select-none">🏆</div>
        )}
      </div>

      {/* Recent event strip */}
      {summary.recentEvents.length > 0 && (
        <div className="mt-3 border-t border-white/8 pt-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {summary.recentEvents.slice(0, 3).map((ev) => (
            <div
              key={ev.id}
              className="shrink-0 flex items-center gap-1 rounded-full bg-white/8 px-2.5 py-1 text-[9px] font-bold text-white"
            >
              <span>{ev.incentiveType === 'surge_multiplier' ? '⚡' : ev.incentiveType === 'quality_bonus' ? '⭐' : '🎯'}</span>
              +{ev.bonusEur.toFixed(2)} €
            </div>
          ))}
          {summary.pendingEur > 0 && (
            <div className="shrink-0 text-[9px] text-amber-400 font-bold ml-auto whitespace-nowrap">
              {summary.pendingEur.toFixed(2)} € ausstehend
            </div>
          )}
        </div>
      )}
    </div>
  );
}

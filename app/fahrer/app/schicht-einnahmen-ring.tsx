'use client';

import { cn } from '@/lib/utils';
import { Euro, Star, TrendingUp } from 'lucide-react';

type Props = {
  deliveries: number;
  estEarnings: number;
  goalEur?: number;
};

const MILESTONES = [20, 40, 60, 80];

function EarningsArc({ pct, color }: { pct: number; color: string }) {
  const R = 38;
  const C = 2 * Math.PI * R;
  const dash = Math.min(pct / 100, 1) * C;
  return (
    <svg width="110" height="110" viewBox="0 0 110 110" className="shrink-0">
      <circle cx="55" cy="55" r={R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="10" />
      <circle
        cx="55" cy="55" r={R}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${C}`}
        strokeDashoffset={C / 4}
        transform="rotate(-90 55 55)"
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
    </svg>
  );
}

export function SchichtEinnahmenRing({ deliveries, estEarnings, goalEur = 80 }: Props) {
  if (deliveries === 0 && estEarnings === 0) return null;

  const pct = Math.min((estEarnings / goalEur) * 100, 100);
  const color =
    pct >= 100 ? '#4ade80' :
    pct >= 75  ? '#fbbf24' :
    pct >= 50  ? '#60a5fa' :
    '#a3e635';

  const nextMilestone = MILESTONES.find(m => m > estEarnings) ?? goalEur;
  const toNext = Math.max(0, nextMilestone - estEarnings);
  const goalReached = pct >= 100;

  return (
    <div className="mx-4 rounded-2xl bg-matcha-900/50 border border-white/10 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Euro className="h-3.5 w-3.5 text-accent" />
        <span className="font-display text-[11px] font-bold uppercase tracking-wider text-matcha-200">
          Schicht-Einnahmen
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <EarningsArc pct={pct} color={color} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-base font-black tabular-nums leading-tight" style={{ color }}>
              {estEarnings.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
            </span>
            <span className="text-[9px] font-bold text-matcha-300">von {goalEur} €</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          {/* Milestone dots */}
          <div className="flex items-center gap-2 mb-2.5">
            {MILESTONES.map(m => (
              <div key={m} className="flex flex-col items-center gap-0.5">
                <div className={cn(
                  'h-3.5 w-3.5 rounded-full border-2 transition-all duration-500',
                  estEarnings >= m
                    ? 'bg-accent border-accent shadow-[0_0_8px_rgba(74,230,138,0.6)]'
                    : 'bg-transparent border-white/20',
                )} />
                <span className="text-[8px] text-matcha-400 tabular-nums">{m}€</span>
              </div>
            ))}
            <div className="flex-1" />
            <Star className={cn(
              'h-4 w-4 transition-colors',
              goalReached ? 'text-yellow-400' : 'text-white/15',
            )} />
          </div>
          {goalReached ? (
            <div className="text-[11px] font-black text-accent">Tagesziel erreicht! 🎉</div>
          ) : (
            <div className="text-[11px] text-matcha-200">
              Noch <span className="font-bold">{toNext.toFixed(0)} €</span> bis {nextMilestone} €
            </div>
          )}
          <div className="flex items-center gap-1.5 mt-1">
            <TrendingUp className="h-3 w-3 text-accent" />
            <span className="text-[10px] text-matcha-300">
              {deliveries} Lieferung{deliveries !== 1 ? 'en' : ''} heute
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

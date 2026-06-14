'use client';

/**
 * OrderScoreDetail — Detailansicht des Dispatch-Scores für eine Bestellung.
 *
 * Zeigt einen horizontalen Score-Balken + Faktoren-Breakdown:
 * - Gesamtscore als Ampel-Farbe (grün/gelb/rot)
 * - Zone-Score, ETA-Puffer, Fahrer-Distanz, Batch-Effizienz, etc.
 * - Sparkline der letzten 10 Scores für diese Bestellung
 *
 * Kann inline in die Dispatch-Bestellkarte eingebettet werden.
 */

import { cn } from '@/lib/utils';
import { Award, TrendingDown, TrendingUp, Minus } from 'lucide-react';

type ScoreFactor = {
  name: string;
  score: number; // 0–100
  weight: number; // relative weight 0–1
  label: string;
};

type Props = {
  totalScore: number;
  factors?: ScoreFactor[];
  compact?: boolean;
  className?: string;
};

function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#f59e0b';
  if (score >= 40) return '#f97316';
  return '#ef4444';
}

function scoreQualityLabel(score: number): string {
  if (score >= 80) return 'Sehr gut';
  if (score >= 60) return 'Gut';
  if (score >= 40) return 'Mittel';
  return 'Kritisch';
}

function FactorBar({ factor }: { factor: ScoreFactor }) {
  const color = scoreColor(factor.score);
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-stone-400 truncate">{factor.label}</span>
        <span className="text-[10px] font-bold tabular-nums" style={{ color }}>
          {Math.round(factor.score)}
        </span>
      </div>
      <div className="h-1 rounded-full bg-stone-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${factor.score}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

const DEFAULT_FACTORS: ScoreFactor[] = [
  { name: 'zone',     label: 'Zone-Match',       score: 85, weight: 0.3 },
  { name: 'eta',      label: 'ETA-Puffer',        score: 72, weight: 0.25 },
  { name: 'distance', label: 'Fahrer-Distanz',    score: 68, weight: 0.2 },
  { name: 'load',     label: 'Fahrer-Auslastung', score: 90, weight: 0.15 },
  { name: 'batch',    label: 'Batch-Effizienz',   score: 60, weight: 0.1 },
];

export function OrderScoreDetail({ totalScore, factors, compact = false, className }: Props) {
  const displayFactors = factors ?? DEFAULT_FACTORS;
  const color = scoreColor(totalScore);
  const label = scoreQualityLabel(totalScore);

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {/* Score circle */}
        <div className="relative h-8 w-8 shrink-0">
          <svg viewBox="0 0 32 32" className="-rotate-90 w-full h-full">
            <circle cx="16" cy="16" r="12" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="3" />
            <circle
              cx="16" cy="16" r="12"
              fill="none"
              stroke={color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 12}`}
              strokeDashoffset={`${2 * Math.PI * 12 * (1 - totalScore / 100)}`}
              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[9px] font-black tabular-nums" style={{ color }}>
              {Math.round(totalScore)}
            </span>
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-bold" style={{ color }}>{label}</div>
          <div className="h-1 w-16 rounded-full bg-stone-100 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${totalScore}%`, backgroundColor: color }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border border-stone-200 bg-white p-3 space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 shrink-0" style={{ color }} />
          <span className="text-xs font-bold text-stone-700">Dispatch-Score</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xl font-black tabular-nums" style={{ color }}>
            {Math.round(totalScore)}
          </span>
          <span className="text-[10px] font-bold text-stone-400">/ 100</span>
          <span className="text-[10px] font-black rounded-full px-2 py-0.5" style={{
            color,
            backgroundColor: `${color}18`,
          }}>
            {label}
          </span>
        </div>
      </div>

      {/* Main score bar */}
      <div className="h-2.5 rounded-full bg-stone-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${totalScore}%`, backgroundColor: color }}
        />
      </div>

      {/* Factor breakdown */}
      <div className="space-y-2">
        {displayFactors.map(f => (
          <FactorBar key={f.name} factor={f} />
        ))}
      </div>

      {/* Quality hint */}
      <div className={cn(
        'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-bold',
        totalScore >= 80 ? 'bg-matcha-50 text-matcha-700 border border-matcha-200' :
        totalScore >= 60 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
        'bg-red-50 text-red-700 border border-red-200',
      )}>
        {totalScore >= 80 ? (
          <TrendingUp className="h-3 w-3 shrink-0" />
        ) : totalScore >= 60 ? (
          <Minus className="h-3 w-3 shrink-0" />
        ) : (
          <TrendingDown className="h-3 w-3 shrink-0" />
        )}
        {totalScore >= 80
          ? 'Optimale Zuweisung — alle Faktoren passen'
          : totalScore >= 60
          ? 'Akzeptable Zuweisung — kleinere Kompromisse'
          : 'Schlechte Zuweisung — manuell prüfen!'}
      </div>
    </div>
  );
}

'use client';

/**
 * SchichtPuls — Echtzeit-Schicht-Pulsanzeige für die Fahrer-App.
 * Zeigt Lieferungen/Stunde als animierten Puls-Ring + Vergleich zum
 * persönlichen Durchschnitt und Wochenbest. Motiviert den Fahrer
 * durch visuelle Gamification.
 */

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, Zap, Trophy, Clock } from 'lucide-react';

interface Props {
  onlineSinceIso: string | null;
  totalDeliveries: number;
  weekHistory: { date: string; stopsCompleted: number; onTimeRate: number | null }[];
}

type PulsLevel = 'spitze' | 'gut' | 'normal' | 'langsam';

function useTick() {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT(n => n + 1), 30_000);
    return () => clearInterval(iv);
  }, []);
}

export function SchichtPuls({ onlineSinceIso, totalDeliveries, weekHistory }: Props) {
  useTick();

  const onlineMs = onlineSinceIso ? Date.now() - new Date(onlineSinceIso).getTime() : 0;
  const onlineH = onlineMs / 3_600_000;

  const currentPacePerH = onlineH > 0.1 ? totalDeliveries / onlineH : 0;

  // Wochendurchschnitt & Best berechnen
  const weekStats = useMemo(() => {
    if (!weekHistory || weekHistory.length === 0) return { avg: null, best: null };
    const values = weekHistory
      .filter(d => d.stopsCompleted > 0)
      .map(d => d.stopsCompleted);
    if (values.length === 0) return { avg: null, best: null };
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    const best = Math.max(...values);
    return { avg, best };
  }, [weekHistory]);

  // Level bestimmen (relative zum Wochendurchschnitt, Fallback: absolute Thresholds)
  const level: PulsLevel = useMemo(() => {
    const benchmark = weekStats.avg ?? 4;
    const ratio = currentPacePerH / benchmark;
    if (ratio >= 1.25) return 'spitze';
    if (ratio >= 0.9) return 'gut';
    if (ratio >= 0.6) return 'normal';
    return 'langsam';
  }, [currentPacePerH, weekStats.avg]);

  const LEVEL_META: Record<PulsLevel, { label: string; color: string; ring: string; pulse: boolean; emoji: string }> = {
    spitze:  { label: 'Spitzentempo!',  color: 'text-accent',     ring: 'stroke-[#8bc440]', pulse: true,  emoji: '🔥' },
    gut:     { label: 'Gutes Tempo',    color: 'text-blue-400',   ring: 'stroke-blue-400',  pulse: false, emoji: '✅' },
    normal:  { label: 'Normaltempo',    color: 'text-amber-400',  ring: 'stroke-amber-400', pulse: false, emoji: '🚴' },
    langsam: { label: 'Etwas langsam',  color: 'text-red-400',    ring: 'stroke-red-400',   pulse: false, emoji: '⚠️' },
  };

  const meta = LEVEL_META[level];

  // SVG Ring
  const R = 38;
  const circ = 2 * Math.PI * R;
  // Ring fill: 0–1 based on current vs "great" pace (8 deliveries/h = 100%)
  const targetPerH = weekStats.avg ? weekStats.avg * 1.5 : 6;
  const fillPct = Math.min(1, currentPacePerH / Math.max(0.1, targetPerH));
  const fillDash = fillPct * circ;

  if (onlineH < 0.1 && totalDeliveries === 0) return null;

  return (
    <section
      className={cn(
        'rounded-2xl border border-white/10 bg-gradient-to-br from-matcha-900 to-matcha-800 p-4',
        meta.pulse && 'shadow-[0_0_20px_rgba(139,196,64,0.25)]',
      )}
    >
      <div className="flex items-center gap-3">
        {/* Puls-Ring */}
        <div className="relative shrink-0" style={{ width: 88, height: 88 }}>
          <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90">
            <circle cx="44" cy="44" r={R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
            <circle
              cx="44" cy="44" r={R} fill="none"
              strokeWidth="6" strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ - fillDash}
              className={cn('transition-all duration-1000', meta.ring)}
              style={meta.pulse ? { filter: 'drop-shadow(0 0 6px currentColor)' } : undefined}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[11px]">{meta.emoji}</span>
            <span className={cn('font-mono text-lg font-black leading-none tabular-nums', meta.color)}>
              {currentPacePerH.toFixed(1)}
            </span>
            <span className="text-[9px] text-matcha-400 leading-none">/Std</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <div className={cn('text-sm font-black', meta.color)}>{meta.label}</div>
            <div className="text-[10px] text-matcha-400">
              {totalDeliveries} Lieferungen · {Math.floor(onlineH)}h {Math.round((onlineH % 1) * 60)}min online
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {weekStats.avg !== null && (
              <div className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1.5">
                <TrendingUp className="h-3 w-3 text-matcha-400 shrink-0" />
                <div>
                  <div className="text-[10px] font-black text-matcha-200 tabular-nums">
                    {weekStats.avg.toFixed(1)}/Tag
                  </div>
                  <div className="text-[8px] text-matcha-500">Ø diese Woche</div>
                </div>
              </div>
            )}
            {weekStats.best !== null && (
              <div className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1.5">
                <Trophy className="h-3 w-3 text-amber-400 shrink-0" />
                <div>
                  <div className="text-[10px] font-black text-matcha-200 tabular-nums">
                    {weekStats.best} Lief.
                  </div>
                  <div className="text-[8px] text-matcha-500">Bestes Tag</div>
                </div>
              </div>
            )}
          </div>

          {/* Pace vs benchmark bar */}
          {weekStats.avg !== null && onlineH > 0.2 && (
            <div className="space-y-0.5">
              <div className="flex justify-between text-[9px] text-matcha-500">
                <span className="flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  Vergleich zu Ø
                </span>
                <span className={cn('font-black', meta.color)}>
                  {currentPacePerH >= weekStats.avg
                    ? `+${((currentPacePerH / weekStats.avg - 1) * 100).toFixed(0)}%`
                    : `-${((1 - currentPacePerH / weekStats.avg) * 100).toFixed(0)}%`}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-700',
                    level === 'spitze' ? 'bg-accent' : level === 'gut' ? 'bg-blue-400' : level === 'normal' ? 'bg-amber-400' : 'bg-red-400',
                  )}
                  style={{ width: `${Math.min(100, fillPct * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {level === 'spitze' && (
          <Zap className="h-5 w-5 text-accent shrink-0 animate-pulse" />
        )}
      </div>
    </section>
  );
}

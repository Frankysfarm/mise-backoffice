'use client';

// Phase 1312 — Tages-Ziel-Fortschritt (Fahrer-App)
// Balken: Tages-Stopp-Ziel (z.B. 12 Stopps) + aktuell erreichte + Motivations-Badge bei 100%
// isOnline-Guard · nach Phase1307

import { useMemo } from 'react';
import { Award, Target, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  isOnline: boolean;
  stoppsAbgeschlossen: number;
  tagesziel?: number;
}

const DEFAULT_ZIEL = 12;

const MEILENSTEINE = [
  { pct: 25,  label: '¼ geschafft!',   icon: '🟡' },
  { pct: 50,  label: 'Halbzeit!',       icon: '🔵' },
  { pct: 75,  label: 'Fast da!',        icon: '🟠' },
  { pct: 100, label: 'Ziel erreicht!',  icon: '🏆' },
];

export function FahrerPhase1312TagesZielFortschritt({ isOnline, stoppsAbgeschlossen, tagesziel = DEFAULT_ZIEL }: Props) {
  const pct = useMemo(() => Math.min(100, Math.round((stoppsAbgeschlossen / Math.max(1, tagesziel)) * 100)), [stoppsAbgeschlossen, tagesziel]);

  const aktiverMeilenstein = useMemo(
    () => [...MEILENSTEINE].reverse().find((m) => pct >= m.pct) ?? null,
    [pct]
  );

  const verbleibend = Math.max(0, tagesziel - stoppsAbgeschlossen);
  const zielErreicht = pct >= 100;

  if (!isOnline) return null;

  return (
    <div className={cn(
      'rounded-2xl border px-4 py-3 mb-4 transition-colors',
      zielErreicht
        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
        : 'bg-card border-border'
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Target className={cn('h-4 w-4', zielErreicht ? 'text-emerald-500' : 'text-muted-foreground')} />
          <span className="text-sm font-bold">Tages-Ziel</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn('text-lg font-black tabular-nums', zielErreicht ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground')}>
            {stoppsAbgeschlossen}
          </span>
          <span className="text-xs text-muted-foreground">/ {tagesziel}</span>
          <span className="text-xs text-muted-foreground ml-1">Stopps</span>
        </div>
      </div>

      {/* Fortschrittsbalken */}
      <div className="relative h-3 rounded-full bg-muted overflow-hidden mb-2">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700',
            zielErreicht
              ? 'bg-emerald-500'
              : pct >= 75
              ? 'bg-amber-400'
              : pct >= 50
              ? 'bg-blue-500'
              : 'bg-primary'
          )}
          style={{ width: `${pct}%` }}
        />
        {/* Meilenstein-Markierungen */}
        {[25, 50, 75].map((m) => (
          <div
            key={m}
            className="absolute top-0 h-full w-px bg-background/50"
            style={{ left: `${m}%` }}
          />
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {!zielErreicht && (
            <>
              <TrendingUp className="h-3 w-3 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">
                Noch {verbleibend} Stopp{verbleibend !== 1 ? 's' : ''} bis zum Ziel
              </span>
            </>
          )}
          {zielErreicht && (
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              Ziel erreicht — super gemacht!
            </span>
          )}
        </div>
        <span className={cn(
          'text-xs font-bold tabular-nums',
          zielErreicht ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
        )}>
          {pct}%
        </span>
      </div>

      {/* Motivations-Badge */}
      {aktiverMeilenstein && (
        <div className={cn(
          'mt-2 flex items-center gap-2 rounded-xl px-3 py-1.5',
          zielErreicht
            ? 'bg-emerald-100 dark:bg-emerald-900/50'
            : 'bg-muted/70'
        )}>
          <Award className={cn('h-3.5 w-3.5 shrink-0', zielErreicht ? 'text-emerald-500' : 'text-amber-500')} />
          <span className="text-[11px] font-semibold">
            {aktiverMeilenstein.icon} {aktiverMeilenstein.label}
          </span>
        </div>
      )}
    </div>
  );
}

'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Radio, TrendingUp, AlertTriangle } from 'lucide-react';

/**
 * Phase 895 — Bestellungs-Wellen-Radar
 *
 * Erkennt Bestellungswellen (≥3 neue Bestellungen in 5 Min) und warnt die Küche.
 * Client-seitig via useMemo auf den übergebenen Orders.
 */

interface Order {
  id: string;
  bestellt_am: string | null;
  status: string;
}

interface Props {
  orders: Order[];
}

const WAVE_WINDOW_MS = 5 * 60_000;
const WAVE_THRESHOLD = 3;

interface WaveInfo {
  count: number;
  oldestAgo: number;
  newestAgo: number;
}

export function KitchenPhase895BestellungsWellenRadar({ orders }: Props) {
  const wave = useMemo<WaveInfo | null>(() => {
    const now = Date.now();
    const recent = orders.filter(o => {
      if (!o.bestellt_am) return false;
      return now - new Date(o.bestellt_am).getTime() <= WAVE_WINDOW_MS;
    });
    if (recent.length < WAVE_THRESHOLD) return null;

    const times = recent
      .map(o => new Date(o.bestellt_am!).getTime())
      .sort((a, b) => a - b);

    return {
      count: recent.length,
      oldestAgo: Math.round((now - times[0]) / 1_000),
      newestAgo: Math.round((now - times[times.length - 1]) / 1_000),
    };
  }, [orders]);

  if (!wave) return null;

  const isCritical = wave.count >= WAVE_THRESHOLD * 2;

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden',
      isCritical
        ? 'border-red-300 bg-red-50 dark:bg-red-950/30'
        : 'border-amber-300 bg-amber-50 dark:bg-amber-950/30',
    )}>
      <div className={cn(
        'flex items-center gap-2.5 px-4 py-2.5',
        isCritical ? 'border-b border-red-200 dark:border-red-800' : 'border-b border-amber-200 dark:border-amber-800',
      )}>
        <Radio className={cn(
          'h-4 w-4 shrink-0 animate-pulse',
          isCritical ? 'text-red-500' : 'text-amber-500',
        )} />
        <span className={cn(
          'text-xs font-bold uppercase tracking-wider',
          isCritical ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300',
        )}>
          Bestellungs-Welle erkannt!
        </span>
        <span className={cn(
          'ml-auto rounded-full px-2 py-0.5 text-[10px] font-black text-white',
          isCritical ? 'bg-red-500' : 'bg-amber-400',
        )}>
          {wave.count} Bestellungen
        </span>
      </div>

      <div className="flex items-start gap-3 px-4 py-3">
        <AlertTriangle className={cn(
          'h-5 w-5 shrink-0 mt-0.5',
          isCritical ? 'text-red-500' : 'text-amber-500',
        )} />
        <div className="flex-1 space-y-1">
          <p className={cn(
            'text-sm font-semibold',
            isCritical ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300',
          )}>
            {wave.count} neue Bestellungen in unter 5 Minuten!
          </p>
          <p className="text-[11px] text-muted-foreground">
            Älteste vor {wave.oldestAgo}s · Neueste vor {wave.newestAgo}s
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <TrendingUp className={cn(
            'h-4 w-4',
            isCritical ? 'text-red-500' : 'text-amber-500',
          )} />
          <span className={cn(
            'text-[10px] font-bold',
            isCritical ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400',
          )}>
            {isCritical ? 'KRITISCH' : 'WARNUNG'}
          </span>
        </div>
      </div>

      {/* Progress bar showing wave intensity */}
      <div className="px-4 pb-3">
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              isCritical ? 'bg-red-500' : 'bg-amber-400',
            )}
            style={{ width: `${Math.min(100, (wave.count / (WAVE_THRESHOLD * 3)) * 100)}%` }}
          />
        </div>
        <div className="mt-1 text-[9px] text-muted-foreground">
          Schwelle: ≥{WAVE_THRESHOLD} Bestellungen in 5 Min
        </div>
      </div>
    </div>
  );
}

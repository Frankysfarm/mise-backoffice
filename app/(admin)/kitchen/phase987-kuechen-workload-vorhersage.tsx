'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, Clock, Flame, BarChart3 } from 'lucide-react';

/**
 * Phase 987 — Küchen-Workload-Vorhersage (Kitchen)
 *
 * Prognose Bestellvolumen nächste 30 Min in 3 Slots à 10 Min,
 * basierend auf aktuellem Bestellrhythmus + Wochentag-Pattern.
 * Rein client-seitig, kein API-Call.
 */

interface Order {
  id: string;
  status: string;
  created_at?: string | null;
}

interface Props {
  orders: Order[];
}

const WEEKDAY_FACTOR: Record<number, number> = {
  0: 1.25, 1: 0.85, 2: 1.00, 3: 1.05, 4: 1.10, 5: 1.30, 6: 1.40,
};

const HOUR_PROFILE: Record<number, number> = {
  10: 3, 11: 6, 12: 12, 13: 15, 14: 9, 15: 5,
  16: 4, 17: 7, 18: 13, 19: 18, 20: 16, 21: 11, 22: 5, 23: 2,
};

function intensityLabel(n: number): { label: string; color: string; bg: string } {
  if (n >= 8) return { label: 'Peak', color: 'text-red-700 dark:text-red-300', bg: 'bg-red-100 dark:bg-red-900/30' };
  if (n >= 5) return { label: 'Hoch', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-100 dark:bg-amber-900/30' };
  if (n >= 2) return { label: 'Mittel', color: 'text-matcha-700 dark:text-matcha-300', bg: 'bg-matcha-100 dark:bg-matcha-900/30' };
  return { label: 'Niedrig', color: 'text-zinc-500', bg: 'bg-zinc-100 dark:bg-zinc-800/30' };
}

export function KitchenPhase987KuechenWorkloadVorhersage({ orders }: Props) {
  const slots = useMemo(() => {
    const now = Date.now();
    const nowDate = new Date(now);
    const weekdayFactor = WEEKDAY_FACTOR[nowDate.getDay()] ?? 1.0;

    // Count recent orders in last 10 min to calibrate
    const recentCount = orders.filter(o => {
      if (!o.created_at) return false;
      return now - new Date(o.created_at).getTime() < 10 * 60_000;
    }).length;

    return [0, 1, 2].map(i => {
      const slotStart = new Date(now + i * 10 * 60_000);
      const slotEnd = new Date(now + (i + 1) * 10 * 60_000);
      const hour = slotStart.getHours();
      const basePerHour = HOUR_PROFILE[hour] ?? 5;
      const basePer10Min = basePerHour / 6;

      // Blend historical pattern with observed recent rate
      const observedPer10Min = recentCount;
      const weight = i === 0 ? 0.6 : i === 1 ? 0.3 : 0.1;
      const prognose = Math.round(
        (basePer10Min * weekdayFactor * (1 - weight) + observedPer10Min * weight) * 10
      ) / 10;

      const startLabel = slotStart.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      const endLabel = slotEnd.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      const { label, color, bg } = intensityLabel(Math.round(prognose));

      return { startLabel, endLabel, prognose, label, color, bg, index: i };
    });
  }, [orders]);

  const maxPrognose = Math.max(...slots.map(s => s.prognose), 1);
  const gesamtPrognose = slots.reduce((acc, s) => acc + s.prognose, 0);
  const peakSlot = slots.reduce((max, s) => (s.prognose > max.prognose ? s : max), slots[0]);

  if (slots.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-matcha-600" />
          <span className="text-sm font-bold text-foreground">Workload-Vorhersage</span>
          <span className="text-[10px] text-muted-foreground">nächste 30 Min</span>
        </div>
        <div className="flex items-center gap-1.5">
          <BarChart3 className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs font-bold tabular-nums text-foreground">~{Math.round(gesamtPrognose)} Bestellungen</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {slots.map(slot => (
          <div key={slot.index} className={cn('rounded-lg p-3 space-y-1.5', slot.bg)}>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground font-medium">
                {slot.startLabel}–{slot.endLabel}
              </span>
            </div>
            <div className="flex items-end gap-1">
              <span className={cn('text-2xl font-black tabular-nums leading-none', slot.color)}>
                {Math.round(slot.prognose)}
              </span>
              <span className="text-[10px] text-muted-foreground mb-0.5">Best.</span>
            </div>
            <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-700',
                  slot.label === 'Peak' ? 'bg-red-500' :
                  slot.label === 'Hoch' ? 'bg-amber-400' :
                  slot.label === 'Mittel' ? 'bg-matcha-500' : 'bg-zinc-400'
                )}
                style={{ width: `${Math.round((slot.prognose / maxPrognose) * 100)}%` }}
              />
            </div>
            <span className={cn('text-[10px] font-bold', slot.color)}>{slot.label}</span>
          </div>
        ))}
      </div>

      {peakSlot.label !== 'Niedrig' && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-3 py-2">
          <Flame className="h-3.5 w-3.5 text-amber-600 shrink-0" />
          <span className="text-xs text-amber-700 dark:text-amber-300">
            Peak erwartet um {peakSlot.startLabel} — jetzt Vorbereitungen starten.
          </span>
        </div>
      )}
    </div>
  );
}

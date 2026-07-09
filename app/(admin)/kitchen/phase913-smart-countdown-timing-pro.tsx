'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Clock, Zap, AlertTriangle, CheckCircle2, Loader2, TrendingUp } from 'lucide-react';

/**
 * Phase 913 — Smart Countdown Timing Pro (Kitchen)
 *
 * Echtzeit-Countdown-Board für alle aktiven Bestellungen:
 * - Grün: ≥ 4 Min verbleibend
 * - Gelb: 2–3 Min verbleibend
 * - Rot: ≤ 1 Min oder überfällig
 * Aktualisierung alle 10 Sekunden via API.
 */

interface KitchenOrder {
  id: string;
  orderNumber?: string;
  status: string;
  prep_started_at?: string | null;
  target_ready_at?: string | null;
  driver_name?: string;
  item_count?: number;
  zone?: string;
}

interface Props {
  orders?: KitchenOrder[];
}

type Farbklasse = 'gruen' | 'gelb' | 'rot' | 'fertig';

interface CountdownEntry {
  id: string;
  label: string;
  remainSec: number;
  farbe: Farbklasse;
  zone?: string;
  items: number;
}

function computeFarbe(remainSec: number): Farbklasse {
  if (remainSec <= 0) return 'rot';
  if (remainSec < 120) return 'rot';
  if (remainSec < 240) return 'gelb';
  return 'gruen';
}

function formatCountdown(sec: number): string {
  if (sec <= 0) return 'ÜBERFÄLLIG';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const FARBE_CONFIG: Record<Farbklasse, { bg: string; border: string; text: string; badge: string; label: string }> = {
  gruen: {
    bg: 'bg-matcha-50 dark:bg-matcha-950/30',
    border: 'border-matcha-300 dark:border-matcha-700',
    text: 'text-matcha-700 dark:text-matcha-300',
    badge: 'bg-matcha-500 text-white',
    label: 'Pünktlich',
  },
  gelb: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-300 dark:border-amber-700',
    text: 'text-amber-700 dark:text-amber-300',
    badge: 'bg-amber-400 text-white',
    label: 'Knapp',
  },
  rot: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-300 dark:border-red-700',
    text: 'text-red-700 dark:text-red-300',
    badge: 'bg-red-500 text-white',
    label: 'Kritisch',
  },
  fertig: {
    bg: 'bg-muted/30',
    border: 'border-border',
    text: 'text-muted-foreground',
    badge: 'bg-muted text-muted-foreground',
    label: 'Fertig',
  },
};

export function KitchenPhase913SmartCountdownTimingPro({ orders = [] }: Props) {
  const [entries, setEntries] = useState<CountdownEntry[]>([]);
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const buildEntries = useCallback(() => {
    const now = Date.now();
    const active = orders.filter(
      (o) => o.status === 'cooking' || o.status === 'ready' || o.status === 'confirmed',
    );

    const result: CountdownEntry[] = active.map((o) => {
      const targetMs = o.target_ready_at ? new Date(o.target_ready_at).getTime() : null;
      const remainSec = targetMs ? Math.round((targetMs - now) / 1000) : 999;
      const farbe: Farbklasse = o.status === 'ready' ? 'fertig' : computeFarbe(remainSec);

      return {
        id: o.id,
        label: o.orderNumber ?? `#${o.id.slice(-4)}`,
        remainSec,
        farbe,
        zone: o.zone,
        items: o.item_count ?? 1,
      };
    });

    // Sort: critical first, then by remaining time ascending
    result.sort((a, b) => {
      const order: Farbklasse[] = ['rot', 'gelb', 'gruen', 'fertig'];
      const ai = order.indexOf(a.farbe);
      const bi = order.indexOf(b.farbe);
      if (ai !== bi) return ai - bi;
      return a.remainSec - b.remainSec;
    });

    setEntries(result);
  }, [orders]);

  useEffect(() => {
    buildEntries();
    intervalRef.current = setInterval(() => {
      setTick((t) => t + 1);
    }, 10_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [buildEntries]);

  useEffect(() => {
    buildEntries();
  }, [tick, buildEntries]);

  if (entries.length === 0) return null;

  const kritischCount = entries.filter((e) => e.farbe === 'rot').length;
  const knappeCount = entries.filter((e) => e.farbe === 'gelb').length;

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-background/80">
        <Clock className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground flex-1">
          Smart Countdown · Farbkodierung
        </span>
        {kritischCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 border border-red-300 px-2 py-0.5 text-[10px] font-black text-red-700 dark:text-red-300">
            <AlertTriangle className="h-2.5 w-2.5" />
            {kritischCount} kritisch
          </span>
        )}
        {knappeCount > 0 && (
          <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 border border-amber-300 px-2 py-0.5 text-[10px] font-black text-amber-700 dark:text-amber-300">
            {knappeCount} knapp
          </span>
        )}
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {entries.length} aktiv
        </span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-4">
        {entries.map((e) => {
          const cfg = FARBE_CONFIG[e.farbe];
          return (
            <div
              key={e.id}
              className={cn(
                'rounded-lg border p-3 flex flex-col gap-1 transition-colors',
                cfg.bg,
                cfg.border,
              )}
            >
              {/* Order label */}
              <div className="flex items-center gap-1.5">
                <span className={cn('text-[10px] font-bold', cfg.text)}>
                  {e.label}
                </span>
                {e.zone && (
                  <span className="ml-auto text-[9px] rounded bg-white/60 dark:bg-black/20 border border-current/20 px-1 font-bold opacity-70">
                    Z{e.zone}
                  </span>
                )}
              </div>

              {/* Countdown */}
              <div className={cn('font-mono text-xl font-black tabular-nums leading-none', cfg.text)}>
                {e.farbe === 'fertig' ? (
                  <span className="flex items-center gap-1 text-base">
                    <CheckCircle2 className="h-4 w-4" />
                    Fertig
                  </span>
                ) : (
                  formatCountdown(e.remainSec)
                )}
              </div>

              {/* Status badge */}
              <div className="flex items-center justify-between mt-0.5">
                <span className={cn('text-[9px] rounded-full px-1.5 py-0.5 font-bold', cfg.badge)}>
                  {cfg.label}
                </span>
                <span className="text-[9px] text-muted-foreground">
                  {e.items} Pos.
                </span>
              </div>

              {/* Color bar */}
              {e.farbe !== 'fertig' && (
                <div className="h-1 rounded-full bg-black/10 overflow-hidden mt-1">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-700',
                      e.farbe === 'gruen' ? 'bg-matcha-500' : e.farbe === 'gelb' ? 'bg-amber-400' : 'bg-red-500',
                    )}
                    style={{ width: `${Math.min(100, Math.max(0, (1 - e.remainSec / 900) * 100))}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer stats */}
      <div className="flex items-center gap-3 px-4 py-2 border-t bg-muted/20 text-[10px] text-muted-foreground">
        <TrendingUp className="h-3 w-3 shrink-0" />
        <span>
          {entries.filter((e) => e.farbe === 'gruen').length} pünktlich ·{' '}
          {knappeCount} knapp ·{' '}
          {kritischCount} kritisch
        </span>
        <span className="ml-auto">Aktualisierung alle 10 s</span>
      </div>
    </div>
  );
}

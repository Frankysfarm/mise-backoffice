'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Clock, Flame, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';

// Phase 1492 — Farbkodierter ETA-Countdown-Strip (Kitchen)
// Zeigt alle aktiven Bestellungen als kompakte Streifen mit Farbkodierung:
// Grün (≥ 10 Min verbleibend), Gelb (5-10 Min), Orange (2-5 Min), Rot (< 2 Min / überfällig).
// Props-basiert, keine API. Nach Phase 1487.

interface Order {
  id: string;
  order_number?: string | null;
  status: string;
  promised_at?: string | null;
  prep_started_at?: string | null;
  created_at: string;
  prep_time_min?: number | null;
}

interface Props {
  orders: Order[];
  nowMs?: number;
}

type Dringlichkeit = 'ok' | 'bald' | 'dringend' | 'kritisch';

const DRINGLICHKEIT_CONFIG: Record<Dringlichkeit, {
  label: string;
  bar: string;
  badge: string;
  text: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = {
  ok: {
    label: '≥ 10 Min',
    bar: 'bg-emerald-500',
    badge: 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300',
    text: 'text-emerald-700 dark:text-emerald-300',
    Icon: CheckCircle2,
  },
  bald: {
    label: '5–10 Min',
    bar: 'bg-amber-400',
    badge: 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300',
    text: 'text-amber-700 dark:text-amber-300',
    Icon: Clock,
  },
  dringend: {
    label: '2–5 Min',
    bar: 'bg-orange-500',
    badge: 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300',
    text: 'text-orange-700 dark:text-orange-300',
    Icon: AlertTriangle,
  },
  kritisch: {
    label: '< 2 Min',
    bar: 'bg-rose-600',
    badge: 'bg-rose-100 dark:bg-rose-900/30 border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300',
    text: 'text-rose-700 dark:text-rose-300',
    Icon: Flame,
  },
};

function classifyDringlichkeit(remainingMin: number): Dringlichkeit {
  if (remainingMin >= 10) return 'ok';
  if (remainingMin >= 5) return 'bald';
  if (remainingMin >= 2) return 'dringend';
  return 'kritisch';
}

function formatCountdown(remainingMin: number): string {
  if (remainingMin <= 0) return 'Überfällig!';
  const m = Math.floor(remainingMin);
  const s = Math.round((remainingMin - m) * 60);
  return `${m}:${String(s).padStart(2, '0')} Min`;
}

export function KitchenPhase1492FarbkodierterEtaCountdownStrip({ orders, nowMs }: Props) {
  const now = nowMs ?? Date.now();

  const activeOrders = useMemo(() => {
    const active = orders.filter(
      (o) => !['delivered', 'cancelled', 'rejected'].includes(o.status),
    );

    return active
      .map((o) => {
        // Estimated ready time: prep_started_at + prep_time_min OR created_at + (prep_time_min ?? 20)
        let etaMs: number;
        if (o.prep_started_at && o.prep_time_min) {
          etaMs = new Date(o.prep_started_at).getTime() + o.prep_time_min * 60_000;
        } else if (o.promised_at) {
          etaMs = new Date(o.promised_at).getTime();
        } else {
          etaMs = new Date(o.created_at).getTime() + (o.prep_time_min ?? 20) * 60_000;
        }
        const remainingMin = (etaMs - now) / 60_000;
        const dringlichkeit = classifyDringlichkeit(remainingMin);
        return { ...o, remainingMin, dringlichkeit, etaMs };
      })
      .sort((a, b) => a.remainingMin - b.remainingMin);
  }, [orders, now]);

  const counts = useMemo<Record<Dringlichkeit, number>>(
    () =>
      activeOrders.reduce(
        (acc, o) => ({ ...acc, [o.dringlichkeit]: acc[o.dringlichkeit] + 1 }),
        { ok: 0, bald: 0, dringend: 0, kritisch: 0 },
      ),
    [activeOrders],
  );

  if (activeOrders.length === 0) return null;

  return (
    <Card className="overflow-hidden border border-slate-200 dark:border-slate-700">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
        <Clock className="h-4 w-4 shrink-0 text-slate-500" />
        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex-1">
          ETA-Countdown · Farbkodierung
        </span>
        {/* Summary chips */}
        <div className="flex items-center gap-1.5">
          {(['kritisch', 'dringend', 'bald', 'ok'] as Dringlichkeit[]).map((d) =>
            counts[d] > 0 ? (
              <span
                key={d}
                className={cn(
                  'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold border',
                  DRINGLICHKEIT_CONFIG[d].badge,
                )}
              >
                {counts[d]}
              </span>
            ) : null,
          )}
        </div>
      </div>

      {/* Order rows */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {activeOrders.map((o) => {
          const cfg = DRINGLICHKEIT_CONFIG[o.dringlichkeit];
          const Icon = cfg.Icon;
          const isPulsing = o.dringlichkeit === 'kritisch';
          // Progress bar: fraction of total prep time already elapsed (0-100%)
          const totalMin = o.prep_time_min ?? 20;
          const elapsedMin = totalMin - Math.max(0, o.remainingMin);
          const progressPct = Math.min(100, Math.max(0, (elapsedMin / totalMin) * 100));

          return (
            <div key={o.id} className="flex items-center gap-3 px-4 py-2.5">
              {/* Color indicator dot */}
              <span className={cn('relative flex h-2.5 w-2.5 shrink-0 rounded-full', cfg.bar)}>
                {isPulsing && (
                  <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', cfg.bar)} />
                )}
              </span>

              {/* Order number */}
              <span className="text-[11px] font-bold text-foreground w-12 shrink-0 tabular-nums">
                #{o.order_number ?? o.id.slice(-4).toUpperCase()}
              </span>

              {/* Progress bar */}
              <div className="flex-1 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', cfg.bar)}
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {/* Countdown */}
              <div className={cn('flex items-center gap-1 shrink-0', cfg.text)}>
                <Icon className="h-3 w-3" />
                <span className="text-[11px] font-black tabular-nums">
                  {formatCountdown(o.remainingMin)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

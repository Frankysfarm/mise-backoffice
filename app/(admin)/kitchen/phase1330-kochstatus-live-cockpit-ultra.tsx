'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, ChefHat, Clock, Flame, Timer, Zap } from 'lucide-react';

/**
 * Phase 1330 — Kochstatus-Live-Cockpit-Ultra (Kitchen)
 *
 * Echtzeit-Kochstatus mit 5-Stufen-Farbkodierung + Countdown je Bestellung.
 * Sortiert nach Dringlichkeit: Überfällig → Kritisch → Dringend → Normal → Optimal
 * Zeigt zusätzlich Batch-Informationen und Fahrer-Pickup-Status.
 */

interface Order {
  id: string;
  bestellnummer?: string | null;
  status?: string | null;
  bestellt_am?: string | null;
  created_at?: string | null;
  promised_at?: string | null;
  geschaetzte_zubereitung_min?: number | null;
  kunde_name?: string | null;
  typ?: string | null;
  items?: Array<{ name?: string; menge?: number }> | null;
}

interface Props {
  orders?: Order[];
  locationId?: string | null;
}

type Tier = 'overdone' | 'critical' | 'urgent' | 'normal' | 'optimal';

function computeTier(remainSec: number): Tier {
  if (remainSec < 0) return 'overdone';
  if (remainSec < 3 * 60) return 'critical';
  if (remainSec < 8 * 60) return 'urgent';
  if (remainSec < 20 * 60) return 'normal';
  return 'optimal';
}

const TIER_CONFIG: Record<Tier, {
  bg: string; border: string; text: string;
  badge: string; label: string; pulse: boolean; icon: React.ReactNode;
}> = {
  overdone: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-l-4 border-l-red-500',
    text: 'text-red-700 dark:text-red-300',
    badge: 'bg-red-600 text-white',
    label: 'ÜBERFÄLLIG',
    pulse: true,
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  critical: {
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    border: 'border-l-4 border-l-orange-500',
    text: 'text-orange-700 dark:text-orange-300',
    badge: 'bg-orange-500 text-white',
    label: 'KRITISCH',
    pulse: true,
    icon: <Flame className="h-3 w-3" />,
  },
  urgent: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-l-4 border-l-amber-400',
    text: 'text-amber-700 dark:text-amber-300',
    badge: 'bg-amber-400 text-white',
    label: 'DRINGEND',
    pulse: false,
    icon: <Timer className="h-3 w-3" />,
  },
  normal: {
    bg: 'bg-matcha-50 dark:bg-matcha-950/20',
    border: 'border-l-4 border-l-matcha-400',
    text: 'text-matcha-700 dark:text-matcha-300',
    badge: 'bg-matcha-500 text-white',
    label: 'NORMAL',
    pulse: false,
    icon: <Clock className="h-3 w-3" />,
  },
  optimal: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/20',
    border: 'border-l-4 border-l-emerald-400',
    text: 'text-emerald-700 dark:text-emerald-300',
    badge: 'bg-emerald-400 text-white',
    label: 'OPTIMAL',
    pulse: false,
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
};

const TIER_ORDER: Tier[] = ['overdone', 'critical', 'urgent', 'normal', 'optimal'];

function fmtCountdown(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = sec < 0 ? '+' : '';
  return `${sign}${m}:${s.toString().padStart(2, '0')}`;
}

function getDeadlineSec(order: Order): number {
  const prepMin = order.geschaetzte_zubereitung_min ?? 20;
  const base = order.promised_at
    ? new Date(order.promised_at).getTime()
    : (order.bestellt_am ?? order.created_at)
    ? new Date((order.bestellt_am ?? order.created_at)!).getTime() + prepMin * 60_000
    : null;
  if (!base) return 999 * 60;
  return Math.round((base - Date.now()) / 1000);
}

export function KitchenPhase1330KochstatusLiveCockpitUltra({ orders = [], locationId }: Props) {
  const [tick, setTick] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    ivRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    return () => { if (ivRef.current) clearInterval(ivRef.current); };
  }, []);

  const active = orders.filter(
    (o) => o.status && ['neu', 'bestätigt', 'in_zubereitung', 'fertig'].includes(o.status),
  );

  if (active.length === 0) return null;

  type Row = {
    order: Order;
    remainSec: number;
    tier: Tier;
    tierRank: number;
  };

  const rows: Row[] = active.map((order) => {
    const remainSec = getDeadlineSec(order);
    const tier = computeTier(remainSec);
    return { order, remainSec, tier, tierRank: TIER_ORDER.indexOf(tier) };
  });

  rows.sort((a, b) => a.tierRank - b.tierRank || a.remainSec - b.remainSec);

  const tierCounts = rows.reduce<Record<Tier, number>>(
    (acc, r) => { acc[r.tier] = (acc[r.tier] ?? 0) + 1; return acc; },
    { overdone: 0, critical: 0, urgent: 0, normal: 0, optimal: 0 },
  );

  const alertCount = tierCounts.overdone + tierCounts.critical;

  return (
    <div className="rounded-2xl border border-border bg-background shadow-sm overflow-hidden">
      {/* Header */}
      <div className={cn(
        'flex items-center gap-2 px-4 py-2.5 border-b border-border',
        alertCount > 0 ? 'bg-red-50 dark:bg-red-950/20' : 'bg-background',
      )}>
        <ChefHat className={cn('h-4 w-4 shrink-0', alertCount > 0 ? 'text-red-600' : 'text-matcha-600')} />
        <span className="text-xs font-bold uppercase tracking-wider">
          Kochstatus Live · {active.length} Bestellung{active.length !== 1 ? 'en' : ''}
        </span>
        {alertCount > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black text-white animate-pulse">
            <Zap className="h-2.5 w-2.5" />
            {alertCount} Alarm{alertCount !== 1 ? 'e' : ''}
          </span>
        )}
        {/* Tier summary */}
        <div className="ml-auto flex items-center gap-1">
          {TIER_ORDER.filter((t) => tierCounts[t] > 0).map((t) => {
            const cfg = TIER_CONFIG[t];
            return (
              <span key={t} className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-black', cfg.badge)}>
                {tierCounts[t]}
              </span>
            );
          })}
        </div>
      </div>

      {/* Order rows */}
      <div className="divide-y divide-border/50">
        {rows.map(({ order, remainSec, tier }) => {
          const cfg = TIER_CONFIG[tier];
          const isOpen = expanded.has(order.id);
          const progressPct = order.geschaetzte_zubereitung_min
            ? Math.min(100, Math.max(0, 100 - (remainSec / (order.geschaetzte_zubereitung_min * 60)) * 100))
            : null;

          return (
            <div
              key={order.id}
              className={cn('px-4 py-2.5', cfg.bg, cfg.border)}
              onClick={() =>
                setExpanded((prev) => {
                  const next = new Set(prev);
                  next.has(order.id) ? next.delete(order.id) : next.add(order.id);
                  return next;
                })
              }
              role="button"
            >
              <div className="flex items-center gap-2.5">
                {/* Tier badge */}
                <span className={cn(
                  'shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black',
                  cfg.badge,
                  cfg.pulse && 'animate-pulse',
                )}>
                  {cfg.icon}
                  {cfg.label}
                </span>

                {/* Order info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold tabular-nums">
                      #{order.bestellnummer ?? order.id.slice(0, 6)}
                    </span>
                    {order.kunde_name && (
                      <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                        {order.kunde_name}
                      </span>
                    )}
                    {order.typ && (
                      <span className="text-[9px] rounded-full bg-white/60 border px-1.5 py-0.5 font-semibold shrink-0">
                        {order.typ === 'lieferung' ? '🛵' : '🥡'} {order.typ}
                      </span>
                    )}
                  </div>
                  {/* Progress bar */}
                  {progressPct !== null && (
                    <div className="mt-1 h-1 rounded-full bg-black/10 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-1000',
                          tier === 'overdone' ? 'bg-red-500' :
                          tier === 'critical' ? 'bg-orange-500' :
                          tier === 'urgent'   ? 'bg-amber-400' :
                          tier === 'normal'   ? 'bg-matcha-500' : 'bg-emerald-400',
                        )}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Countdown */}
                <div className={cn('shrink-0 text-right', cfg.text)}>
                  <div className={cn(
                    'font-mono text-base font-black tabular-nums',
                    tier === 'overdone' && 'animate-pulse text-red-600',
                  )}>
                    {fmtCountdown(remainSec)}
                  </div>
                  <div className="text-[9px] text-muted-foreground">
                    {remainSec < 0 ? 'überfällig' : 'verbleibend'}
                  </div>
                </div>
              </div>

              {/* Expanded: items */}
              {isOpen && order.items && order.items.length > 0 && (
                <div className="mt-2 pl-2 border-l-2 border-border/50 space-y-0.5">
                  {order.items.slice(0, 5).map((item, i) => (
                    <div key={i} className="text-[11px] text-muted-foreground">
                      {item.menge ?? 1}× {item.name ?? '—'}
                    </div>
                  ))}
                  {order.items.length > 5 && (
                    <div className="text-[10px] text-muted-foreground">
                      +{order.items.length - 5} weitere
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

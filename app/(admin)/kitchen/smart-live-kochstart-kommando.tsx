'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, Zap, ChefHat, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  kunde_name: string;
  created_at: string;
};

type Timing = {
  id: string;
  order_id: string;
  status: string;
  cook_start_target: string | null;
  ready_target: string | null;
};

interface Props {
  orders: Order[];
  timings: Timing[];
}

type UrgencyLevel = 'green' | 'amber' | 'orange' | 'red';

interface EnrichedOrder {
  order: Order;
  timing: Timing | null;
  secondsRemaining: number | null;
  level: UrgencyLevel;
}

interface BatchGroup {
  key: string;
  items: EnrichedOrder[];
  earliestDeadline: number | null;
}

function getSecondsRemaining(timing: Timing | null, now: number): number | null {
  if (!timing?.ready_target) return null;
  return Math.round((new Date(timing.ready_target).getTime() - now) / 1000);
}

function getLevel(seconds: number | null): UrgencyLevel {
  if (seconds === null) return 'green';
  if (seconds < 60) return 'red';
  if (seconds < 120) return 'orange';
  if (seconds < 300) return 'amber';
  return 'green';
}

function formatCountdown(seconds: number): string {
  const abs = Math.abs(seconds);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = seconds < 0 ? '-' : '';
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}

const levelConfig: Record<
  UrgencyLevel,
  {
    border: string;
    bg: string;
    badgeBg: string;
    badgeText: string;
    countdownText: string;
    dot: string;
    label: string;
  }
> = {
  green: {
    border: 'border-matcha-500',
    bg: 'bg-matcha-50',
    badgeBg: 'bg-matcha-100',
    badgeText: 'text-matcha-700',
    countdownText: 'text-matcha-700',
    dot: 'bg-matcha-500',
    label: '>5 min',
  },
  amber: {
    border: 'border-amber-400',
    bg: 'bg-amber-50',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    countdownText: 'text-amber-700',
    dot: 'bg-amber-400',
    label: '2–5 min',
  },
  orange: {
    border: 'border-orange-500',
    bg: 'bg-orange-50',
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-700',
    countdownText: 'text-orange-700',
    dot: 'bg-orange-500',
    label: '1–2 min',
  },
  red: {
    border: 'border-red-500',
    bg: 'bg-red-50',
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-700',
    countdownText: 'text-red-700',
    dot: 'bg-red-500',
    label: '<1 min',
  },
};

const levelPriority: Record<UrgencyLevel, number> = {
  red: 0,
  orange: 1,
  amber: 2,
  green: 3,
};

function buildBatchGroups(enriched: EnrichedOrder[]): BatchGroup[] {
  const buckets: Record<string, EnrichedOrder[]> = {};

  for (const item of enriched) {
    const windowMinutes = item.secondsRemaining !== null
      ? Math.floor(item.secondsRemaining / 60 / 5)
      : -1;
    const key = `bucket_${windowMinutes}`;
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(item);
  }

  return Object.entries(buckets)
    .map(([key, items]): BatchGroup => {
      const deadlines = items
        .map((i) => i.secondsRemaining)
        .filter((s): s is number => s !== null);
      return {
        key,
        items: [...items].sort(
          (a, b) => levelPriority[a.level] - levelPriority[b.level],
        ),
        earliestDeadline: deadlines.length > 0 ? Math.min(...deadlines) : null,
      };
    })
    .sort((a, b) => {
      if (a.earliestDeadline === null && b.earliestDeadline === null) return 0;
      if (a.earliestDeadline === null) return 1;
      if (b.earliestDeadline === null) return -1;
      return a.earliestDeadline - b.earliestDeadline;
    });
}

function OrderCard({ item }: { item: EnrichedOrder }) {
  const cfg = levelConfig[item.level];
  const isUrgent = item.level === 'red' || item.level === 'orange';

  return (
    <div
      className={cn(
        'rounded-lg border-l-4 border border-l-current p-3 transition-all',
        cfg.border,
        cfg.bg,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'inline-block h-2 w-2 shrink-0 rounded-full',
                cfg.dot,
                isUrgent && 'animate-pulse',
              )}
            />
            <span className="truncate text-xs font-semibold text-foreground">
              #{item.order.bestellnummer}
            </span>
          </div>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {item.order.kunde_name}
          </div>
          {item.timing?.ready_target && (
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              Fertig:{' '}
              {new Date(item.timing.ready_target).toLocaleTimeString('de-DE', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          {item.secondsRemaining !== null ? (
            <div
              className={cn(
                'font-mono text-base font-bold tabular-nums leading-none',
                cfg.countdownText,
              )}
            >
              {formatCountdown(item.secondsRemaining)}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">—</div>
          )}
          <div
            className={cn(
              'mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold',
              cfg.badgeBg,
              cfg.badgeText,
            )}
          >
            {cfg.label}
          </div>
        </div>
      </div>

      {isUrgent && (
        <div className="mt-2 flex items-center gap-1.5 rounded-md bg-white/60 px-2 py-1">
          <Zap className="h-3 w-3 shrink-0 text-orange-500" />
          <span className="text-[11px] font-semibold text-orange-700">Jetzt kochen!</span>
        </div>
      )}
    </div>
  );
}

export function KitchenSmartLiveKochstartKommando({ orders, timings }: Props) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(tick);
  }, []);

  const enrich = useCallback((): EnrichedOrder[] => {
    const activeStatuses = new Set([
      'neu',
      'bestaetigt',
      'bestätigt',
      'in_zubereitung',
      'in_vorbereitung',
    ]);

    return orders
      .filter((o) => activeStatuses.has(o.status))
      .map((order): EnrichedOrder => {
        const timing = timings.find((t) => t.order_id === order.id) ?? null;
        const secondsRemaining = getSecondsRemaining(timing, now);
        const level = getLevel(secondsRemaining);
        return { order, timing, secondsRemaining, level };
      })
      .sort((a, b) => levelPriority[a.level] - levelPriority[b.level]);
  }, [orders, timings, now]);

  const enriched = enrich();

  if (enriched.length === 0) return null;

  const priorityList = enriched.slice(0, 5);
  const groups = buildBatchGroups(enriched);

  const urgentCount = enriched.filter(
    (e) => e.level === 'red' || e.level === 'orange',
  ).length;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ChefHat className="h-4 w-4 text-matcha-600" />
          <h2 className="text-sm font-semibold text-foreground">
            Live-Kochstart-Kommando
          </h2>
          {urgentCount > 0 && (
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
              {urgentCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>30 s</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <AlertCircle className="h-3 w-3" />
            Kochstart-Priorität
          </div>
          <div className="space-y-2">
            {priorityList.map((item) => (
              <OrderCard key={item.order.id} item={item} />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Zap className="h-3 w-3" />
            Batch-Gruppen
          </div>
          <div className="space-y-3">
            {groups.map((group, gi) => (
              <div
                key={group.key}
                className="rounded-lg border border-matcha-200 bg-white overflow-hidden"
              >
                <div className="flex items-center justify-between border-b border-matcha-100 bg-matcha-50 px-3 py-1.5">
                  <span className="text-[11px] font-semibold text-matcha-700">
                    Gruppe {gi + 1}
                  </span>
                  {group.earliestDeadline !== null && (
                    <span className="font-mono text-[11px] font-semibold text-matcha-600">
                      {formatCountdown(group.earliestDeadline)}
                    </span>
                  )}
                </div>
                <div className="divide-y divide-matcha-50">
                  {group.items.map((item) => {
                    const cfg = levelConfig[item.level];
                    return (
                      <div
                        key={item.order.id}
                        className="flex items-center justify-between gap-2 px-3 py-2"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={cn(
                              'inline-block h-2 w-2 shrink-0 rounded-full',
                              cfg.dot,
                            )}
                          />
                          <span className="truncate text-xs font-medium text-foreground">
                            #{item.order.bestellnummer}
                          </span>
                        </div>
                        {item.secondsRemaining !== null && (
                          <span
                            className={cn(
                              'font-mono text-xs font-bold tabular-nums shrink-0',
                              cfg.countdownText,
                            )}
                          >
                            {formatCountdown(item.secondsRemaining)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        {(['green', 'amber', 'orange', 'red'] as UrgencyLevel[]).map((lvl) => {
          const cfg = levelConfig[lvl];
          const count = enriched.filter((e) => e.level === lvl).length;
          if (count === 0) return null;
          return (
            <div key={lvl} className="flex items-center gap-1">
              <span className={cn('inline-block h-2 w-2 rounded-full', cfg.dot)} />
              <span className="text-[11px] text-muted-foreground">
                {cfg.label}: <span className="font-semibold text-foreground">{count}</span>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

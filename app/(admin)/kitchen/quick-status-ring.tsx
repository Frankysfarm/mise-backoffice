'use client';

/**
 * KitchenQuickStatusRing
 *
 * A compact (~150px) circular progress ring + status summary for the kitchen
 * dashboard. The ring is coloured by kitchen health:
 *   green  – all orders on track (>5 min remaining)
 *   amber  – at least one warn (2–5 min)
 *   orange – at least one urgent (<2 min)
 *   red    – at least one overdue / negative
 *
 * Inside the ring: total cooking-order count.
 * Below the ring: 4 coloured dots with counts for ok / warn / urgent / overdue.
 *
 * Also exports KitchenFarbStatusBoard – a horizontal strip of coloured tiles,
 * one per cooking order, sorted by urgency (most urgent first).
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, ChefHat, CheckCircle2, Clock, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Order = {
  id: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
};

type KitchenTiming = {
  id: string;
  order_id: string;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

const COLOR_GREEN  = '#22c55e';
const COLOR_AMBER  = '#f59e0b';
const COLOR_ORANGE = '#f97316';
const COLOR_RED    = '#ef4444';

type UrgencyLevel = 'ok' | 'warn' | 'urgent' | 'overdue';

function getSecsLeft(order: Order, timing: KitchenTiming | undefined): number {
  const now = Date.now();
  if (timing?.ready_target) {
    return (new Date(timing.ready_target).getTime() - now) / 1000;
  }
  if (order.bestellt_am) {
    const elapsed = (now - new Date(order.bestellt_am).getTime()) / 1000;
    return (order.geschaetzte_zubereitung_min ?? 15) * 60 - elapsed;
  }
  return (order.geschaetzte_zubereitung_min ?? 15) * 60;
}

function urgencyOf(secsLeft: number): UrgencyLevel {
  if (secsLeft <= 0)   return 'overdue';
  if (secsLeft <= 120) return 'urgent';
  if (secsLeft <= 300) return 'warn';
  return 'ok';
}

const URGENCY_COLOR: Record<UrgencyLevel, string> = {
  ok:      COLOR_GREEN,
  warn:    COLOR_AMBER,
  urgent:  COLOR_ORANGE,
  overdue: COLOR_RED,
};

const URGENCY_DOT_CLASS: Record<UrgencyLevel, string> = {
  ok:      'bg-green-500',
  warn:    'bg-amber-400',
  urgent:  'bg-orange-500',
  overdue: 'bg-red-500',
};

function healthColor(counts: Record<UrgencyLevel, number>): string {
  if (counts.overdue > 0) return COLOR_RED;
  if (counts.urgent  > 0) return COLOR_ORANGE;
  if (counts.warn    > 0) return COLOR_AMBER;
  return COLOR_GREEN;
}

// ---------------------------------------------------------------------------
// SVG status ring
// ---------------------------------------------------------------------------

function StatusRing({
  total,
  color,
  size = 96,
}: {
  total: number;
  color: string;
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r  = size / 2 - 8;
  const circumference = 2 * Math.PI * r;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      aria-hidden
    >
      {/* Track */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={6}
        className="text-black/8"
      />
      {/* Filled arc – always 100% to give a solid ring, coloured by health */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={0}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke 0.6s ease-in-out' }}
      />
      {/* Chef icon (small, centred) */}
      {/* We render the count via foreignObject is complex; use text instead */}
      <text
        x={cx}
        y={cy - 5}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={color}
        fontSize={total >= 10 ? 22 : 26}
        fontWeight="900"
        fontFamily="ui-monospace, monospace"
      >
        {total}
      </text>
      <text
        x={cx}
        y={cy + 13}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={color}
        fontSize={8}
        fontWeight="700"
        opacity={0.75}
        letterSpacing={0.5}
      >
        kochen
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// KitchenQuickStatusRing
// ---------------------------------------------------------------------------

interface QuickStatusRingProps {
  orders: Order[];
  timings: KitchenTiming[];
}

export function KitchenQuickStatusRing({ orders, timings }: QuickStatusRingProps) {
  // 1-second tick to keep countdowns live
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const cooking = orders.filter((o) => o.status === 'in_zubereitung');
  if (cooking.length === 0) return null;

  const timingMap = new Map(timings.map((t) => [t.order_id, t]));

  const counts: Record<UrgencyLevel, number> = { ok: 0, warn: 0, urgent: 0, overdue: 0 };
  for (const order of cooking) {
    const secs = getSecsLeft(order, timingMap.get(order.id));
    counts[urgencyOf(secs)]++;
  }

  const ringColor = healthColor(counts);

  const dots: { level: UrgencyLevel; label: string }[] = [
    { level: 'ok',      label: 'OK' },
    { level: 'warn',    label: '~' },
    { level: 'urgent',  label: '!' },
    { level: 'overdue', label: '!!' },
  ];

  return (
    <div className="inline-flex flex-col items-center gap-2 w-[150px]">
      {/* Ring */}
      <div className="relative">
        <StatusRing total={cooking.length} color={ringColor} size={96} />
      </div>

      {/* 4 status dots */}
      <div className="flex items-center justify-center gap-2.5">
        {dots.map(({ level, label }) => (
          <div key={level} className="flex flex-col items-center gap-0.5">
            <div
              className={cn(
                'h-3 w-3 rounded-full',
                URGENCY_DOT_CLASS[level],
                counts[level] === 0 && 'opacity-25',
              )}
              title={`${label}: ${counts[level]}`}
            />
            <span
              className={cn(
                'text-[9px] font-black tabular-nums leading-none',
                counts[level] > 0 ? 'text-foreground' : 'text-muted-foreground/40',
              )}
              style={counts[level] > 0 ? { color: URGENCY_COLOR[level] } : undefined}
            >
              {counts[level]}
            </span>
          </div>
        ))}
      </div>

      {/* Alarm banner when overdue */}
      {counts.overdue > 0 && (
        <div className="flex items-center gap-1 rounded-full bg-red-100 border border-red-200 px-2 py-0.5 text-[9px] font-black text-red-700 animate-pulse">
          <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
          {counts.overdue} überfällig
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KitchenFarbStatusBoard – horizontal strip of coloured order tiles
// ---------------------------------------------------------------------------

interface FarbStatusBoardProps {
  orders: Order[];
  timings: KitchenTiming[];
}

function formatCountdown(secsLeft: number): string {
  const abs  = Math.abs(secsLeft);
  const mins = Math.floor(abs / 60);
  const secs = Math.floor(abs % 60);
  const time = `${mins}:${String(secs).padStart(2, '0')}`;
  return secsLeft < 0 ? `+${time}` : time;
}

function OrderTile({ order, timing }: { order: Order; timing: KitchenTiming | undefined }) {
  const secsLeft = getSecsLeft(order, timing);
  const level    = urgencyOf(secsLeft);
  const isOverdue = level === 'overdue';

  const borderClass: Record<UrgencyLevel, string> = {
    ok:      'border-green-400  bg-green-50',
    warn:    'border-amber-400  bg-amber-50',
    urgent:  'border-orange-400 bg-orange-50',
    overdue: 'border-red-500   bg-red-50 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.25)]',
  };

  const timeClass: Record<UrgencyLevel, string> = {
    ok:      'text-green-700',
    warn:    'text-amber-700',
    urgent:  'text-orange-700',
    overdue: 'text-red-700',
  };

  const IconEl =
    level === 'overdue' ? AlertTriangle :
    level === 'urgent'  ? Zap           :
    level === 'warn'    ? Clock         :
    CheckCircle2;

  const iconClass: Record<UrgencyLevel, string> = {
    ok:      'text-green-500',
    warn:    'text-amber-500',
    urgent:  'text-orange-500',
    overdue: 'text-red-600',
  };

  // Show a compact order number: last 4 chars of id, or a generated label
  const label = `#${order.id.slice(-4).toUpperCase()}`;

  return (
    <div
      className={cn(
        'flex-shrink-0 w-[110px] rounded-xl border-2 px-2.5 py-2 flex flex-col gap-1',
        borderClass[level],
      )}
    >
      {/* Icon + order label */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1 min-w-0">
          <IconEl className={cn('h-3 w-3 shrink-0', iconClass[level])} />
          <span className="text-[10px] font-black text-foreground truncate">{label}</span>
        </div>
        {isOverdue && (
          <span className="text-[8px] font-black text-red-600 bg-red-100 rounded px-1 shrink-0">
            spät
          </span>
        )}
      </div>

      {/* Countdown */}
      <div
        className={cn(
          'font-mono text-xl font-black tabular-nums leading-none',
          timeClass[level],
        )}
      >
        {formatCountdown(secsLeft)}
      </div>

      {/* Prep hint */}
      <div className="text-[9px] text-muted-foreground leading-tight">
        {isOverdue
          ? 'überfällig'
          : level === 'urgent'
          ? 'fast fertig!'
          : level === 'warn'
          ? 'bald fertig'
          : 'in Arbeit'}
      </div>
    </div>
  );
}

export function KitchenFarbStatusBoard({ orders, timings }: FarbStatusBoardProps) {
  // 1-second tick
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const cooking = orders.filter((o) => o.status === 'in_zubereitung');
  if (cooking.length === 0) return null;

  const timingMap = new Map(timings.map((t) => [t.order_id, t]));

  // Sort by urgency: most urgent (smallest secsLeft) first
  const sorted = [...cooking].sort(
    (a, b) =>
      getSecsLeft(a, timingMap.get(a.id)) - getSecsLeft(b, timingMap.get(b.id)),
  );

  const counts: Record<UrgencyLevel, number> = { ok: 0, warn: 0, urgent: 0, overdue: 0 };
  for (const order of sorted) {
    counts[urgencyOf(getSecsLeft(order, timingMap.get(order.id)))]++;
  }
  const ringColor = healthColor(counts);

  return (
    <div className="rounded-xl border bg-card p-3 space-y-2.5">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <ChefHat className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-sm font-black text-foreground">Farb-Status</span>

        <span className="rounded-full bg-matcha-100 text-matcha-700 px-2 py-0.5 text-[10px] font-black">
          {cooking.length} kochen
        </span>

        {counts.overdue > 0 && (
          <span className="flex items-center gap-0.5 rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-black animate-pulse">
            <AlertTriangle className="h-2.5 w-2.5" />
            {counts.overdue} überfällig
          </span>
        )}
        {counts.urgent > 0 && (
          <span className="flex items-center gap-0.5 rounded-full bg-orange-100 text-orange-700 px-2 py-0.5 text-[10px] font-black">
            <Zap className="h-2.5 w-2.5" />
            {counts.urgent} dringend
          </span>
        )}

        {/* Health dot */}
        <span
          className="ml-auto h-3 w-3 rounded-full shrink-0"
          style={{ backgroundColor: ringColor }}
          title="Küchen-Gesundheit"
        />
      </div>

      {/* Scrollable tile strip */}
      <div className="flex items-stretch gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5">
        {sorted.map((order) => (
          <OrderTile
            key={order.id}
            order={order}
            timing={timingMap.get(order.id)}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap text-[9px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
          {'>'}5 Min
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
          2–5 Min
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-orange-500 inline-block" />
          {'<'}2 Min
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
          Überfällig
        </span>
      </div>
    </div>
  );
}

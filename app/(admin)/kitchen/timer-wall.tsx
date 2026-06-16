'use client';

import { useEffect, useState } from 'react';
import { Clock, AlertTriangle, ChefHat, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  kunde_name: string;
  items: { name: string; menge: number }[];
};

type KitchenTiming = {
  id: string;
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

type TimerCard = {
  order: Order;
  timing: KitchenTiming;
  secondsLeft: number;
};

const ACTIVE_STATUSES = new Set(['in_zubereitung', 'bestätigt']);

function getSecondsLeft(readyTarget: string | null): number {
  if (!readyTarget) return 0;
  return Math.floor((new Date(readyTarget).getTime() - Date.now()) / 1000);
}

function formatCountdown(seconds: number): string {
  const abs = Math.abs(seconds);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = seconds < 0 ? '-' : '';
  return `${sign}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

type UrgencyLevel = 'ok' | 'warning' | 'urgent' | 'overdue';

function getUrgency(seconds: number): UrgencyLevel {
  if (seconds < 0) return 'overdue';
  if (seconds < 120) return 'urgent';
  if (seconds < 300) return 'warning';
  return 'ok';
}

const urgencyStyles: Record<UrgencyLevel, { card: string; countdown: string; icon: string }> = {
  ok: {
    card: 'border-green-500/40 bg-matcha-800',
    countdown: 'text-green-400',
    icon: 'text-green-400',
  },
  warning: {
    card: 'border-amber-400/50 bg-matcha-800',
    countdown: 'text-amber-400',
    icon: 'text-amber-400',
  },
  urgent: {
    card: 'border-red-500/60 bg-matcha-800 animate-pulse',
    countdown: 'text-red-400',
    icon: 'text-red-400',
  },
  overdue: {
    card: 'border-gray-500/50 bg-matcha-900/80 animate-pulse',
    countdown: 'text-gray-400',
    icon: 'text-gray-400',
  },
};

function UrgencyIcon({ level }: { level: UrgencyLevel }) {
  const cls = urgencyStyles[level].icon;
  if (level === 'ok') return <CheckCircle2 className={cn('h-5 w-5', cls)} />;
  if (level === 'warning') return <Clock className={cn('h-5 w-5', cls)} />;
  if (level === 'urgent') return <AlertTriangle className={cn('h-5 w-5', cls)} />;
  return <AlertTriangle className={cn('h-5 w-5', cls)} />;
}

function TimerCardView({ card }: { card: TimerCard }) {
  const { order, secondsLeft } = card;
  const urgency = getUrgency(secondsLeft);
  const styles = urgencyStyles[urgency];

  const MAX_ITEMS = 4;
  const visibleItems = order.items.slice(0, MAX_ITEMS);
  const hiddenCount = order.items.length - MAX_ITEMS;

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-2xl border-2 p-5 transition-colors duration-500',
        styles.card,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-matcha-400">
          #{order.bestellnummer}
        </span>
        <UrgencyIcon level={urgency} />
      </div>

      <div
        className={cn(
          'font-mono text-6xl font-black leading-none tracking-tight tabular-nums',
          styles.countdown,
        )}
      >
        {formatCountdown(secondsLeft)}
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-matcha-50">{order.kunde_name}</span>
        <div className="mt-1 flex flex-col gap-0.5">
          {visibleItems.map((item, i) => (
            <span key={i} className="truncate text-xs text-matcha-300">
              {item.menge}× {item.name}
            </span>
          ))}
          {hiddenCount > 0 && (
            <span className="text-xs text-matcha-500">+{hiddenCount} weitere</span>
          )}
        </div>
      </div>

      {urgency === 'overdue' && (
        <div className="rounded-lg bg-gray-700/40 px-2 py-1 text-center text-xs font-semibold text-gray-300">
          Überfällig
        </div>
      )}
    </div>
  );
}

export function KitchenTimerWall({
  orders,
  timings,
}: {
  orders: Order[];
  timings: KitchenTiming[];
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const timingByOrderId = new Map(timings.map((t) => [t.order_id, t]));

  const cards: TimerCard[] = orders
    .filter((o) => ACTIVE_STATUSES.has(o.status))
    .flatMap((order) => {
      const timing = timingByOrderId.get(order.id);
      if (!timing) return [];
      return [{ order, timing, secondsLeft: getSecondsLeft(timing.ready_target) }];
    })
    .sort((a, b) => a.secondsLeft - b.secondsLeft);

  return (
    <div className="min-h-screen bg-matcha-900 p-6 text-matcha-50">
      <div className="mb-6 flex items-center gap-3">
        <ChefHat className="h-7 w-7 text-[#4ae68a]" />
        <h1 className="text-2xl font-bold tracking-tight text-matcha-50">Timer Wall</h1>
        <span className="ml-auto text-sm text-matcha-400">{cards.length} aktiv</span>
      </div>

      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-32 text-matcha-500">
          <ChefHat className="h-16 w-16 opacity-30" />
          <p className="text-lg font-medium">Keine aktiven Timer</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {cards.map((card) => (
            <TimerCardView key={card.order.id} card={card} />
          ))}
        </div>
      )}
    </div>
  );
}

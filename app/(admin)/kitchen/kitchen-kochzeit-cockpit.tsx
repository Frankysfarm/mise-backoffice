'use client';

import { useState, useEffect, useTransition } from 'react';
import { Clock, ChevronDown, ChevronUp, Flame, CheckCircle2, AlertTriangle, Zap, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { startCookingNow } from './actions';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  kunde_name: string;
  items?: { name: string; menge: number }[];
};

type KitchenTiming = {
  id: string;
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string; // 'pending' | 'cooking' | 'done'
};

type Urgency = 'overdue' | 'urgent' | 'tight' | 'ok' | 'done';

type EnrichedOrder = {
  order: Order;
  timing: KitchenTiming;
  urgency: Urgency;
  remainingMs: number;
};

const ACTIVE_STATUSES = ['bestätigt', 'angenommen', 'in_zubereitung'];
const DONE_STATUSES = ['done', 'fertig', 'geliefert'];
const MAX_ITEMS = 8;

const URGENCY_ORDER: Record<Urgency, number> = {
  overdue: 0,
  urgent: 1,
  tight: 2,
  ok: 3,
  done: 4,
};

const URGENCY_STYLES: Record<
  Urgency,
  { card: string; text: string; badge: string; badgeText: string; icon: React.ReactNode }
> = {
  overdue: {
    card: 'bg-red-50 border-red-300',
    text: 'text-red-700',
    badge: 'bg-red-500 text-white',
    badgeText: 'ÜBERFÄLLIG',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  urgent: {
    card: 'bg-orange-50 border-orange-300',
    text: 'text-orange-700',
    badge: 'bg-orange-500 text-white',
    badgeText: 'DRINGEND',
    icon: <Flame className="h-4 w-4" />,
  },
  tight: {
    card: 'bg-amber-50 border-amber-200',
    text: 'text-amber-700',
    badge: 'bg-amber-400 text-white',
    badgeText: 'BALD',
    icon: <Zap className="h-4 w-4" />,
  },
  ok: {
    card: 'bg-matcha-50 border-matcha-200',
    text: 'text-matcha-700',
    badge: 'bg-matcha-500 text-white',
    badgeText: 'OK',
    icon: <Timer className="h-4 w-4" />,
  },
  done: {
    card: 'bg-stone-50 border-stone-200',
    text: 'text-stone-400',
    badge: 'bg-stone-300 text-stone-600',
    badgeText: 'FERTIG',
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
};

function calcUrgency(order: Order, timing: KitchenTiming, nowMs: number): { urgency: Urgency; remainingMs: number } {
  if (DONE_STATUSES.includes(order.status) || timing.status === 'done') {
    return { urgency: 'done', remainingMs: 0 };
  }

  if (!timing.ready_target) {
    return { urgency: 'ok', remainingMs: Infinity };
  }

  const targetMs = new Date(timing.ready_target).getTime();
  const remainingMs = targetMs - nowMs;
  const remainingMin = remainingMs / 60000;

  if (remainingMin < -2) return { urgency: 'overdue', remainingMs };
  if (remainingMin < 0 || remainingMin < 2) return { urgency: 'urgent', remainingMs };
  if (remainingMin < 5) return { urgency: 'tight', remainingMs };
  return { urgency: 'ok', remainingMs };
}

function formatCountdown(remainingMs: number): string {
  if (!isFinite(remainingMs)) return '--:--';

  const negative = remainingMs < 0;
  const abs = Math.abs(remainingMs);
  const totalSeconds = Math.floor(abs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return negative ? `-${formatted}` : formatted;
}

function StartButton({ timingId }: { timingId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleStart() {
    startTransition(async () => {
      await startCookingNow(timingId);
    });
  }

  return (
    <button
      onClick={handleStart}
      disabled={isPending}
      className="mt-1 rounded-md bg-matcha-600 px-3 py-1 text-xs font-semibold text-white hover:bg-matcha-700 disabled:opacity-50 transition-colors"
    >
      {isPending ? 'Starte…' : 'Jetzt starten'}
    </button>
  );
}

function OrderCard({ enriched }: { enriched: EnrichedOrder }) {
  const { order, timing, urgency, remainingMs } = enriched;
  const styles = URGENCY_STYLES[urgency];
  const itemCount = order.items?.reduce((sum, i) => sum + i.menge, 0) ?? 0;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border px-3 py-2 shadow-sm transition-colors',
        styles.card
      )}
    >
      {/* Left: countdown */}
      <div className={cn('flex flex-col items-center justify-center min-w-[64px]', styles.text)}>
        <span className="text-xl font-mono font-bold leading-none tabular-nums">
          {formatCountdown(remainingMs)}
        </span>
        <span className="text-[10px] font-medium opacity-70 mt-0.5">min:sek</span>
      </div>

      {/* Center: info */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-bold leading-tight truncate', styles.text)}>
          #{order.bestellnummer}
        </p>
        <p className={cn('text-xs truncate', styles.text, 'opacity-80')}>
          {order.kunde_name}
        </p>
        {itemCount > 0 && (
          <p className={cn('text-[11px] opacity-60', styles.text)}>
            {itemCount} {itemCount === 1 ? 'Artikel' : 'Artikel'}
          </p>
        )}
        {timing.status === 'pending' && (
          <StartButton timingId={timing.id} />
        )}
      </div>

      {/* Right: badge */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
            styles.badge
          )}
        >
          {styles.icon}
          {styles.badgeText}
        </span>
        {timing.prep_min != null && (
          <span className={cn('text-[10px] opacity-60', styles.text)}>
            {timing.prep_min} Min. Gar.
          </span>
        )}
      </div>
    </div>
  );
}

export function KitchenKochzeitCockpit({
  orders,
  timings,
}: {
  orders: Order[];
  timings: KitchenTiming[];
}) {
  const [now, setNow] = useState<number>(() => Date.now());
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Build a map for quick timing lookup
  const timingByOrderId = new Map<string, KitchenTiming>(
    timings.map((t) => [t.order_id, t])
  );

  // Filter to only active orders that have a timing entry
  const enriched: EnrichedOrder[] = orders
    .filter((o) => ACTIVE_STATUSES.includes(o.status) && timingByOrderId.has(o.id))
    .map((order) => {
      const timing = timingByOrderId.get(order.id)!;
      const { urgency, remainingMs } = calcUrgency(order, timing, now);
      return { order, timing, urgency, remainingMs };
    })
    .sort((a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency])
    .slice(0, MAX_ITEMS);

  const overdueCount = enriched.filter((e) => e.urgency === 'overdue').length;
  const urgentCount = enriched.filter((e) => e.urgency === 'urgent').length;

  return (
    <section className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-stone-50 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-matcha-600 shrink-0" />
          <span className="text-base font-semibold text-stone-800">Kochzeit-Cockpit</span>
          {enriched.length > 0 && (
            <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
              {enriched.length}
            </span>
          )}
          {overdueCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
              <AlertTriangle className="h-3 w-3" />
              {overdueCount} überfällig
            </span>
          )}
          {urgentCount > 0 && overdueCount === 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-xs font-bold text-white">
              <Flame className="h-3 w-3" />
              {urgentCount} dringend
            </span>
          )}
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-stone-400 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-stone-400 shrink-0" />
        )}
      </button>

      {/* Body */}
      {open && (
        <div className="px-3 pb-3 pt-1">
          {enriched.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-stone-400">
              <CheckCircle2 className="h-8 w-8 opacity-40" />
              <p className="text-sm font-medium">Keine aktiven Kochzeiten</p>
              <p className="text-xs opacity-70">Alle Bestellungen sind auf dem Laufenden.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {enriched.map((e) => (
                <li key={e.order.id}>
                  <OrderCard enriched={e} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

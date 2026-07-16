'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, ChevronDown, ChevronUp, AlertCircle, ArrowUp } from 'lucide-react';

interface Order {
  id: string;
  status?: string;
  scheduled_for?: string | null;
  created_at?: string;
  customer_name?: string | null;
  items?: { name?: string }[];
}

interface Props {
  orders: Order[];
}

interface PrioritizedOrder {
  order: Order;
  label: string;
  priority: 'overdue' | 'urgent' | 'scheduled' | 'normal';
  minutesLeft: number | null;
}

function prioritize(orders: Order[]): PrioritizedOrder[] {
  const now = Date.now();
  const active = orders.filter(o =>
    o.status !== 'delivered' && o.status !== 'cancelled' && o.status !== 'storniert',
  );

  return active
    .map(o => {
      const target = o.scheduled_for
        ? new Date(o.scheduled_for).getTime()
        : o.created_at
          ? new Date(o.created_at).getTime() + 30 * 60 * 1000
          : null;

      const minutesLeft = target != null ? Math.round((target - now) / 60000) : null;

      let priority: PrioritizedOrder['priority'] = 'normal';
      let label = 'Normal';

      if (minutesLeft !== null) {
        if (minutesLeft < 0) {
          priority = 'overdue';
          label = `${Math.abs(minutesLeft)} Min überfällig`;
        } else if (minutesLeft <= 10) {
          priority = 'urgent';
          label = `in ${minutesLeft} Min`;
        } else if (o.scheduled_for) {
          priority = 'scheduled';
          label = `geplant in ${minutesLeft} Min`;
        }
      }

      return { order: o, label, priority, minutesLeft };
    })
    .sort((a, b) => {
      const rank = { overdue: 0, urgent: 1, scheduled: 2, normal: 3 };
      const rDiff = rank[a.priority] - rank[b.priority];
      if (rDiff !== 0) return rDiff;
      // Within same rank: sort by minutesLeft ascending (most urgent first)
      if (a.minutesLeft !== null && b.minutesLeft !== null) return a.minutesLeft - b.minutesLeft;
      return 0;
    })
    .slice(0, 8);
}

const PRIORITY_STYLE = {
  overdue: {
    border: 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20',
    badge: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
    dot: 'bg-red-500',
    icon: <AlertCircle className="h-3 w-3 text-red-500 shrink-0" />,
  },
  urgent: {
    border: 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20',
    badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-400',
    icon: <ArrowUp className="h-3 w-3 text-amber-500 shrink-0" />,
  },
  scheduled: {
    border: 'border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/20',
    badge: 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300',
    dot: 'bg-sky-400',
    icon: null,
  },
  normal: {
    border: 'border-border bg-muted/10',
    badge: 'bg-muted text-muted-foreground',
    dot: 'bg-muted-foreground/40',
    icon: null,
  },
};

export function KitchenPhase2029ZubereitungszeitOptimierer({ orders }: Props) {
  const [open, setOpen] = useState(true);
  const prioritized = useMemo(() => prioritize(orders), [orders]);

  const overdueCount = prioritized.filter(p => p.priority === 'overdue').length;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <ChefHat className="h-4 w-4 text-violet-500 shrink-0" />
        <span className="font-semibold text-sm flex-1">Zubereitungszeit-Optimierer</span>
        {overdueCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
            <AlertCircle className="h-3 w-3" /> {overdueCount} überfällig
          </span>
        )}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {prioritized.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Keine aktiven Bestellungen.</p>
          ) : (
            <>
              <p className="text-[10px] text-muted-foreground">
                Empfohlene Koch-Reihenfolge — überfällige und dringende Bestellungen zuerst.
              </p>
              {prioritized.map((p, idx) => {
                const styles = PRIORITY_STYLE[p.priority];
                const name = p.order.customer_name ?? `#${p.order.id.slice(0, 6)}`;
                return (
                  <div
                    key={p.order.id}
                    className={cn('flex items-center gap-2 rounded-lg border px-3 py-2', styles.border)}
                  >
                    <span className="shrink-0 w-5 h-5 rounded-full bg-muted/30 flex items-center justify-center text-[10px] font-black text-muted-foreground">
                      {idx + 1}
                    </span>
                    <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', styles.dot)} />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold truncate">{name}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {styles.icon}
                      <span className={cn('text-[10px] font-bold rounded-full px-1.5 py-0.5', styles.badge)}>
                        {p.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

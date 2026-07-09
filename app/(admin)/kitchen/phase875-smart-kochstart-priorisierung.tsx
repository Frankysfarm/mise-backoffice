'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChefHat, Clock, Flame, Zap } from 'lucide-react';

/**
 * phase875 — Smart Kochstart-Priorisierung
 *
 * Kombiniert Fahrer-ETA und Küchen-Restzeit um zu berechnen,
 * WANN genau mit der Zubereitung begonnen werden soll.
 * Priorisiert Bestellungen nach: (Fahrer-Ankunft) – (Prep-Zeit) = Kochstart-Zeitpunkt
 */

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
};

type KitchenTiming = {
  id: string;
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

interface Props {
  orders: Order[];
  timings: KitchenTiming[];
  driverEtaMin?: number | null; // Fahrer-ETA in Minuten bis Restaurant-Ankunft
}

type Priority = 'jetzt' | 'bald' | 'warten' | 'fertig';

interface PrioOrder {
  order: Order;
  timing: KitchenTiming | null;
  kochstartInMin: number;
  priority: Priority;
  prepMin: number;
}

function useTick(ms = 5000) {
  const [, set] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(iv);
  }, [ms]);
}

function calcKochstartInMin(
  order: Order,
  timing: KitchenTiming | null,
  driverEtaMin: number | null,
): number {
  if (timing?.cook_start_at) {
    return Math.floor((new Date(timing.cook_start_at).getTime() - Date.now()) / 60000);
  }
  const prep = timing?.prep_min ?? order.geschaetzte_zubereitung_min ?? 15;
  const driverArrival = driverEtaMin ?? 10;
  return driverArrival - prep;
}

function getPriority(kochstartInMin: number, status: string): Priority {
  if (status === 'fertig') return 'fertig';
  if (kochstartInMin <= 0) return 'jetzt';
  if (kochstartInMin <= 3) return 'bald';
  return 'warten';
}

const PRIO_CONFIG: Record<Priority, { bg: string; text: string; badge: string; icon: React.ElementType; label: string; pulse: boolean }> = {
  jetzt:   { bg: 'bg-red-50 border-red-400',    text: 'text-red-800',   badge: 'bg-red-500 text-white',         icon: Flame,         label: 'Jetzt kochen!', pulse: true  },
  bald:    { bg: 'bg-amber-50 border-amber-400', text: 'text-amber-800', badge: 'bg-amber-500 text-white',       icon: Zap,           label: 'In Kürze',      pulse: true  },
  warten:  { bg: 'bg-card border-border',        text: 'text-foreground',badge: 'bg-muted text-muted-foreground',icon: Clock,         label: 'Warten',        pulse: false },
  fertig:  { bg: 'bg-matcha-50 border-matcha-300',text:'text-matcha-700',badge: 'bg-matcha-100 text-matcha-700', icon: ChefHat,       label: 'Fertig',        pulse: false },
};

export function KitchenPhase875SmartKochstartPriorisierung({ orders, timings, driverEtaMin }: Props) {
  useTick();

  const ACTIVE = ['bestätigt', 'in_zubereitung'];

  const prioOrders = useMemo<PrioOrder[]>(() => {
    return orders
      .filter((o) => ACTIVE.includes(o.status))
      .map((o) => {
        const timing = timings.find((t) => t.order_id === o.id) ?? null;
        const prepMin = timing?.prep_min ?? o.geschaetzte_zubereitung_min ?? 15;
        const kochstartInMin = calcKochstartInMin(o, timing, driverEtaMin ?? null);
        const priority = getPriority(kochstartInMin, o.status);
        return { order: o, timing, kochstartInMin, priority, prepMin };
      })
      .sort((a, b) => a.kochstartInMin - b.kochstartInMin)
      .slice(0, 6);
  }, [orders, timings, driverEtaMin]);

  const urgentCount = prioOrders.filter((p) => p.priority === 'jetzt').length;
  const soonCount   = prioOrders.filter((p) => p.priority === 'bald').length;

  if (prioOrders.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChefHat size={16} className="text-matcha-600" />
          <span className="text-sm font-semibold text-foreground">Kochstart-Priorisierung</span>
        </div>
        <div className="flex items-center gap-1.5">
          {urgentCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white animate-pulse">
              <Flame size={10} />
              {urgentCount} jetzt
            </span>
          )}
          {soonCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white">
              <Zap size={10} />
              {soonCount} bald
            </span>
          )}
        </div>
      </div>

      {/* Order list */}
      <div className="space-y-2">
        {prioOrders.map(({ order, kochstartInMin, priority, prepMin }) => {
          const cfg = PRIO_CONFIG[priority];
          const Icon = cfg.icon;
          const absMin = Math.abs(kochstartInMin);

          return (
            <div
              key={order.id}
              className={cn(
                'flex items-center justify-between rounded-lg border p-2.5 transition-all',
                cfg.bg,
                cfg.pulse && 'animate-pulse',
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0', cfg.badge)}>
                  <Icon size={9} />
                  {cfg.label}
                </span>
                <span className={cn('text-xs font-medium truncate', cfg.text)}>
                  #{order.bestellnummer}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[10px] text-muted-foreground">
                  {prepMin} min prep
                </span>
                <span className={cn('text-xs font-bold tabular-nums', cfg.text)}>
                  {priority === 'fertig'
                    ? '✓'
                    : kochstartInMin <= 0
                    ? `${absMin}m über`
                    : `in ${absMin}m`
                  }
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {driverEtaMin != null && (
        <p className="mt-2.5 text-[10px] text-muted-foreground text-center">
          Fahrer-Ankunft in ~{driverEtaMin} min · Kochstart-Empfehlung basiert auf Fahrer-ETA
        </p>
      )}
    </div>
  );
}

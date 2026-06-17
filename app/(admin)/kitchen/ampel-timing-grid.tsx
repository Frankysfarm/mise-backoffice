'use client';

import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Clock, ChefHat, AlertTriangle, CheckCircle2, Zap, Timer } from 'lucide-react';

type KitchenTiming = {
  id: string;
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  kunde_name: string;
  items: { name: string; menge: number }[];
};

interface Props {
  orders: Order[];
  timings: KitchenTiming[];
}

type UrgencyLevel = 'ok' | 'warning' | 'urgent' | 'overdue';

function getUrgency(secsLeft: number): UrgencyLevel {
  if (secsLeft < 0) return 'overdue';
  if (secsLeft < 120) return 'urgent';
  if (secsLeft < 300) return 'warning';
  return 'ok';
}

const URGENCY = {
  ok:      { bg: 'bg-matcha-50 border-matcha-300',     badge: 'bg-matcha-600 text-white',      text: 'text-matcha-700',   icon: CheckCircle2, label: 'Pünktlich'  },
  warning: { bg: 'bg-amber-50 border-amber-300',        badge: 'bg-amber-500 text-white',        text: 'text-amber-700',    icon: Clock,        label: 'Knapp'      },
  urgent:  { bg: 'bg-orange-50 border-orange-400',      badge: 'bg-orange-600 text-white',       text: 'text-orange-700',   icon: Zap,          label: 'Dringend'   },
  overdue: { bg: 'bg-red-50 border-red-400 animate-pulse', badge: 'bg-red-600 text-white',      text: 'text-red-700',      icon: AlertTriangle, label: 'Überfällig' },
};

function fmtCountdown(secs: number): string {
  const abs = Math.abs(secs);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${secs < 0 ? '-' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtProgress(cookStart: string | null, prepMin: number | null): number {
  if (!cookStart || !prepMin || prepMin <= 0) return 0;
  const elapsed = (Date.now() - new Date(cookStart).getTime()) / 60_000;
  return Math.min(100, Math.round((elapsed / prepMin) * 100));
}

type Card = {
  order: Order;
  timing: KitchenTiming;
  secsLeft: number;
  urgency: UrgencyLevel;
  progress: number;
};

export function KitchenAmpelTimingGrid({ orders, timings }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const activeStatuses = new Set(['in_zubereitung', 'bestätigt']);
  const timingMap = new Map(timings.map((t) => [t.order_id, t]));

  const cards: Card[] = orders
    .filter((o) => activeStatuses.has(o.status))
    .map((o) => {
      const t = timingMap.get(o.id);
      if (!t || !t.ready_target) return null;
      const secsLeft = Math.floor((new Date(t.ready_target).getTime() - Date.now()) / 1000);
      return {
        order: o,
        timing: t,
        secsLeft,
        urgency: getUrgency(secsLeft),
        progress: fmtProgress(t.cook_start_at, t.prep_min),
      };
    })
    .filter((c): c is Card => c !== null)
    .sort((a, b) => a.secsLeft - b.secsLeft);

  if (cards.length === 0) return null;

  const overdueCount = cards.filter((c) => c.urgency === 'overdue').length;
  const urgentCount = cards.filter((c) => c.urgency === 'urgent').length;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
        <Timer className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Ampel-Timing-Grid</span>
        <div className="ml-auto flex items-center gap-1.5">
          {overdueCount > 0 && (
            <span className="rounded-full bg-red-500 text-white text-[10px] font-black px-2 py-0.5 animate-pulse">
              {overdueCount} überfällig
            </span>
          )}
          {urgentCount > 0 && (
            <span className="rounded-full bg-orange-500 text-white text-[10px] font-black px-2 py-0.5">
              {urgentCount} dringend
            </span>
          )}
          <span className="rounded-full bg-muted text-muted-foreground text-[10px] font-bold px-2 py-0.5">
            {cards.length} aktiv
          </span>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 p-3">
        {cards.map((card) => {
          const u = URGENCY[card.urgency];
          const Icon = u.icon;
          return (
            <div
              key={card.order.id}
              className={cn(
                'rounded-lg border p-3 space-y-2 transition-all duration-500',
                u.bg,
              )}
            >
              {/* Top: Bestellnummer + Urgency-Badge */}
              <div className="flex items-center gap-1.5">
                <span className={cn('rounded-md px-1.5 py-0.5 text-[9px] font-black tracking-wide', u.badge)}>
                  {u.label}
                </span>
                <span className="ml-auto text-[10px] font-bold text-muted-foreground truncate">
                  #{card.order.bestellnummer}
                </span>
              </div>

              {/* Countdown */}
              <div className={cn('text-center font-mono font-black text-2xl tabular-nums leading-none', u.text)}>
                {fmtCountdown(card.secsLeft)}
              </div>

              {/* Progress bar */}
              {card.progress > 0 && (
                <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-1000',
                      card.urgency === 'ok' ? 'bg-matcha-500' :
                      card.urgency === 'warning' ? 'bg-amber-500' :
                      card.urgency === 'urgent' ? 'bg-orange-500' : 'bg-red-500',
                    )}
                    style={{ width: `${card.progress}%` }}
                  />
                </div>
              )}

              {/* Kunde + Items */}
              <div>
                <div className="text-[11px] font-bold truncate">{card.order.kunde_name}</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {card.order.items.slice(0, 2).map((it) => `${it.menge}× ${it.name}`).join(', ')}
                  {card.order.items.length > 2 && ` +${card.order.items.length - 2}`}
                </div>
              </div>

              {/* Icon */}
              <div className="flex justify-end">
                <Icon className={cn('h-4 w-4', u.text)} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

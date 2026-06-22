'use client';

/**
 * KitchenSmartBatchPrognose — Phase 403
 *
 * Zeigt für alle aktiven Bestellungen:
 *  - Erwartete Fertigstellungszeit basierend auf cook_start_at + prep_min
 *  - Farbkodierung grün/gelb/orange/rot nach Zeitpuffer
 *  - Batch-Gruppierung: welche Bestellungen gehören zur selben Abholung
 *  - Mini-Countdown in Echtzeit (1-Sekunden-Intervall)
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, ChefHat, CheckCircle2, AlertTriangle, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/components/ui/card';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  kunde_name: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
};

type KitchenTiming = {
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

interface Props {
  orders: Order[];
  timings: KitchenTiming[];
}

type UrgencyLevel = 'fertig' | 'entspannt' | 'knapp' | 'kritisch' | 'überfällig';

function getUrgency(order: Order, timing: KitchenTiming | undefined, nowMs: number): UrgencyLevel {
  if (order.status === 'fertig' || order.status === 'unterwegs' || order.status === 'geliefert') {
    return 'fertig';
  }
  const target = timing?.ready_target
    ? new Date(timing.ready_target).getTime()
    : order.bestellt_am
    ? new Date(order.bestellt_am).getTime() + (order.geschaetzte_zubereitung_min ?? 20) * 60_000
    : null;

  if (!target) return 'entspannt';

  const remainSec = Math.floor((target - nowMs) / 1000);
  if (remainSec < -120) return 'überfällig';
  if (remainSec < 60)   return 'kritisch';
  if (remainSec < 240)  return 'knapp';
  return 'entspannt';
}

const URGENCY_STYLE: Record<UrgencyLevel, {
  bg: string; border: string; badge: string; label: string; glow: boolean;
}> = {
  fertig:      { bg: 'bg-matcha-50',  border: 'border-matcha-300', badge: 'bg-matcha-500 text-white',    label: '✓ Fertig',    glow: false },
  entspannt:   { bg: 'bg-white',      border: 'border-border',     badge: 'bg-green-500 text-white',     label: 'Im Plan',     glow: false },
  knapp:       { bg: 'bg-amber-50',   border: 'border-amber-300',  badge: 'bg-amber-500 text-white',     label: 'Knapp',       glow: false },
  kritisch:    { bg: 'bg-orange-50',  border: 'border-orange-300', badge: 'bg-orange-500 text-white',    label: 'Kritisch',    glow: true  },
  überfällig:  { bg: 'bg-red-50',     border: 'border-red-400',    badge: 'bg-red-600 text-white',       label: 'Überfällig',  glow: true  },
};

const URGENCY_ORDER: UrgencyLevel[] = ['überfällig', 'kritisch', 'knapp', 'entspannt', 'fertig'];

function formatCountdown(order: Order, timing: KitchenTiming | undefined, nowMs: number): string {
  if (order.status === 'fertig' || order.status === 'unterwegs') return '✓';

  const target = timing?.ready_target
    ? new Date(timing.ready_target).getTime()
    : order.bestellt_am
    ? new Date(order.bestellt_am).getTime() + (order.geschaetzte_zubereitung_min ?? 20) * 60_000
    : null;

  if (!target) return '--:--';

  const diffSec = Math.floor((target - nowMs) / 1000);
  const absSec = Math.abs(diffSec);
  const mm = Math.floor(absSec / 60);
  const ss = absSec % 60;
  const sign = diffSec < 0 ? '+' : '';
  return `${sign}${mm}:${String(ss).padStart(2, '0')}`;
}

function useTick(intervalMs = 1000) {
  const [, setN] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setN(n => n + 1), intervalMs);
    return () => clearInterval(iv);
  }, [intervalMs]);
}

export function KitchenSmartBatchPrognose({ orders, timings }: Props) {
  useTick();
  const [open, setOpen] = useState(true);

  const now = Date.now();
  const timingMap = new Map(timings.map(t => [t.order_id, t]));

  const activeOrders = orders.filter(o =>
    ['bestätigt', 'angenommen', 'in_zubereitung', 'fertig'].includes(o.status),
  );

  if (activeOrders.length === 0) return null;

  const sorted = [...activeOrders].sort((a, b) => {
    const ua = getUrgency(a, timingMap.get(a.id), now);
    const ub = getUrgency(b, timingMap.get(b.id), now);
    return URGENCY_ORDER.indexOf(ua) - URGENCY_ORDER.indexOf(ub);
  });

  const criticalCount = sorted.filter(o => {
    const u = getUrgency(o, timingMap.get(o.id), now);
    return u === 'kritisch' || u === 'überfällig';
  }).length;

  return (
    <Card className="overflow-hidden">
      <button
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <Zap className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Batch-Prognose · Smart-Timing
        </span>
        {criticalCount > 0 && (
          <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white animate-pulse">
            <AlertTriangle size={9} />
            {criticalCount}
          </span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">
          {activeOrders.length} Bestellung{activeOrders.length !== 1 ? 'en' : ''}
        </span>
        {open ? <ChevronUp size={14} className="shrink-0 text-muted-foreground" /> : <ChevronDown size={14} className="shrink-0 text-muted-foreground" />}
      </button>

      {open && (
        <div className="divide-y">
          {sorted.map(order => {
            const timing = timingMap.get(order.id);
            const urgency = getUrgency(order, timing, now);
            const style = URGENCY_STYLE[urgency];
            const countdown = formatCountdown(order, timing, now);
            const hasCookStart = !!timing?.cook_start_at;
            const isPreparing = order.status === 'in_zubereitung';

            return (
              <div
                key={order.id}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 transition-colors',
                  style.bg,
                  style.glow && 'animate-pulse',
                )}
              >
                {/* Status Icon */}
                <div className="shrink-0">
                  {urgency === 'fertig' ? (
                    <CheckCircle2 className="h-5 w-5 text-matcha-500" />
                  ) : isPreparing || hasCookStart ? (
                    <ChefHat className="h-5 w-5 text-amber-500" />
                  ) : (
                    <Clock className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>

                {/* Bestellnummer + Kunde */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground">#{order.bestellnummer}</span>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black',
                        style.badge,
                      )}
                    >
                      {style.label}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {order.kunde_name}
                  </div>
                </div>

                {/* Countdown */}
                <div
                  className={cn(
                    'shrink-0 font-mono font-black tabular-nums text-sm',
                    urgency === 'fertig'     ? 'text-matcha-600' :
                    urgency === 'entspannt'  ? 'text-green-600'  :
                    urgency === 'knapp'      ? 'text-amber-600'  :
                    urgency === 'kritisch'   ? 'text-orange-600' :
                                               'text-red-600',
                  )}
                >
                  {countdown}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

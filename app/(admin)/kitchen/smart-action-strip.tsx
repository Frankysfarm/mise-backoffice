'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, CheckCircle2, Loader2, AlertTriangle, Zap, Timer } from 'lucide-react';
import { advanceOrder } from './actions';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  typ: string;
  kunde_name: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  items: { id: string; name: string; menge: number }[];
};

type Timing = {
  id: string;
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

type UrgencyLevel = 'critical' | 'urgent' | 'normal';

function getUrgency(order: Order, timing: Timing | undefined): UrgencyLevel {
  const now = Date.now();
  if (timing?.ready_target) {
    const remainMs = new Date(timing.ready_target).getTime() - now;
    if (remainMs < 0) return 'critical';
    if (remainMs < 3 * 60_000) return 'urgent';
    return 'normal';
  }
  if (order.bestellt_am) {
    const elapsedMin = (now - new Date(order.bestellt_am).getTime()) / 60_000;
    const target = order.geschaetzte_zubereitung_min ?? 20;
    if (elapsedMin > target) return 'critical';
    if (elapsedMin > target * 0.85) return 'urgent';
  }
  return 'normal';
}

function formatCountdown(ms: number): string {
  const abs = Math.abs(ms);
  const m = Math.floor(abs / 60_000);
  const s = Math.floor((abs % 60_000) / 1_000);
  const sign = ms < 0 ? '-' : '';
  return `${sign}${m}:${s.toString().padStart(2, '0')}`;
}

function CountdownClock({ order, timing }: { order: Order; timing: Timing | undefined }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(iv);
  }, []);

  let ms: number | null = null;
  let label = '';

  if (timing?.ready_target) {
    ms = new Date(timing.ready_target).getTime() - now;
    label = ms < 0 ? 'Überfällig!' : 'bis fertig';
  } else if (order.bestellt_am) {
    const target = order.geschaetzte_zubereitung_min ?? 20;
    const deadline = new Date(order.bestellt_am).getTime() + target * 60_000;
    ms = deadline - now;
    label = ms < 0 ? 'Überfällig!' : 'verbleibend';
  }

  if (ms === null) return null;

  const urgency = ms < 0 ? 'critical' : ms < 3 * 60_000 ? 'urgent' : 'normal';
  return (
    <div className="flex flex-col items-center">
      <span className={cn(
        'font-mono text-2xl font-black tabular-nums leading-none',
        urgency === 'critical' ? 'text-red-600 animate-pulse' :
        urgency === 'urgent' ? 'text-orange-600' : 'text-matcha-700',
      )}>
        {formatCountdown(ms)}
      </span>
      <span className={cn(
        'text-[9px] font-bold uppercase tracking-wide mt-0.5',
        urgency === 'critical' ? 'text-red-500' :
        urgency === 'urgent' ? 'text-orange-500' : 'text-matcha-500',
      )}>
        {label}
      </span>
    </div>
  );
}

const NEXT_STATUS: Record<string, string> = {
  'neu': 'bestätigt',
  'bestätigt': 'in_zubereitung',
  'in_zubereitung': 'fertig',
};

const ACTION_LABEL: Record<string, string> = {
  'neu': 'Annehmen',
  'bestätigt': 'Kochen starten',
  'in_zubereitung': 'Fertig',
};

const ACTION_ICON: Record<string, React.ReactNode> = {
  'neu': <ChefHat className="h-3.5 w-3.5" />,
  'bestätigt': <Timer className="h-3.5 w-3.5" />,
  'in_zubereitung': <CheckCircle2 className="h-3.5 w-3.5" />,
};

export function KitchenSmartActionStrip({
  orders,
  timings,
}: {
  orders: Order[];
  timings: Timing[];
}) {
  const [pending, startTransition] = useTransition();
  const [actionPendingId, setActionPendingId] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 10_000);
    return () => clearInterval(iv);
  }, []);

  const timingMap = new Map(timings.map(t => [t.order_id, t]));

  const actionable = orders
    .filter(o => ['neu', 'bestätigt', 'in_zubereitung'].includes(o.status))
    .map(o => ({ order: o, timing: timingMap.get(o.id), urgency: getUrgency(o, timingMap.get(o.id)) }))
    .sort((a, b) => {
      const uOrder = ['critical', 'urgent', 'normal'];
      const uDiff = uOrder.indexOf(a.urgency) - uOrder.indexOf(b.urgency);
      if (uDiff !== 0) return uDiff;
      const aTime = a.order.bestellt_am ? new Date(a.order.bestellt_am).getTime() : 0;
      const bTime = b.order.bestellt_am ? new Date(b.order.bestellt_am).getTime() : 0;
      return aTime - bTime;
    })
    .slice(0, 4);

  if (actionable.length === 0) return null;

  const criticalCount = actionable.filter(a => a.urgency === 'critical').length;

  async function doAction(orderId: string, currentStatus: string) {
    const next = NEXT_STATUS[currentStatus];
    if (!next) return;
    setActionPendingId(orderId);
    startTransition(async () => {
      await advanceOrder(orderId, next);
      setActionPendingId(null);
    });
  }

  return (
    <div className="rounded-xl border border-matcha-700/30 bg-matcha-950/90 overflow-hidden shadow-strong">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-matcha-700/40 bg-matcha-900/80">
        <Zap className="h-4 w-4 text-matcha-300 shrink-0" />
        <span className="text-[11px] font-black uppercase tracking-widest text-matcha-200">
          Sofort-Aktionen · {actionable.length} offen
        </span>
        {criticalCount > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-black text-white animate-pulse">
            <AlertTriangle className="h-3 w-3" />
            {criticalCount} kritisch
          </span>
        )}
      </div>

      {/* Order Cards */}
      <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-matcha-700/30">
        {actionable.map(({ order, timing, urgency }) => {
          const next = NEXT_STATUS[order.status];
          const isThis = actionPendingId === order.id;
          const bgCls =
            urgency === 'critical' ? 'bg-red-950/60' :
            urgency === 'urgent' ? 'bg-orange-950/50' :
            'bg-matcha-900/60';
          const borderCls =
            urgency === 'critical' ? 'border-l-4 border-l-red-500' :
            urgency === 'urgent' ? 'border-l-4 border-l-orange-400' :
            'border-l-4 border-l-matcha-500';

          return (
            <div
              key={order.id}
              className={cn('flex flex-col gap-3 px-4 py-3', bgCls, borderCls)}
            >
              {/* Order Info */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      'rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase',
                      urgency === 'critical' ? 'bg-red-500 text-white animate-pulse' :
                      urgency === 'urgent' ? 'bg-orange-500 text-white' :
                      'bg-matcha-600 text-matcha-100',
                    )}>
                      #{order.bestellnummer.slice(-4)}
                    </span>
                    {order.typ === 'lieferung' && (
                      <span className="text-[8px] text-matcha-400 font-bold uppercase">Lieferung</span>
                    )}
                  </div>
                  <div className="font-bold text-sm text-white mt-0.5 truncate max-w-[140px]">
                    {order.kunde_name}
                  </div>
                  <div className="text-[10px] text-matcha-400 mt-0.5">
                    {order.items.slice(0, 2).map(i => `${i.menge}× ${i.name}`).join(', ')}
                    {order.items.length > 2 && ` +${order.items.length - 2}`}
                  </div>
                </div>
                <CountdownClock order={order} timing={timing} />
              </div>

              {/* Status + Action */}
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-[9px] font-bold uppercase rounded px-1.5 py-0.5',
                  order.status === 'neu' ? 'bg-blue-500/20 text-blue-300' :
                  order.status === 'bestätigt' ? 'bg-amber-500/20 text-amber-300' :
                  'bg-matcha-500/20 text-matcha-300',
                )}>
                  {order.status === 'neu' ? 'Neu' : order.status === 'bestätigt' ? 'Bestätigt' : 'Kochend'}
                </span>
                {next && (
                  <button
                    onClick={() => doAction(order.id, order.status)}
                    disabled={!!actionPendingId || pending}
                    className={cn(
                      'ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-black transition',
                      urgency === 'critical'
                        ? 'bg-red-500 hover:bg-red-400 text-white'
                        : urgency === 'urgent'
                        ? 'bg-orange-500 hover:bg-orange-400 text-white'
                        : 'bg-matcha-600 hover:bg-matcha-500 text-white',
                      (!!actionPendingId || pending) && 'opacity-60 cursor-not-allowed',
                    )}
                  >
                    {isThis ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      ACTION_ICON[order.status]
                    )}
                    {ACTION_LABEL[order.status]}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, ChefHat, Clock, Flame, Zap } from 'lucide-react';

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
  status: string;
};

interface Props {
  orders: Order[];
  timings: KitchenTiming[];
}

const ACTIVE_STATUSES = ['bestätigt', 'in_zubereitung', 'fertig'];

function useTick(intervalMs = 1000) {
  const [, set] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => set(n => n + 1), intervalMs);
    return () => clearInterval(iv);
  }, [intervalMs]);
}

function secsUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
}

function fmtCountdown(secs: number): string {
  const abs = Math.abs(secs);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = secs < 0 ? '-' : '';
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}

type Urgency = 'done' | 'ok' | 'tight' | 'urgent' | 'overdue';

function getUrgency(secs: number | null, status: string): Urgency {
  if (status === 'fertig') return 'done';
  if (secs === null) return 'ok';
  if (secs < -120) return 'overdue';
  if (secs < 0)    return 'urgent';
  if (secs < 180)  return 'tight';
  return 'ok';
}

const URGENCY_STYLE: Record<Urgency, { card: string; text: string; badge: string; glow: boolean }> = {
  done:    { card: 'border-matcha-300 bg-matcha-50',   text: 'text-matcha-700',  badge: 'bg-matcha-100 text-matcha-700',  glow: false },
  ok:      { card: 'border-border bg-card',             text: 'text-foreground',  badge: 'bg-muted text-muted-foreground', glow: false },
  tight:   { card: 'border-amber-300 bg-amber-50',     text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700',    glow: false },
  urgent:  { card: 'border-orange-400 bg-orange-50',   text: 'text-orange-700',  badge: 'bg-orange-100 text-orange-700',  glow: true  },
  overdue: { card: 'border-red-400 bg-red-50',         text: 'text-red-700',     badge: 'bg-red-100 text-red-700',        glow: true  },
};

const STATUS_ICON: Record<string, React.ElementType> = {
  bestätigt:       CheckCircle2,
  in_zubereitung:  ChefHat,
  fertig:          CheckCircle2,
};

const STATUS_LABEL: Record<string, string> = {
  bestätigt:       'Bestätigt',
  in_zubereitung:  'In Zubereitung',
  fertig:          'Fertig',
};

export function KitchenSmartTimingHub({ orders, timings }: Props) {
  useTick();

  const active = useMemo(() =>
    orders.filter(o => ACTIVE_STATUSES.includes(o.status)),
    [orders]
  );

  const enriched = useMemo(() => active.map(o => {
    const timing = timings.find(t => t.order_id === o.id) ?? null;
    const targetSecs = secsUntil(timing?.ready_target ?? null);
    const urgency = getUrgency(targetSecs, o.status);
    return { order: o, timing, targetSecs, urgency };
  }).sort((a, b) => {
    const urgencyOrder: Urgency[] = ['overdue', 'urgent', 'tight', 'ok', 'done'];
    return urgencyOrder.indexOf(a.urgency) - urgencyOrder.indexOf(b.urgency);
  }), [active, timings]);

  const counts = useMemo(() => ({
    overdue: enriched.filter(e => e.urgency === 'overdue').length,
    urgent:  enriched.filter(e => e.urgency === 'urgent').length,
    tight:   enriched.filter(e => e.urgency === 'tight').length,
    done:    enriched.filter(e => e.urgency === 'done').length,
    total:   enriched.length,
  }), [enriched]);

  if (enriched.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-matcha-900/5">
        <Flame className="h-4 w-4 text-matcha-600" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Smart-Timing-Hub
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {counts.overdue > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700 animate-pulse">
              {counts.overdue} überfällig
            </span>
          )}
          {counts.urgent > 0 && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
              {counts.urgent} dringend
            </span>
          )}
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            {counts.total} aktiv
          </span>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-4 divide-x divide-border border-b border-border">
        {[
          { label: 'Fertig',     val: counts.done,    color: 'text-matcha-600' },
          { label: 'OK',         val: counts.total - counts.done - counts.tight - counts.urgent - counts.overdue, color: 'text-foreground' },
          { label: 'Knapp',      val: counts.tight,   color: 'text-amber-600'  },
          { label: 'Dringend',   val: counts.overdue + counts.urgent, color: 'text-red-600' },
        ].map(({ label, val, color }) => (
          <div key={label} className="flex flex-col items-center py-2 px-1">
            <span className={cn('font-mono text-lg font-black tabular-nums leading-none', color)}>{val}</span>
            <span className="text-[9px] text-muted-foreground mt-0.5">{label}</span>
          </div>
        ))}
      </div>

      {/* Order grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-3">
        {enriched.map(({ order, timing, targetSecs, urgency }) => {
          const s = URGENCY_STYLE[urgency];
          const Icon = STATUS_ICON[order.status] ?? ChefHat;
          const itemsList = order.items?.slice(0, 3).map(i => `${i.menge}× ${i.name}`).join(', ') ?? '';

          return (
            <div
              key={order.id}
              className={cn(
                'rounded-lg border p-3 flex flex-col gap-2 transition-all duration-300',
                s.card,
                s.glow && 'ring-1 ring-current ring-offset-0',
              )}
            >
              {/* Top row */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Icon className={cn('h-3.5 w-3.5 shrink-0', s.text)} />
                  <span className={cn('font-mono font-black text-xs truncate', s.text)}>
                    #{order.bestellnummer.slice(-4)}
                  </span>
                </div>
                <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold shrink-0', s.badge)}>
                  {STATUS_LABEL[order.status] ?? order.status}
                </span>
              </div>

              {/* Customer */}
              <div className="text-[11px] text-muted-foreground truncate">
                {order.kunde_name}
              </div>

              {/* Items */}
              {itemsList && (
                <div className="text-[10px] text-muted-foreground truncate opacity-80">
                  {itemsList}
                </div>
              )}

              {/* Countdown */}
              <div className="flex items-center justify-between mt-auto pt-1 border-t border-current/10">
                <div className="flex items-center gap-1">
                  <Clock className={cn('h-3 w-3', s.text)} />
                  <span className="text-[9px] text-muted-foreground">
                    {timing?.ready_target ? 'Ziel' : 'Wartezeit'}
                  </span>
                </div>
                {targetSecs !== null ? (
                  <span className={cn(
                    'font-mono font-black text-sm tabular-nums',
                    s.text,
                    urgency === 'overdue' && 'animate-pulse',
                  )}>
                    {fmtCountdown(targetSecs)}
                  </span>
                ) : (
                  <span className="font-mono text-xs text-muted-foreground">
                    {order.bestellt_am
                      ? `${Math.floor((Date.now() - new Date(order.bestellt_am).getTime()) / 60_000)} Min`
                      : '—'}
                  </span>
                )}
                {urgency === 'overdue' && (
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500 animate-pulse shrink-0" />
                )}
                {urgency === 'urgent' && (
                  <Zap className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

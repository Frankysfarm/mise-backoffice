'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, CheckCircle2, AlertTriangle, Flame, ChefHat, Zap, Timer, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  kunde_name: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
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

type UrgencyLevel = 'overdue' | 'critical' | 'warning' | 'ok' | 'idle';

function getUrgency(order: Order, timing?: KitchenTiming): { level: UrgencyLevel; secLeft: number | null; label: string } {
  if (!['neu', 'bestätigt', 'in_zubereitung'].includes(order.status)) {
    return { level: 'idle', secLeft: null, label: '—' };
  }

  const now = Date.now();

  if (timing?.ready_target) {
    const target = new Date(timing.ready_target).getTime();
    const secLeft = Math.round((target - now) / 1000);
    if (secLeft <= 0) return { level: 'overdue', secLeft, label: `${Math.abs(Math.round(secLeft / 60))}m überfällig` };
    if (secLeft < 120) return { level: 'critical', secLeft, label: `${Math.round(secLeft / 60)}m ${secLeft % 60}s` };
    if (secLeft < 300) return { level: 'warning', secLeft, label: `${Math.round(secLeft / 60)}m` };
    return { level: 'ok', secLeft, label: `${Math.round(secLeft / 60)}m` };
  }

  if (order.bestellt_am && order.geschaetzte_zubereitung_min) {
    const start = new Date(order.bestellt_am).getTime();
    const target = start + order.geschaetzte_zubereitung_min * 60_000;
    const secLeft = Math.round((target - now) / 1000);
    if (secLeft <= 0) return { level: 'overdue', secLeft, label: `${Math.abs(Math.round(secLeft / 60))}m überfällig` };
    if (secLeft < 120) return { level: 'critical', secLeft, label: `${Math.round(secLeft / 60)}m ${secLeft % 60}s` };
    if (secLeft < 300) return { level: 'warning', secLeft, label: `${Math.round(secLeft / 60)}m` };
    return { level: 'ok', secLeft, label: `${Math.round(secLeft / 60)}m` };
  }

  return { level: 'idle', secLeft: null, label: '?' };
}

const URGENCY_STYLE: Record<UrgencyLevel, { card: string; badge: string; dot: string; icon: React.ElementType }> = {
  overdue:  { card: 'border-red-300 bg-red-50',    badge: 'bg-red-600 text-white',       dot: 'bg-red-500 animate-pulse', icon: AlertTriangle },
  critical: { card: 'border-orange-300 bg-orange-50', badge: 'bg-orange-500 text-white',  dot: 'bg-orange-400 animate-pulse', icon: Flame },
  warning:  { card: 'border-amber-200 bg-amber-50', badge: 'bg-amber-400 text-white',    dot: 'bg-amber-400', icon: Clock },
  ok:       { card: 'border-matcha-200 bg-matcha-50', badge: 'bg-matcha-500 text-white', dot: 'bg-matcha-500', icon: ChefHat },
  idle:     { card: 'border-border bg-muted/20',    badge: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground', icon: Timer },
};

function CountdownRing({ secLeft, level }: { secLeft: number | null; level: UrgencyLevel }) {
  const maxSec = 1200; // 20 min
  const pct = secLeft !== null ? Math.max(0, Math.min(100, (secLeft / maxSec) * 100)) : 0;
  const r = 20;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const colors: Record<UrgencyLevel, string> = {
    overdue: '#ef4444', critical: '#f97316', warning: '#f59e0b', ok: '#3d7a4f', idle: '#94a3b8',
  };
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" className="shrink-0">
      <circle cx="26" cy="26" r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-border" />
      <circle
        cx="26" cy="26" r={r} fill="none"
        stroke={colors[level]} strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={circ / 4}
        transform="rotate(-90 26 26)"
        style={{ transition: 'stroke-dasharray 0.5s ease' }}
      />
    </svg>
  );
}

export function KitchenPhase691SmartTimingCockpit({
  orders,
  timings,
}: {
  orders: Order[];
  timings: KitchenTiming[];
}) {
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const timingMap = new Map(timings.map(t => [t.order_id, t]));

  const active = orders
    .filter(o => ['neu', 'bestätigt', 'in_zubereitung'].includes(o.status))
    .map(o => ({ order: o, timing: timingMap.get(o.id), ...getUrgency(o, timingMap.get(o.id)) }))
    .sort((a, b) => {
      const order: UrgencyLevel[] = ['overdue', 'critical', 'warning', 'ok', 'idle'];
      const diff = order.indexOf(a.level) - order.indexOf(b.level);
      if (diff !== 0) return diff;
      if (a.secLeft !== null && b.secLeft !== null) return a.secLeft - b.secLeft;
      return 0;
    });

  if (active.length === 0) return null;

  const overdueCount  = active.filter(a => a.level === 'overdue').length;
  const criticalCount = active.filter(a => a.level === 'critical').length;
  const onTimeCount   = active.filter(a => a.level === 'ok').length;
  const score = active.length > 0 ? Math.round((onTimeCount / active.length) * 100) : 100;

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <Zap className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1">
          Phase 691 · Smart-Timing-Cockpit
        </span>
        {/* Summary badges */}
        <div className="flex items-center gap-1.5 shrink-0">
          {overdueCount > 0 && (
            <span className="rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-black text-white">
              {overdueCount} überfällig
            </span>
          )}
          {criticalCount > 0 && (
            <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[9px] font-black text-white">
              {criticalCount} kritisch
            </span>
          )}
          <span className={cn(
            'rounded-full px-2 py-0.5 text-[9px] font-black',
            score >= 80 ? 'bg-matcha-500 text-white' : score >= 50 ? 'bg-amber-400 text-white' : 'bg-red-500 text-white',
          )}>
            {score}% pünktlich
          </span>
        </div>
        <TrendingUp className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-1" />
      </button>

      {open && (
        <div className="border-t divide-y">
          {active.map(({ order, timing, level, secLeft, label }) => {
            const style = URGENCY_STYLE[level];
            const Icon = style.icon;
            const cookingMin = timing?.cook_start_at
              ? Math.round((Date.now() - new Date(timing.cook_start_at).getTime()) / 60_000)
              : null;
            return (
              <div key={order.id} className={cn('flex items-center gap-3 px-4 py-2.5 transition-colors', style.card)}>
                {/* Dot + ring */}
                <div className="relative shrink-0">
                  <CountdownRing secLeft={secLeft} level={level} />
                  <div className={cn('absolute inset-0 flex items-center justify-center')}>
                    <Icon className={cn(
                      'h-4 w-4',
                      level === 'overdue' ? 'text-red-600' :
                      level === 'critical' ? 'text-orange-500' :
                      level === 'warning' ? 'text-amber-600' :
                      level === 'ok' ? 'text-matcha-600' : 'text-muted-foreground',
                    )} />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold tabular-nums">#{order.bestellnummer}</span>
                    <span className="text-[11px] text-muted-foreground truncate">{order.kunde_name}</span>
                    {order.status === 'in_zubereitung' && cookingMin !== null && (
                      <span className="text-[10px] text-muted-foreground">· kocht {cookingMin} Min</span>
                    )}
                  </div>
                  {order.items.length > 0 && (
                    <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                      {order.items.slice(0, 3).map((it, i) => (
                        <span key={i}>{i > 0 ? ', ' : ''}{it.menge}× {it.name}</span>
                      ))}
                      {order.items.length > 3 && <span> +{order.items.length - 3}</span>}
                    </div>
                  )}
                </div>

                {/* Status + Countdown */}
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <Badge className={cn('text-[9px] font-black px-2 py-0.5', style.badge)}>
                    {label}
                  </Badge>
                  <span className={cn(
                    'text-[9px] font-semibold capitalize',
                    order.status === 'in_zubereitung' ? 'text-matcha-600' : 'text-muted-foreground',
                  )}>
                    {order.status === 'in_zubereitung' ? 'Kocht' : order.status === 'bestätigt' ? 'Bestätigt' : 'Neu'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer summary */}
      {open && (
        <div className="border-t px-4 py-2 bg-muted/20 flex items-center gap-4 flex-wrap">
          {[
            { label: 'Gesamt', val: active.length, col: 'text-foreground' },
            { label: 'Überfällig', val: overdueCount, col: 'text-red-600' },
            { label: 'Kritisch', val: criticalCount, col: 'text-orange-500' },
            { label: 'Pünktlich', val: onTimeCount, col: 'text-matcha-600' },
          ].map(({ label, val, col }) => (
            <div key={label} className="flex items-center gap-1">
              <span className={cn('text-sm font-black tabular-nums', col)}>{val}</span>
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

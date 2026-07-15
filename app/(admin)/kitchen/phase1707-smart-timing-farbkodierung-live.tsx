'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Clock, Zap, CheckCircle2, AlertTriangle } from 'lucide-react';

interface Order {
  id: string;
  bestellnummer?: string | null;
  status?: string | null;
  estimated_prep_min?: number | null;
  angenommen_am?: string | null;
  zubereitung_start?: string | null;
}

interface Props {
  orders: Order[];
  locationId: string | null;
}

type TimingState = 'ok' | 'warn' | 'critical' | 'done';

function getTimingState(elapsedMin: number, targetMin: number): TimingState {
  if (elapsedMin < 0) return 'ok';
  const ratio = elapsedMin / Math.max(targetMin, 1);
  if (ratio >= 1.2) return 'critical';
  if (ratio >= 0.85) return 'warn';
  return 'ok';
}

const STATE_CONFIG: Record<TimingState, { bg: string; border: string; text: string; badge: string; label: string }> = {
  ok: {
    bg: 'bg-matcha-50',
    border: 'border-matcha-200',
    text: 'text-matcha-700',
    badge: 'bg-matcha-100 text-matcha-800',
    label: 'Im Zeitplan',
  },
  warn: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-800',
    label: 'Zeitkritisch',
  },
  critical: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    badge: 'bg-red-100 text-red-800',
    label: 'Überfällig',
  },
  done: {
    bg: 'bg-stone-50',
    border: 'border-stone-200',
    text: 'text-stone-500',
    badge: 'bg-stone-100 text-stone-600',
    label: 'Fertig',
  },
};

function CountdownRing({ elapsedMin, targetMin, state }: { elapsedMin: number; targetMin: number; state: TimingState }) {
  const pct = Math.min(1, elapsedMin / Math.max(targetMin, 1));
  const r = 16;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - pct);

  const strokeColor =
    state === 'critical' ? '#ef4444' : state === 'warn' ? '#f59e0b' : '#4ade80';

  return (
    <svg width={40} height={40} className="shrink-0 -rotate-90">
      <circle cx={20} cy={20} r={r} fill="none" stroke="#e5e7eb" strokeWidth={4} />
      <circle
        cx={20}
        cy={20}
        r={r}
        fill="none"
        stroke={strokeColor}
        strokeWidth={4}
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1s linear' }}
      />
    </svg>
  );
}

export function KitchenPhase1707SmartTimingFarbkodierungLive({ orders }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  const activeOrders = useMemo(() => {
    const active = orders.filter((o) =>
      ['neu', 'angenommen', 'in_zubereitung', 'bereit'].includes(o.status ?? ''),
    );
    return active.map((o) => {
      const isDone = o.status === 'bereit';
      const startMs = o.zubereitung_start
        ? new Date(o.zubereitung_start).getTime()
        : o.angenommen_am
        ? new Date(o.angenommen_am).getTime()
        : null;
      const elapsedMin = startMs ? (now - startMs) / 60_000 : 0;
      const targetMin = o.estimated_prep_min ?? 15;
      const remainMin = Math.max(0, targetMin - elapsedMin);
      const state: TimingState = isDone ? 'done' : getTimingState(elapsedMin, targetMin);
      return { ...o, elapsedMin, remainMin, targetMin, state };
    }).sort((a, b) => {
      const p: Record<TimingState, number> = { critical: 0, warn: 1, ok: 2, done: 3 };
      return p[a.state] - p[b.state];
    });
  }, [orders, now]);

  const counts = useMemo(() => {
    return {
      critical: activeOrders.filter((o) => o.state === 'critical').length,
      warn: activeOrders.filter((o) => o.state === 'warn').length,
      ok: activeOrders.filter((o) => o.state === 'ok').length,
      done: activeOrders.filter((o) => o.state === 'done').length,
    };
  }, [activeOrders]);

  if (activeOrders.length === 0) return null;

  return (
    <Card className="overflow-hidden border">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Smart-Timing Farbkodierung
          </span>
          <div className="flex gap-1">
            {counts.critical > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700">
                {counts.critical} Überfällig
              </span>
            )}
            {counts.warn > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                {counts.warn} Kritisch
              </span>
            )}
          </div>
        </div>
        <Zap className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="border-t divide-y">
          {activeOrders.slice(0, 8).map((order) => {
            const cfg = STATE_CONFIG[order.state];
            return (
              <div
                key={order.id}
                className={cn('flex items-center gap-3 px-4 py-2.5 transition-colors', cfg.bg)}
              >
                <CountdownRing
                  elapsedMin={order.elapsedMin}
                  targetMin={order.targetMin}
                  state={order.state}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold">
                      #{order.bestellnummer ?? order.id.slice(-4)}
                    </span>
                    <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-bold', cfg.badge)}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="mt-0.5 h-1.5 rounded-full bg-black/10 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        order.state === 'critical'
                          ? 'bg-red-500'
                          : order.state === 'warn'
                          ? 'bg-amber-400'
                          : order.state === 'done'
                          ? 'bg-stone-300'
                          : 'bg-matcha-500',
                      )}
                      style={{
                        width: `${Math.min(100, (order.elapsedMin / order.targetMin) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                <div className={cn('shrink-0 text-right', cfg.text)}>
                  {order.state === 'done' ? (
                    <CheckCircle2 className="h-4 w-4 text-stone-400" />
                  ) : order.state === 'critical' ? (
                    <div>
                      <AlertTriangle className="h-4 w-4 text-red-500 mx-auto" />
                      <div className="text-[9px] font-bold text-red-600 tabular-nums">
                        +{Math.round(order.elapsedMin - order.targetMin)}m
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="font-mono text-sm font-black tabular-nums">
                        {Math.ceil(order.remainMin)}
                      </div>
                      <div className="text-[9px] text-muted-foreground">Min</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

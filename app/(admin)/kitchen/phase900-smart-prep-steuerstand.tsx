'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, ChefHat, Clock, Flame, TrendingUp, Zap, CheckCircle2, Bike,
} from 'lucide-react';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  typ: string;
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

function secsLeft(order: Order, timing: KitchenTiming | undefined): number {
  const now = Date.now();
  if (timing?.ready_target) return (new Date(timing.ready_target).getTime() - now) / 1000;
  const elapsed = order.bestellt_am ? (now - new Date(order.bestellt_am).getTime()) / 1000 : 0;
  return (order.geschaetzte_zubereitung_min ?? 15) * 60 - elapsed;
}

type ColorBucket = 'ok' | 'warn' | 'urgent' | 'overdue';
function colorBucket(secs: number): ColorBucket {
  if (secs <= 0) return 'overdue';
  if (secs <= 120) return 'urgent';
  if (secs <= 300) return 'warn';
  return 'ok';
}

const COLOR: Record<ColorBucket, { bg: string; border: string; text: string; ring: string; label: string }> = {
  ok:      { bg: 'bg-matcha-50',  border: 'border-matcha-300', text: 'text-matcha-700',  ring: '#22c55e', label: 'OK'        },
  warn:    { bg: 'bg-amber-50',   border: 'border-amber-300',  text: 'text-amber-700',   ring: '#f59e0b', label: 'Bald'      },
  urgent:  { bg: 'bg-orange-50',  border: 'border-orange-400', text: 'text-orange-700',  ring: '#f97316', label: 'Dringend'  },
  overdue: { bg: 'bg-red-50',     border: 'border-red-500',    text: 'text-red-700',     ring: '#ef4444', label: 'Überfällig'},
};

function MiniCountdownRing({ secsLeft, totalSecs }: { secsLeft: number; totalSecs: number }) {
  const size = 48;
  const r = size / 2 - 5;
  const circ = 2 * Math.PI * r;
  const pct = totalSecs > 0 ? Math.max(0, Math.min(1, secsLeft / totalSecs)) : 0;
  const bucket = colorBucket(secsLeft);
  const color = COLOR[bucket].ring;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={4} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={4} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={circ - pct * circ}
        style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.4s' }}
      />
    </svg>
  );
}

function OrderTile({ order, timing }: { order: Order; timing?: KitchenTiming }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const secs = secsLeft(order, timing);
  const totalSecs = timing?.prep_min != null ? timing.prep_min * 60 : (order.geschaetzte_zubereitung_min ?? 15) * 60;
  const bucket = colorBucket(secs);
  const c = COLOR[bucket];
  const isOver = secs <= 0;
  const minsAbs = Math.abs(Math.floor(secs / 60));
  const secsAbs = Math.abs(Math.round(secs % 60));
  const timeStr = `${isOver ? '+' : ''}${minsAbs}:${String(secsAbs).padStart(2, '0')}`;

  return (
    <div className={cn(
      'relative rounded-xl border-2 p-2.5 flex gap-2 items-center',
      c.bg, c.border,
      isOver && 'animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.3)]',
    )}>
      <div className="relative shrink-0">
        <MiniCountdownRing secsLeft={secs} totalSecs={totalSecs} />
        <div className="absolute inset-0 flex items-center justify-center">
          {isOver
            ? <AlertTriangle className="h-3 w-3 text-red-600" />
            : <Clock className="h-2.5 w-2.5 text-muted-foreground" />}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className={cn('font-mono text-sm font-black tabular-nums leading-none', c.text)}>
          {timeStr}
        </div>
        <div className="text-[9px] font-bold text-muted-foreground truncate mt-0.5">
          {order.bestellnummer} · {order.kunde_name}
        </div>
        <div className="text-[8px] text-muted-foreground truncate">
          {order.items.slice(0, 2).map(i => `${i.menge}× ${i.name}`).join(', ')}
          {order.items.length > 2 ? ` +${order.items.length - 2}` : ''}
        </div>
      </div>
      <div className={cn(
        'shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-black',
        bucket === 'ok'      ? 'bg-matcha-100 text-matcha-700' :
        bucket === 'warn'    ? 'bg-amber-100 text-amber-700' :
        bucket === 'urgent'  ? 'bg-orange-100 text-orange-700' :
                               'bg-red-100 text-red-700',
      )}>
        {c.label}
      </div>
    </div>
  );
}

export function KitchenPhase900SmartPrepSteuerstand({
  orders,
  timings,
}: {
  orders: Order[];
  timings: KitchenTiming[];
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const timingMap = new Map(timings.map(t => [t.order_id, t]));
  const active = orders.filter(o => ['neu', 'bestätigt', 'in_zubereitung'].includes(o.status));
  if (active.length === 0) return null;

  const cooking = active.filter(o => o.status === 'in_zubereitung');
  const waiting = active.filter(o => o.status !== 'in_zubereitung');

  const buckets = { ok: 0, warn: 0, urgent: 0, overdue: 0 };
  for (const o of cooking) {
    const b = colorBucket(secsLeft(o, timingMap.get(o.id)));
    buckets[b]++;
  }

  // Kitchen pressure: 0–100
  const pressure = cooking.length === 0 ? 0
    : Math.round((buckets.overdue * 100 + buckets.urgent * 60 + buckets.warn * 25) / cooking.length);
  const pressureColor = pressure >= 70 ? 'text-red-600' : pressure >= 40 ? 'text-orange-600' : 'text-matcha-600';
  const pressureLabel = pressure >= 70 ? 'Hoch' : pressure >= 40 ? 'Mittel' : 'Niedrig';

  // Sort: overdue first, then most urgent
  const sorted = [...cooking].sort((a, b) =>
    secsLeft(a, timingMap.get(a.id)) - secsLeft(b, timingMap.get(b.id))
  );

  // Show at most 6 tiles (most urgent)
  const displayOrders = sorted.slice(0, 6);

  return (
    <div className="rounded-xl border bg-card p-3 space-y-3">
      {/* Header row */}
      <div className="flex items-center gap-2 flex-wrap">
        <ChefHat className="h-4 w-4 text-orange-500 shrink-0" />
        <span className="text-sm font-bold">Prep-Steuerstand</span>
        <span className="rounded-full bg-orange-100 text-orange-700 px-2 py-0.5 text-[10px] font-black">
          {cooking.length} kochen
        </span>
        {waiting.length > 0 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            {waiting.length} wartend
          </span>
        )}
        {buckets.overdue > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-black animate-pulse">
            <AlertTriangle className="h-2.5 w-2.5" /> {buckets.overdue} überfällig
          </span>
        )}
      </div>

      {/* Pressure + color legend bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between text-[9px]">
            <span className="font-bold uppercase tracking-wide text-muted-foreground">Küchen-Druck</span>
            <span className={cn('font-black', pressureColor)}>{pressureLabel} · {pressure}%</span>
          </div>
          <div className="relative h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700',
                pressure >= 70 ? 'bg-red-500' : pressure >= 40 ? 'bg-orange-400' : 'bg-matcha-500',
              )}
              style={{ width: `${pressure}%` }}
            />
          </div>
        </div>
        {/* Status mini-dots */}
        <div className="flex items-center gap-0.5 shrink-0">
          {(['ok', 'warn', 'urgent', 'overdue'] as ColorBucket[]).map(b =>
            Array.from({ length: buckets[b] }).map((_, i) => (
              <span
                key={`${b}-${i}`}
                style={{ backgroundColor: COLOR[b].ring }}
                className="h-2.5 w-2.5 rounded-full inline-block"
                title={COLOR[b].label}
              />
            ))
          )}
        </div>
      </div>

      {/* Cooking order tiles */}
      {displayOrders.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {displayOrders.map(o => (
            <OrderTile key={o.id} order={o} timing={timingMap.get(o.id)} />
          ))}
        </div>
      )}
      {sorted.length > 6 && (
        <div className="text-center text-[10px] text-muted-foreground font-semibold">
          +{sorted.length - 6} weitere in Zubereitung
        </div>
      )}

      {/* Waiting orders summary */}
      {waiting.length > 0 && (
        <div className="rounded-lg border border-dashed border-muted-foreground/30 p-2 flex items-center gap-2 flex-wrap">
          <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-[10px] font-bold text-muted-foreground">In Warteschlange:</span>
          {waiting.slice(0, 5).map(o => (
            <span key={o.id} className="text-[10px] bg-muted rounded-full px-2 py-0.5 font-semibold">
              {o.bestellnummer}
            </span>
          ))}
          {waiting.length > 5 && (
            <span className="text-[10px] text-muted-foreground">+{waiting.length - 5}</span>
          )}
        </div>
      )}

      {/* Throughput estimate */}
      {cooking.length > 0 && (() => {
        const maxSecs = Math.max(...sorted.map(o => Math.max(0, secsLeft(o, timingMap.get(o.id)))));
        const clearMin = Math.ceil(maxSecs / 60);
        return (
          <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
            <TrendingUp className="h-3 w-3 shrink-0" />
            <span>
              Alle {cooking.length} Bestellungen fertig in ~
              <span className="font-black text-foreground"> {clearMin} Min</span>
            </span>
            {buckets.ok > 0 && (
              <span className="flex items-center gap-0.5 ml-auto">
                <CheckCircle2 className="h-2.5 w-2.5 text-matcha-500" />
                {buckets.ok} im Zeitplan
              </span>
            )}
          </div>
        );
      })()}
    </div>
  );
}

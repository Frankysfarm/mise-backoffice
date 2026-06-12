'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, ChefHat, CheckCircle2, AlertTriangle } from 'lucide-react';

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

function useCountdownTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
}

function CountdownRing({
  secsLeft,
  totalSecs,
  size = 64,
}: {
  secsLeft: number;
  totalSecs: number;
  size?: number;
}) {
  const r = size / 2 - 6;
  const circ = 2 * Math.PI * r;
  const pct = totalSecs > 0 ? Math.max(0, Math.min(1, secsLeft / totalSecs)) : 0;
  const dash = pct * circ;
  const isOverdue = secsLeft <= 0;
  const isUrgent = secsLeft > 0 && secsLeft <= 120;
  const isWarn = secsLeft > 120 && secsLeft <= 300;

  const color = isOverdue
    ? '#ef4444'
    : isUrgent
    ? '#f97316'
    : isWarn
    ? '#f59e0b'
    : '#22c55e';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={5} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ - dash}
        style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
      />
    </svg>
  );
}

function CountdownCard({ order, timing }: { order: Order; timing: KitchenTiming | undefined }) {
  useCountdownTick();

  const now = Date.now();
  const readyTargetMs = timing?.ready_target ? new Date(timing.ready_target).getTime() : null;
  const cookStartMs = timing?.cook_start_at ? new Date(timing.cook_start_at).getTime() : null;
  const totalSecs = timing?.prep_min != null ? timing.prep_min * 60 : (order.geschaetzte_zubereitung_min ?? 15) * 60;

  let secsLeft: number;
  let elapsedSecs: number;

  if (readyTargetMs) {
    secsLeft = Math.floor((readyTargetMs - now) / 1000);
    elapsedSecs = cookStartMs ? Math.floor((now - cookStartMs) / 1000) : 0;
  } else if (order.bestellt_am) {
    const orderMs = new Date(order.bestellt_am).getTime();
    elapsedSecs = Math.floor((now - orderMs) / 1000);
    secsLeft = totalSecs - elapsedSecs;
  } else {
    secsLeft = totalSecs;
    elapsedSecs = 0;
  }

  const isOverdue = secsLeft <= 0;
  const isUrgent = secsLeft > 0 && secsLeft <= 120;
  const isWarn = secsLeft > 120 && secsLeft <= 300;

  const minsLeft = isOverdue ? Math.abs(Math.ceil(secsLeft / 60)) : Math.floor(secsLeft / 60);
  const secs = Math.abs(secsLeft % 60);
  const countdownStr = isOverdue
    ? `+${minsLeft}:${String(secs).padStart(2, '0')}`
    : `${minsLeft}:${String(secs).padStart(2, '0')}`;

  const topItems = order.items.slice(0, 3);

  return (
    <div
      className={cn(
        'relative rounded-2xl border-2 p-3 flex flex-col gap-2 transition-all duration-300',
        isOverdue
          ? 'border-red-500 bg-red-50 shadow-[0_0_16px_rgba(239,68,68,0.25)] animate-pulse'
          : isUrgent
          ? 'border-orange-400 bg-orange-50 shadow-[0_0_12px_rgba(249,115,22,0.2)]'
          : isWarn
          ? 'border-amber-300 bg-amber-50'
          : 'border-matcha-300 bg-matcha-50',
      )}
    >
      {/* Countdown ring + time */}
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <CountdownRing secsLeft={secsLeft} totalSecs={totalSecs} size={56} />
          <div className="absolute inset-0 flex items-center justify-center">
            {isOverdue ? (
              <AlertTriangle className="h-4 w-4 text-red-600" />
            ) : (
              <Clock className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className={cn(
            'font-mono text-2xl font-black tabular-nums leading-none',
            isOverdue ? 'text-red-600' : isUrgent ? 'text-orange-600' : isWarn ? 'text-amber-700' : 'text-matcha-700',
          )}>
            {countdownStr}
          </div>
          <div className="text-[10px] font-bold text-muted-foreground mt-0.5 uppercase tracking-wide">
            {isOverdue ? 'Überfällig!' : isUrgent ? 'Fast fertig!' : isWarn ? 'Bald fertig' : 'In Zubereitung'}
          </div>
        </div>
      </div>

      {/* Order info */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-black truncate">{order.bestellnummer}</div>
          <div className="text-[10px] text-muted-foreground truncate">{order.kunde_name}</div>
        </div>
        <span className={cn(
          'shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold',
          isOverdue ? 'bg-red-100 text-red-700' : isUrgent ? 'bg-orange-100 text-orange-700' : 'bg-matcha-100 text-matcha-700',
        )}>
          {order.items.length} Pos.
        </span>
      </div>

      {/* Items preview */}
      <div className="space-y-0.5">
        {topItems.map((it, i) => (
          <div key={i} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-matcha-200 text-matcha-700 flex items-center justify-center text-[8px] font-black">
              {it.menge}
            </span>
            <span className="truncate">{it.name}</span>
          </div>
        ))}
        {order.items.length > 3 && (
          <div className="text-[10px] text-muted-foreground">+{order.items.length - 3} weitere…</div>
        )}
      </div>
    </div>
  );
}

export function KitchenSmartCountdownGrid({
  orders,
  timings,
}: {
  orders: Order[];
  timings: KitchenTiming[];
}) {
  const cooking = orders.filter((o) => o.status === 'in_zubereitung');
  if (cooking.length === 0) return null;

  const timingMap = new Map(timings.map((t) => [t.order_id, t]));

  // Sort: overdue first, then by secs remaining ascending
  const sorted = [...cooking].sort((a, b) => {
    const ta = timingMap.get(a.id);
    const tb = timingMap.get(b.id);
    const now = Date.now();
    const getSecsLeft = (o: Order, t: KitchenTiming | undefined) => {
      if (t?.ready_target) return (new Date(t.ready_target).getTime() - now) / 1000;
      const elapsed = o.bestellt_am ? (now - new Date(o.bestellt_am).getTime()) / 1000 : 0;
      return (o.geschaetzte_zubereitung_min ?? 15) * 60 - elapsed;
    };
    return getSecsLeft(a, ta) - getSecsLeft(b, tb);
  });

  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-center gap-2 mb-3">
        <ChefHat className="h-4 w-4 text-orange-500" />
        <span className="text-sm font-bold">Smart-Countdown</span>
        <span className="rounded-full bg-orange-100 text-orange-700 px-2 py-0.5 text-[10px] font-black">
          {cooking.length} kochen
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground">Farbe = Dringlichkeit</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {sorted.map((o) => (
          <CountdownCard key={o.id} order={o} timing={timingMap.get(o.id)} />
        ))}
      </div>
      {/* Legend */}
      <div className="mt-2 flex items-center gap-3 text-[9px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500 inline-block" />{'>'}&gt;5 Min</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />2–5 Min</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-500 inline-block" />&lt;2 Min</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 inline-block" />Überfällig</span>
      </div>
    </div>
  );
}

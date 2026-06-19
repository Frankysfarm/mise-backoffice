'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, Flame, CheckCircle2, AlertTriangle, Bike, Timer } from 'lucide-react';

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

type DriverETA = {
  order_id: string;
  driver_name: string;
  eta_sec: number;
};

function useTick() {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
}

function fmtCountdown(sec: number): string {
  const absSec = Math.abs(sec);
  const m = Math.floor(absSec / 60);
  const s = absSec % 60;
  const prefix = sec < 0 ? '-' : '';
  return `${prefix}${m}:${String(s).padStart(2, '0')}`;
}

type UrgencyLevel = 'ok' | 'watch' | 'urgent' | 'overdue';

function getUrgency(pctUsed: number): UrgencyLevel {
  if (pctUsed >= 100) return 'overdue';
  if (pctUsed >= 85) return 'urgent';
  if (pctUsed >= 60) return 'watch';
  return 'ok';
}

const URGENCY_COLORS: Record<UrgencyLevel, { ring: string; bg: string; text: string; label: string }> = {
  ok:      { ring: 'stroke-emerald-500',  bg: 'bg-emerald-50 border-emerald-200',  text: 'text-emerald-700',  label: 'Im Plan' },
  watch:   { ring: 'stroke-amber-400',    bg: 'bg-amber-50 border-amber-200',      text: 'text-amber-700',    label: 'Aufgepasst' },
  urgent:  { ring: 'stroke-orange-500',   bg: 'bg-orange-50 border-orange-200',    text: 'text-orange-700',   label: 'Eilt' },
  overdue: { ring: 'stroke-red-500',      bg: 'bg-red-50 border-red-300',          text: 'text-red-700',      label: 'Überfällig' },
};

function CountdownRing({
  secsLeft, totalSecs, size = 56,
}: { secsLeft: number; totalSecs: number; size?: number }) {
  const pct = totalSecs > 0 ? Math.max(0, Math.min(1, secsLeft / totalSecs)) : 0;
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  const urgency = getUrgency(((totalSecs - secsLeft) / totalSecs) * 100);
  const col = URGENCY_COLORS[urgency];
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={6} className="stroke-gray-100" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        className={cn(col.ring, secsLeft < 0 && 'animate-pulse')}
      />
    </svg>
  );
}

function OrderCountdownCard({ order, timing, driverEta }: {
  order: Order;
  timing: KitchenTiming | null;
  driverEta: DriverETA | null;
}) {
  useTick();
  const now = Date.now();

  let secsLeft = 0;
  let totalSecs = 0;
  let hasTimer = false;

  if (timing?.ready_target && timing?.cook_start_at) {
    const start = new Date(timing.cook_start_at).getTime();
    const end = new Date(timing.ready_target).getTime();
    totalSecs = Math.round((end - start) / 1000);
    secsLeft = Math.round((end - now) / 1000);
    hasTimer = true;
  } else if (order.bestellt_am && order.geschaetzte_zubereitung_min) {
    const start = new Date(order.bestellt_am).getTime();
    totalSecs = order.geschaetzte_zubereitung_min * 60;
    secsLeft = Math.round((start + totalSecs * 1000 - now) / 1000);
    hasTimer = true;
  }

  const pctUsed = hasTimer && totalSecs > 0 ? ((totalSecs - secsLeft) / totalSecs) * 100 : 0;
  const urgency = hasTimer ? getUrgency(pctUsed) : 'ok';
  const col = URGENCY_COLORS[urgency];
  const itemCount = order.items?.reduce((s, i) => s + i.menge, 0) ?? 0;
  const isDelivery = order.typ === 'lieferung';

  return (
    <div className={cn('relative rounded-xl border p-2.5 flex items-start gap-2.5', col.bg)}>
      {/* Urgency indicator bar */}
      <div className={cn(
        'absolute left-0 top-0 bottom-0 w-1 rounded-l-xl',
        urgency === 'ok' ? 'bg-emerald-400' :
        urgency === 'watch' ? 'bg-amber-400' :
        urgency === 'urgent' ? 'bg-orange-500' :
        'bg-red-500 animate-pulse',
      )} />

      {/* Countdown ring */}
      {hasTimer ? (
        <div className="relative shrink-0 ml-0.5">
          <CountdownRing secsLeft={secsLeft} totalSecs={totalSecs} size={52} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn('text-[9px] font-black tabular-nums', col.text)}>
              {secsLeft < 0 ? '+' : ''}{fmtCountdown(secsLeft)}
            </span>
          </div>
        </div>
      ) : (
        <div className="w-[52px] h-[52px] shrink-0 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center ml-0.5">
          <Timer size={18} className="text-gray-400" />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[10px] font-black text-gray-500 font-mono">#{order.bestellnummer}</span>
          <span className={cn(
            'text-[8px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full',
            urgency === 'ok' ? 'bg-emerald-200 text-emerald-800' :
            urgency === 'watch' ? 'bg-amber-200 text-amber-800' :
            urgency === 'urgent' ? 'bg-orange-200 text-orange-800' :
            'bg-red-200 text-red-800',
          )}>
            {col.label}
          </span>
        </div>
        <div className="text-xs font-bold text-gray-900 truncate mt-0.5">{order.kunde_name}</div>
        <div className="text-[10px] text-gray-500 mt-0.5">
          {itemCount} Pos
          {isDelivery && (
            <span className="ml-1.5 inline-flex items-center gap-0.5">
              <Bike size={9} className="inline" /> Lieferung
            </span>
          )}
        </div>
        {/* Driver ETA chip */}
        {driverEta && (
          <div className={cn(
            'mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold',
            driverEta.eta_sec < 120 ? 'bg-red-100 text-red-700 animate-pulse' :
            driverEta.eta_sec < 300 ? 'bg-amber-100 text-amber-700' :
            'bg-blue-100 text-blue-700',
          )}>
            <Bike size={8} className="shrink-0" />
            {driverEta.driver_name} in {Math.ceil(driverEta.eta_sec / 60)}m
          </div>
        )}
        {/* Timing source indicator */}
        {timing?.status === 'cooking' && (
          <div className="mt-0.5 inline-flex items-center gap-0.5 text-[9px] text-blue-600 font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse inline-block" />
            Smart-Timer aktiv
          </div>
        )}
      </div>
    </div>
  );
}

export function KitchenLiveOrderCountdownPanel({
  orders,
  timings,
  driverETAs = [],
}: {
  orders: Order[];
  timings: KitchenTiming[];
  driverETAs?: DriverETA[];
}) {
  useTick();

  const active = orders.filter((o) => ['bestätigt', 'in_zubereitung'].includes(o.status));
  if (active.length === 0) return null;

  // Sort: overdue first, then by urgency
  const withUrgency = active.map((o) => {
    const timing = timings.find((t) => t.order_id === o.id) ?? null;
    const now = Date.now();
    let pct = 0;
    if (timing?.ready_target && timing?.cook_start_at) {
      const start = new Date(timing.cook_start_at).getTime();
      const end = new Date(timing.ready_target).getTime();
      const total = end - start;
      pct = total > 0 ? ((now - start) / total) * 100 : 0;
    } else if (o.bestellt_am && o.geschaetzte_zubereitung_min) {
      const start = new Date(o.bestellt_am).getTime();
      const total = o.geschaetzte_zubereitung_min * 60_000;
      pct = total > 0 ? ((now - start) / total) * 100 : 0;
    }
    return { order: o, timing, pct };
  }).sort((a, b) => b.pct - a.pct);

  const overdue = withUrgency.filter((x) => x.pct >= 100).length;
  const urgent  = withUrgency.filter((x) => x.pct >= 85 && x.pct < 100).length;
  const watch   = withUrgency.filter((x) => x.pct >= 60 && x.pct < 85).length;
  const ok      = withUrgency.filter((x) => x.pct < 60).length;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <Flame size={14} className="text-orange-500" />
          <span className="text-[11px] font-black uppercase tracking-wider text-gray-500">Live Countdown</span>
        </div>
        <div className="flex items-center gap-2">
          {overdue > 0 && (
            <span className="inline-flex items-center gap-1 text-[9px] font-black bg-red-100 text-red-700 rounded-full px-2 py-0.5 animate-pulse">
              <AlertTriangle size={8} /> {overdue} überfällig
            </span>
          )}
          {urgent > 0 && (
            <span className="inline-flex items-center gap-1 text-[9px] font-black bg-orange-100 text-orange-700 rounded-full px-2 py-0.5">
              {urgent} eilt
            </span>
          )}
          {watch > 0 && (
            <span className="text-[9px] font-bold text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">
              {watch} aufgepasst
            </span>
          )}
          {ok > 0 && (
            <span className="text-[9px] font-bold text-emerald-600">
              <CheckCircle2 size={10} className="inline" /> {ok} im Plan
            </span>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="p-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
        {withUrgency.map(({ order, timing }) => {
          const driverEta = driverETAs.find((d) => d.order_id === order.id) ?? null;
          return (
            <OrderCountdownCard
              key={order.id}
              order={order}
              timing={timing}
              driverEta={driverEta}
            />
          );
        })}
      </div>

      {/* Footer summary bar */}
      <div className="flex items-center gap-1 px-3 pb-2">
        {[
          { count: overdue, cls: 'bg-red-500', label: 'Überfällig' },
          { count: urgent,  cls: 'bg-orange-500', label: 'Eilt' },
          { count: watch,   cls: 'bg-amber-400',  label: 'Aufgepasst' },
          { count: ok,      cls: 'bg-emerald-500', label: 'Im Plan' },
        ].map(({ count, cls, label }) => {
          if (count === 0) return null;
          const pct = Math.round((count / active.length) * 100);
          return (
            <div
              key={label}
              className={cn('h-1.5 rounded-full transition-all', cls)}
              style={{ flex: count }}
              title={`${label}: ${count} (${pct}%)`}
            />
          );
        })}
      </div>
    </div>
  );
}

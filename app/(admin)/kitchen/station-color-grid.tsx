'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, Flame, Coffee, Salad, Thermometer, Clock, AlertTriangle, CheckCircle2, Zap } from 'lucide-react';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
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

type Urgency = 'ok' | 'warn' | 'urgent' | 'overdue';

const GRILL_WORDS = ['burger', 'steak', 'grill', 'wrap', 'schnitzel', 'fleisch', 'chicken', 'hähnchen'];
const COLD_WORDS  = ['salat', 'sushi', 'bowl', 'raw', 'kalt', 'tartare', 'ceviche'];
const FRY_WORDS   = ['pommes', 'fries', 'frittes', 'nugget', 'crispy', 'tempura'];
const DRINK_WORDS = ['cola', 'wasser', 'saft', 'bier', 'wein', 'shake', 'smoothie', 'kaffee', 'tee', 'limo'];

type Station = 'grill' | 'kalt' | 'frittiert' | 'getraenke' | 'mixed';

function detectStation(items: { name: string }[]): Station {
  const names = items.map(i => i.name.toLowerCase()).join(' ');
  const s = { grill: 0, kalt: 0, frittiert: 0, getraenke: 0 };
  GRILL_WORDS.forEach(w => { if (names.includes(w)) s.grill++; });
  COLD_WORDS.forEach(w  => { if (names.includes(w)) s.kalt++; });
  FRY_WORDS.forEach(w   => { if (names.includes(w)) s.frittiert++; });
  DRINK_WORDS.forEach(w => { if (names.includes(w)) s.getraenke++; });
  const max = Math.max(s.grill, s.kalt, s.frittiert, s.getraenke);
  if (max === 0) return 'mixed';
  if (s.grill === max) return 'grill';
  if (s.kalt === max) return 'kalt';
  if (s.frittiert === max) return 'frittiert';
  return 'getraenke';
}

function getSecsLeft(order: Order, timing: KitchenTiming | undefined): number {
  const now = Date.now();
  if (timing?.ready_target) return (new Date(timing.ready_target).getTime() - now) / 1000;
  const elapsed = order.bestellt_am ? (now - new Date(order.bestellt_am).getTime()) / 1000 : 0;
  return (order.geschaetzte_zubereitung_min ?? 15) * 60 - elapsed;
}

function getUrgency(secs: number): Urgency {
  if (secs <= 0) return 'overdue';
  if (secs <= 120) return 'urgent';
  if (secs <= 300) return 'warn';
  return 'ok';
}

const URGENCY_COLORS: Record<Urgency, string> = {
  ok:      'bg-green-500',
  warn:    'bg-amber-400',
  urgent:  'bg-orange-500',
  overdue: 'bg-red-600',
};

const URGENCY_BORDER: Record<Urgency, string> = {
  ok:      'border-green-400',
  warn:    'border-amber-300',
  urgent:  'border-orange-400',
  overdue: 'border-red-500',
};

const URGENCY_GLOW: Record<Urgency, string> = {
  ok:      '',
  warn:    '',
  urgent:  'shadow-[0_0_12px_rgba(249,115,22,0.5)]',
  overdue: 'shadow-[0_0_16px_rgba(239,68,68,0.6)] animate-pulse',
};

const STATION_ICONS: Record<Station, typeof ChefHat> = {
  grill:     Flame,
  kalt:      Salad,
  frittiert: Thermometer,
  getraenke: Coffee,
  mixed:     ChefHat,
};

const STATION_LABELS: Record<Station, string> = {
  grill: 'Grill', kalt: 'Kalt', frittiert: 'Frittiert', getraenke: 'Getränke', mixed: 'Mix',
};

function useTick() {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT(n => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
}

function OrderTile({ order, timing }: { order: Order; timing: KitchenTiming | undefined }) {
  useTick();
  const secs = getSecsLeft(order, timing);
  const urgency = getUrgency(secs);
  const isOverdue = secs <= 0;
  const absSecs = Math.abs(secs);
  const mm = Math.floor(absSecs / 60);
  const ss = Math.floor(absSecs % 60);
  const timeStr = `${isOverdue ? '+' : ''}${mm}:${String(ss).padStart(2, '0')}`;
  const station = detectStation(order.items);
  const Icon = STATION_ICONS[station];
  const totalSecs = (order.geschaetzte_zubereitung_min ?? 15) * 60;
  const pct = timing?.cook_start_at
    ? Math.min(1, Math.max(0, 1 - secs / totalSecs))
    : 0;

  return (
    <div className={cn(
      'relative rounded-xl border-2 p-2.5 flex flex-col gap-1.5 transition-all duration-300',
      URGENCY_BORDER[urgency],
      URGENCY_GLOW[urgency],
      urgency === 'overdue' ? 'bg-red-950/20' :
      urgency === 'urgent'  ? 'bg-orange-950/10' :
      urgency === 'warn'    ? 'bg-amber-950/10' :
      'bg-white/5',
    )}>
      {/* Color dot + station */}
      <div className="flex items-center gap-1.5">
        <span className={cn('h-3 w-3 rounded-full shrink-0', URGENCY_COLORS[urgency])} />
        <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="text-[9px] font-bold text-muted-foreground truncate flex-1">
          {order.bestellnummer}
        </span>
      </div>

      {/* Timer */}
      <div className={cn(
        'font-mono font-black text-xl tabular-nums leading-none text-center',
        urgency === 'overdue' ? 'text-red-400' :
        urgency === 'urgent'  ? 'text-orange-400' :
        urgency === 'warn'    ? 'text-amber-400' :
        'text-green-400',
      )}>
        {timeStr}
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-white/10 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-1000', URGENCY_COLORS[urgency])}
          style={{ width: `${Math.min(100, pct * 100)}%` }}
        />
      </div>

      {/* Customer name */}
      <div className="text-[9px] text-muted-foreground truncate text-center">
        {order.kunde_name ?? STATION_LABELS[station]}
      </div>
    </div>
  );
}

function KitchenStatusAmpel({ orders, timings }: { orders: Order[]; timings: KitchenTiming[] }) {
  useTick();
  const timingMap = new Map(timings.map(t => [t.order_id, t]));
  const cooking = orders.filter(o => o.status === 'in_zubereitung');
  if (cooking.length === 0) return null;

  const overdueCount = cooking.filter(o => getSecsLeft(o, timingMap.get(o.id)) <= 0).length;
  const urgentCount  = cooking.filter(o => { const s = getSecsLeft(o, timingMap.get(o.id)); return s > 0 && s <= 120; }).length;
  const warnCount    = cooking.filter(o => { const s = getSecsLeft(o, timingMap.get(o.id)); return s > 120 && s <= 300; }).length;

  const ampelColor = overdueCount > 0 ? '#ef4444' : urgentCount > 0 ? '#f97316' : warnCount > 0 ? '#f59e0b' : '#22c55e';
  const ampelLabel = overdueCount > 0 ? 'ALARM' : urgentCount > 0 ? 'DRINGEND' : warnCount > 0 ? 'ACHTUNG' : 'OK';

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5">
      <div
        className="h-10 w-10 rounded-full shrink-0 flex items-center justify-center"
        style={{ background: ampelColor, boxShadow: `0 0 16px ${ampelColor}60` }}
      >
        {overdueCount > 0
          ? <AlertTriangle className="h-5 w-5 text-white" />
          : urgentCount > 0
          ? <Zap className="h-5 w-5 text-white" />
          : <CheckCircle2 className="h-5 w-5 text-white" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-black text-sm" style={{ color: ampelColor }}>{ampelLabel}</div>
        <div className="text-[10px] text-muted-foreground">
          {cooking.length} kochen
          {overdueCount > 0 && ` · ${overdueCount} überfällig`}
          {urgentCount > 0 && ` · ${urgentCount} dringend`}
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        {(['ok', 'warn', 'urgent', 'overdue'] as Urgency[]).map(u => {
          const count = u === 'ok'      ? cooking.length - overdueCount - urgentCount - warnCount
                      : u === 'warn'    ? warnCount
                      : u === 'urgent'  ? urgentCount
                      : overdueCount;
          return count > 0 ? (
            <div key={u} className={cn('flex items-center justify-center rounded-lg h-8 w-8 text-xs font-black text-white', URGENCY_COLORS[u])}>
              {count}
            </div>
          ) : null;
        })}
      </div>
    </div>
  );
}

export function KitchenStationColorGrid({
  orders,
  timings,
}: {
  orders: Order[];
  timings: KitchenTiming[];
}) {
  const cooking = orders.filter(o => o.status === 'in_zubereitung');
  if (cooking.length === 0) return null;

  const timingMap = new Map(timings.map(t => [t.order_id, t]));
  const sorted = [...cooking].sort((a, b) => getSecsLeft(a, timingMap.get(a.id)) - getSecsLeft(b, timingMap.get(b.id)));

  return (
    <div className="rounded-xl border bg-card p-3 space-y-3">
      {/* Ampel + Stats */}
      <KitchenStatusAmpel orders={orders} timings={timings} />

      {/* Grid: alle kochenden Bestellungen */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {sorted.map(o => (
          <OrderTile key={o.id} order={o} timing={timingMap.get(o.id)} />
        ))}
      </div>

      {/* Legende */}
      <div className="flex items-center gap-3 flex-wrap text-[9px] text-muted-foreground border-t border-border pt-2">
        {([
          ['ok', '>5 Min'], ['warn', '2–5 Min'], ['urgent', '<2 Min'], ['overdue', 'Überfällig'],
        ] as [Urgency, string][]).map(([u, l]) => (
          <span key={u} className="flex items-center gap-1">
            <span className={cn('h-2 w-2 rounded-full', URGENCY_COLORS[u])} />
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

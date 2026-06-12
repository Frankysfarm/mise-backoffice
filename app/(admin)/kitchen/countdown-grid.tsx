'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, ChefHat, CheckCircle2, AlertTriangle, Bike, Flame, Thermometer, Coffee, Salad } from 'lucide-react';

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

type DriverBatchETA = {
  order_id: string;
  driver_name: string;
  eta_sec: number; // seconds until driver arrives at restaurant
};

// Detect prep station from item names
type PrepStation = 'grill' | 'kalt' | 'frittiert' | 'getraenke' | 'mixed';

const GRILL_WORDS = ['burger', 'steak', 'grill', 'wrap', 'schnitzel', 'fleisch', 'chicken', 'hähnchen'];
const COLD_WORDS  = ['salat', 'sushi', 'bowl', 'raw', 'kalt', 'tartare', 'ceviche'];
const FRY_WORDS   = ['pommes', 'fries', 'frittes', 'nugget', 'crispy', 'tempura', 'onion ring'];
const DRINK_WORDS = ['cola', 'wasser', 'saft', 'bier', 'wein', 'shake', 'smoothie', 'kaffee', 'tee', 'limo', 'juice'];

function detectStation(items: { name: string }[]): PrepStation {
  const names = items.map(i => i.name.toLowerCase()).join(' ');
  const scores: Record<PrepStation, number> = { grill: 0, kalt: 0, frittiert: 0, getraenke: 0, mixed: 0 };
  GRILL_WORDS.forEach(w => { if (names.includes(w)) scores.grill++; });
  COLD_WORDS.forEach(w  => { if (names.includes(w)) scores.kalt++; });
  FRY_WORDS.forEach(w   => { if (names.includes(w)) scores.frittiert++; });
  DRINK_WORDS.forEach(w => { if (names.includes(w)) scores.getraenke++; });
  const max = Math.max(scores.grill, scores.kalt, scores.frittiert, scores.getraenke);
  if (max === 0) return 'mixed';
  if (scores.grill === max) return 'grill';
  if (scores.kalt === max) return 'kalt';
  if (scores.frittiert === max) return 'frittiert';
  return 'getraenke';
}

const STATION_META: Record<PrepStation, { label: string; icon: React.ElementType; color: string }> = {
  grill:     { label: 'Grill',      icon: Flame,       color: 'bg-red-100 text-red-700' },
  kalt:      { label: 'Kalt',       icon: Salad,       color: 'bg-cyan-100 text-cyan-700' },
  frittiert: { label: 'Frittiert',  icon: Thermometer, color: 'bg-yellow-100 text-yellow-800' },
  getraenke: { label: 'Getränke',   icon: Coffee,      color: 'bg-purple-100 text-purple-700' },
  mixed:     { label: 'Gemischt',   icon: ChefHat,     color: 'bg-gray-100 text-gray-700' },
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

function CountdownCard({
  order,
  timing,
  driverETA,
}: {
  order: Order;
  timing: KitchenTiming | undefined;
  driverETA: DriverBatchETA | undefined;
}) {
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
  const station = detectStation(order.items);
  const stationMeta = STATION_META[station];
  const StationIcon = stationMeta.icon;

  // Driver approaching warning
  const driverApproachingSec = driverETA?.eta_sec ?? null;
  const driverApproachingMins = driverApproachingSec != null ? Math.ceil(driverApproachingSec / 60) : null;
  const driverAlmostHere = driverApproachingSec != null && driverApproachingSec <= 300; // ≤5 min
  const readyBeforeDriver = driverApproachingSec != null && secsLeft <= driverApproachingSec;

  return (
    <div
      className={cn(
        'relative rounded-2xl border-2 p-3 flex flex-col gap-2 transition-all duration-300',
        isOverdue
          ? 'border-red-500 bg-red-50 shadow-[0_0_16px_rgba(239,68,68,0.25)] animate-pulse'
          : driverAlmostHere
          ? 'border-blue-500 bg-blue-50 shadow-[0_0_16px_rgba(59,130,246,0.2)]'
          : isUrgent
          ? 'border-orange-400 bg-orange-50 shadow-[0_0_12px_rgba(249,115,22,0.2)]'
          : isWarn
          ? 'border-amber-300 bg-amber-50'
          : 'border-matcha-300 bg-matcha-50',
      )}
    >
      {/* Driver approaching banner */}
      {driverApproachingMins != null && (
        <div className={cn(
          'absolute -top-2.5 left-2 right-2 flex items-center justify-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black',
          driverAlmostHere
            ? 'bg-blue-600 text-white animate-pulse'
            : readyBeforeDriver
            ? 'bg-matcha-600 text-white'
            : 'bg-blue-100 text-blue-800',
        )}>
          <Bike className="h-2.5 w-2.5 shrink-0" />
          Fahrer in {driverApproachingMins} Min
        </div>
      )}

      {/* Countdown ring + time */}
      <div className={cn('flex items-center gap-3', driverApproachingMins != null && 'mt-1')}>
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

      {/* Order info + station badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-black truncate">{order.bestellnummer}</div>
          <div className="text-[10px] text-muted-foreground truncate">{order.kunde_name}</div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* Station badge */}
          <span className={cn('flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold', stationMeta.color)}>
            <StationIcon className="h-2.5 w-2.5" />
            {stationMeta.label}
          </span>
          {/* Delivery type badge */}
          <span className={cn(
            'rounded-full px-1.5 py-0.5 text-[9px] font-bold',
            isOverdue ? 'bg-red-100 text-red-700' : isUrgent ? 'bg-orange-100 text-orange-700' : 'bg-matcha-100 text-matcha-700',
          )}>
            {order.items.length} Pos.
          </span>
        </div>
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

      {/* Ready-before-driver indicator */}
      {driverApproachingSec != null && !isOverdue && (
        <div className="flex items-center gap-1 text-[9px]">
          <div className={cn(
            'h-1.5 rounded-full flex-1 bg-gray-200 overflow-hidden',
          )}>
            <div
              className={cn(
                'h-full rounded-full transition-all duration-1000',
                readyBeforeDriver ? 'bg-matcha-500' : 'bg-orange-400',
              )}
              style={{
                width: `${Math.min(100, Math.max(5, (1 - secsLeft / Math.max(1, driverApproachingSec)) * 100))}%`,
              }}
            />
          </div>
          <span className={cn('font-bold shrink-0', readyBeforeDriver ? 'text-matcha-600' : 'text-orange-600')}>
            {readyBeforeDriver ? '✓ fertig' : '⚠ Eile'}
          </span>
        </div>
      )}
    </div>
  );
}

export function KitchenSmartCountdownGrid({
  orders,
  timings,
  driverETAs,
}: {
  orders: Order[];
  timings: KitchenTiming[];
  driverETAs?: DriverBatchETA[];
}) {
  const cooking = orders.filter((o) => o.status === 'in_zubereitung');
  if (cooking.length === 0) return null;

  const timingMap = new Map(timings.map((t) => [t.order_id, t]));
  const driverETAMap = new Map((driverETAs ?? []).map((d) => [d.order_id, d]));

  // Station-Gruppen: Grill hat Vorrang, dann Kalt, Frittiert, Getränke, Gemischt
  const stationGroups = new Map<PrepStation, Order[]>();
  for (const order of cooking) {
    const station = detectStation(order.items);
    const group = stationGroups.get(station) ?? [];
    group.push(order);
    stationGroups.set(station, group);
  }
  const stationOrder: PrepStation[] = ['grill', 'frittiert', 'kalt', 'getraenke', 'mixed'];

  // Sort within each group: overdue first, then by secs remaining ascending
  const now = Date.now();
  const getSecsLeft = (o: Order, t: KitchenTiming | undefined) => {
    if (t?.ready_target) return (new Date(t.ready_target).getTime() - now) / 1000;
    const elapsed = o.bestellt_am ? (now - new Date(o.bestellt_am).getTime()) / 1000 : 0;
    return (o.geschaetzte_zubereitung_min ?? 15) * 60 - elapsed;
  };

  const sorted = [...cooking].sort((a, b) =>
    getSecsLeft(a, timingMap.get(a.id)) - getSecsLeft(b, timingMap.get(b.id))
  );

  // Summary stats
  const overdueCount = sorted.filter(o => getSecsLeft(o, timingMap.get(o.id)) <= 0).length;
  const urgentCount  = sorted.filter(o => { const s = getSecsLeft(o, timingMap.get(o.id)); return s > 0 && s <= 120; }).length;
  const driverCount  = (driverETAs ?? []).length;

  const activeStations = stationOrder.filter(s => (stationGroups.get(s) ?? []).length > 0);

  return (
    <div className="rounded-xl border bg-card p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <ChefHat className="h-4 w-4 text-orange-500 shrink-0" />
        <span className="text-sm font-bold">Smart-Countdown</span>
        <span className="rounded-full bg-orange-100 text-orange-700 px-2 py-0.5 text-[10px] font-black">
          {cooking.length} kochen
        </span>
        {overdueCount > 0 && (
          <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-black animate-pulse">
            ⚠ {overdueCount} überfällig
          </span>
        )}
        {urgentCount > 0 && (
          <span className="rounded-full bg-orange-100 text-orange-700 px-2 py-0.5 text-[10px] font-black">
            ⚡ {urgentCount} dringend
          </span>
        )}
        {driverCount > 0 && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-[10px] font-black">
            <Bike className="h-2.5 w-2.5" /> {driverCount} Fahrer auf Weg
          </span>
        )}
        {driverCount === 0 && (
          <span className="ml-auto text-[10px] text-muted-foreground">Farbe = Dringlichkeit</span>
        )}
      </div>

      {/* Station-grouped grid */}
      {activeStations.length > 1 ? (
        <div className="space-y-3">
          {activeStations.map(station => {
            const group = (stationGroups.get(station) ?? []).sort(
              (a, b) => getSecsLeft(a, timingMap.get(a.id)) - getSecsLeft(b, timingMap.get(b.id))
            );
            const meta = STATION_META[station];
            const StationIcon = meta.icon;
            return (
              <div key={station}>
                <div className={cn('flex items-center gap-1.5 mb-2 text-[10px] font-black uppercase tracking-wide rounded-full px-2 py-0.5 w-fit', meta.color)}>
                  <StationIcon className="h-3 w-3" />
                  {meta.label} ({group.length})
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {group.map((o) => (
                    <CountdownCard key={o.id} order={o} timing={timingMap.get(o.id)} driverETA={driverETAMap.get(o.id)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {sorted.map((o) => (
            <CountdownCard key={o.id} order={o} timing={timingMap.get(o.id)} driverETA={driverETAMap.get(o.id)} />
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="mt-2 flex items-center gap-3 flex-wrap text-[9px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500 inline-block" />{'>'}5 Min</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />2–5 Min</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-500 inline-block" />{'<'}2 Min</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 inline-block" />Überfällig</span>
        {driverCount > 0 && <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />Fahrer nähert sich</span>}
        <span className="ml-auto flex items-center gap-2">
          {(['grill', 'frittiert', 'kalt', 'getraenke'] as PrepStation[]).map(s => {
            const m = STATION_META[s];
            const Icon = m.icon;
            return (
              <span key={s} className={cn('flex items-center gap-0.5 rounded-full px-1.5 py-0.5', m.color)}>
                <Icon className="h-2 w-2" />{m.label}
              </span>
            );
          })}
        </span>
      </div>
    </div>
  );
}

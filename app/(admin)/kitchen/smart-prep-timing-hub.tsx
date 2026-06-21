'use client';

import { useEffect, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  Flame, Clock, ChefHat, Bike, AlertTriangle, Zap, Timer, Play,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  orders: {
    id: string;
    bestellnummer: string;
    status: string;
    bestellt_am: string | null;
    geschaetzte_zubereitung_min: number | null;
    kunde_name: string;
    typ: string; // 'lieferung' | 'abholung' | 'tisch'
    items: { name: string; menge: number }[];
  }[];
  driverETAs?: {
    order_id: string;
    driver_name: string;
    eta_sec: number;
  }[];
  timings?: {
    order_id: string;
    cook_start_at: string | null;
    ready_target: string | null;
    prep_min: number | null;
    status: string;
  }[];
}

// ── Station detection (shared logic mirroring countdown-grid) ─────────────────

type PrepStation = 'grill' | 'kalt' | 'frittiert' | 'getraenke' | 'mixed';

const GRILL_WORDS  = ['burger', 'steak', 'grill', 'wrap', 'schnitzel', 'fleisch', 'chicken', 'hähnchen', 'gyros'];
const COLD_WORDS   = ['salat', 'sushi', 'bowl', 'raw', 'kalt', 'tartare', 'ceviche', 'bruschetta'];
const FRY_WORDS    = ['pommes', 'fries', 'frittes', 'nugget', 'crispy', 'tempura', 'onion ring', 'calamari'];
const DRINK_WORDS  = ['cola', 'wasser', 'saft', 'bier', 'wein', 'shake', 'smoothie', 'kaffee', 'tee', 'limo', 'juice', 'espresso'];

function detectStation(items: { name: string }[]): PrepStation {
  const text = items.map(i => i.name.toLowerCase()).join(' ');
  const s = { grill: 0, kalt: 0, frittiert: 0, getraenke: 0 };
  GRILL_WORDS.forEach(w  => { if (text.includes(w)) s.grill++; });
  COLD_WORDS.forEach(w   => { if (text.includes(w)) s.kalt++; });
  FRY_WORDS.forEach(w    => { if (text.includes(w)) s.frittiert++; });
  DRINK_WORDS.forEach(w  => { if (text.includes(w)) s.getraenke++; });
  const max = Math.max(s.grill, s.kalt, s.frittiert, s.getraenke);
  if (max === 0) return 'mixed';
  if (s.grill === max) return 'grill';
  if (s.kalt === max) return 'kalt';
  if (s.frittiert === max) return 'frittiert';
  return 'getraenke';
}

const STATION_META: Record<PrepStation, { label: string; emoji: string; color: string }> = {
  grill:     { label: 'Grill',     emoji: '🔥', color: 'bg-red-100 text-red-700' },
  kalt:      { label: 'Kalt',      emoji: '🥗', color: 'bg-cyan-100 text-cyan-700' },
  frittiert: { label: 'Frittier.', emoji: '🍟', color: 'bg-yellow-100 text-yellow-800' },
  getraenke: { label: 'Getränke',  emoji: '🥤', color: 'bg-purple-100 text-purple-700' },
  mixed:     { label: 'Gemischt',  emoji: '🍽',  color: 'bg-gray-100 text-gray-700' },
};

// ── Cook-start timing logic ───────────────────────────────────────────────────

type CookEntry = {
  order: Props['orders'][number];
  cookStartInSec: number;   // seconds until cooking should start (negative = overdue)
  prepSec: number;          // total prep duration in seconds
  driverETA: Props['driverETAs'][number] | null;
  station: PrepStation;
  zone: 'now' | 'upcoming' | 'buffered';
};

const DRIVER_BUFFER_SEC = 2 * 60; // 2-min buffer before driver ETA
const MAX_STATIONS = 6;           // assumed kitchen capacity

function computeEntries(
  orders: Props['orders'],
  driverETAs: NonNullable<Props['driverETAs']>,
  timings: NonNullable<Props['timings']>,
  nowMs: number,
): CookEntry[] {
  const etaMap = new Map(driverETAs.map(d => [d.order_id, d]));
  const timingMap = new Map(timings.map(t => [t.order_id, t]));

  const ACTIVE_STATUSES = new Set(['neu', 'bestätigt', 'angenommen', 'in_zubereitung']);

  const entries: CookEntry[] = [];

  for (const order of orders) {
    if (!ACTIVE_STATUSES.has(order.status)) continue;

    const timing = timingMap.get(order.id);
    const driverETA = etaMap.get(order.id) ?? null;
    const prepSec = (timing?.prep_min ?? order.geschaetzte_zubereitung_min ?? 20) * 60;
    const station = detectStation(order.items);

    let cookStartInSec: number;

    if (order.status === 'in_zubereitung') {
      // Already cooking — cookStart was now or in the past
      const cookStartMs = timing?.cook_start_at
        ? new Date(timing.cook_start_at).getTime()
        : nowMs;
      const elapsedSec = (nowMs - cookStartMs) / 1000;
      // Negative: already started `elapsedSec` seconds ago
      cookStartInSec = -elapsedSec;
    } else if (driverETA) {
      // Delivery: back-calculate from driver ETA minus buffer
      const targetReadySec = driverETA.eta_sec - DRIVER_BUFFER_SEC;
      cookStartInSec = targetReadySec - prepSec;
    } else if (order.typ === 'abholung' && timing?.ready_target) {
      // Pickup with a known ready target
      const readyInSec = (new Date(timing.ready_target).getTime() - nowMs) / 1000;
      cookStartInSec = readyInSec - prepSec;
    } else if (order.bestellt_am) {
      // Fallback: use order age + assumed prep time
      const orderAgeSec = (nowMs - new Date(order.bestellt_am).getTime()) / 1000;
      // Start cooking based on elapsed time; if order is 5+ minutes old, start soon
      cookStartInSec = Math.max(-orderAgeSec, 5 * 60 - orderAgeSec - prepSec);
    } else {
      // No data: assume should start now
      cookStartInSec = 0;
    }

    const zone: CookEntry['zone'] =
      cookStartInSec <= 5 * 60        ? 'now'
      : cookStartInSec <= 15 * 60     ? 'upcoming'
      : 'buffered';

    entries.push({ order, cookStartInSec, prepSec, driverETA, station, zone });
  }

  // Sort: overdue first (most negative), then ascending by cookStartInSec
  entries.sort((a, b) => {
    // Within zone=now: overdue (< 0) before imminent (< 2 min) before upcoming (<5)
    if (a.zone === 'now' && b.zone === 'now') {
      return a.cookStartInSec - b.cookStartInSec;
    }
    const zoneOrder = { now: 0, upcoming: 1, buffered: 2 };
    if (a.zone !== b.zone) return zoneOrder[a.zone] - zoneOrder[b.zone];
    return a.cookStartInSec - b.cookStartInSec;
  });

  return entries;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtStartIn(sec: number): string {
  if (sec <= 0) {
    const abs = Math.abs(Math.floor(sec / 60));
    return abs === 0 ? 'Sofort!' : `${abs} Min überfällig`;
  }
  const m = Math.floor(sec / 60);
  const s = Math.abs(Math.round(sec % 60));
  if (m === 0) return `${s}s`;
  return `${m}:${String(s).padStart(2, '0')} Min`;
}

function fmtPrepMin(sec: number): string {
  const m = Math.round(sec / 60);
  return `${m} Min`;
}

// ── Tick hook ─────────────────────────────────────────────────────────────────

function useTick(ms = 1000) {
  const [, setN] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setN(n => n + 1), ms);
    return () => clearInterval(iv);
  }, [ms]);
}

// ── Efficiency Gauge ──────────────────────────────────────────────────────────

function EfficiencyGauge({ score }: { score: number }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const dash = (pct / 100) * circ;
  const color = pct >= 80 ? '#22c55e' : pct >= 55 ? '#f59e0b' : pct >= 30 ? '#f97316' : '#ef4444';
  const label = pct >= 80 ? 'Gut' : pct >= 55 ? 'Ok' : pct >= 30 ? 'Schlecht' : 'Alarm';

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <svg width={52} height={52}>
          <circle cx={26} cy={26} r={r} fill="none" stroke="#e5e7eb" strokeWidth={4} />
          <circle
            cx={26} cy={26} r={r} fill="none"
            stroke={color} strokeWidth={4}
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            transform="rotate(-90 26 26)"
            style={{ transition: 'stroke-dasharray 0.8s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] font-black tabular-nums" style={{ color }}>
            {Math.round(pct)}
          </span>
        </div>
      </div>
      <div>
        <div className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
          Effizienz
        </div>
        <div className="text-xs font-black" style={{ color }}>{label}</div>
      </div>
    </div>
  );
}

// ── Capacity Meter ────────────────────────────────────────────────────────────

function CapacityMeter({
  active,
  total,
}: {
  active: number;
  total: number;
}) {
  const pct = Math.min(100, Math.round((active / Math.max(1, total)) * 100));
  const color = pct >= 95 ? 'bg-red-500' : pct >= 80 ? 'bg-orange-400' : pct >= 60 ? 'bg-amber-400' : 'bg-matcha-500';
  const textColor = pct >= 95 ? 'text-red-700' : pct >= 80 ? 'text-orange-700' : pct >= 60 ? 'text-amber-700' : 'text-matcha-700';
  const label = pct >= 95 ? 'Überlastet' : pct >= 80 ? 'Hoch' : pct >= 60 ? 'Mittel' : 'Frei';

  return (
    <div className="flex items-center gap-2 min-w-0">
      <ChefHat className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1 gap-1">
          <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground truncate">
            Stationen {active}/{total}
          </span>
          <span className={cn('text-[9px] font-black shrink-0', textColor)}>{label}</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', color, pct >= 95 && 'animate-pulse')}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Order Card ────────────────────────────────────────────────────────────────

function PrepOrderCard({
  entry,
  variant,
}: {
  entry: CookEntry;
  variant: 'now' | 'upcoming' | 'buffered';
}) {
  const { order, cookStartInSec, prepSec, driverETA, station } = entry;
  const stationMeta = STATION_META[station];
  const isOverdue = cookStartInSec < 0;
  const isImminent = cookStartInSec >= 0 && cookStartInSec < 2 * 60;

  const topItems = order.items.slice(0, 2);
  const extraCount = order.items.length - topItems.length;

  const typIcon =
    order.typ === 'lieferung' ? <Bike className="h-3 w-3" /> :
    order.typ === 'abholung'  ? <span className="text-[10px]">🥡</span> :
                                <span className="text-[10px]">🍽️</span>;

  const cardBase = cn(
    'rounded-xl border-2 p-3 flex flex-col gap-2 transition-all duration-300',
    variant === 'now' && isOverdue
      ? 'border-red-500 bg-red-50 shadow-[0_0_14px_rgba(239,68,68,0.2)] animate-pulse'
      : variant === 'now' && isImminent
      ? 'border-red-400 bg-red-50 shadow-[0_0_10px_rgba(239,68,68,0.15)]'
      : variant === 'now'
      ? 'border-red-300 bg-red-50'
      : variant === 'upcoming'
      ? 'border-amber-300 bg-amber-50'
      : 'border-matcha-200 bg-matcha-50',
  );

  return (
    <div className={cardBase}>
      {/* Order number + type */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={cn(
            'flex items-center justify-center h-5 w-5 rounded-full shrink-0',
            variant === 'now' ? 'bg-red-100 text-red-600' :
            variant === 'upcoming' ? 'bg-amber-100 text-amber-700' :
            'bg-matcha-100 text-matcha-700',
          )}>
            {typIcon}
          </span>
          <span className="font-mono text-xs font-black truncate">{order.bestellnummer}</span>
        </div>
        <span className={cn(
          'flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold shrink-0',
          stationMeta.color,
        )}>
          <span>{stationMeta.emoji}</span>
          {stationMeta.label}
        </span>
      </div>

      {/* Customer + items count */}
      <div className="text-[10px] text-muted-foreground truncate">{order.kunde_name}</div>

      {/* Items preview */}
      <div className="space-y-0.5">
        {topItems.map((it, i) => (
          <div key={i} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className={cn(
              'h-3.5 w-3.5 shrink-0 rounded-full flex items-center justify-center text-[8px] font-black',
              variant === 'now' ? 'bg-red-200 text-red-700' :
              variant === 'upcoming' ? 'bg-amber-200 text-amber-800' :
              'bg-matcha-200 text-matcha-700',
            )}>
              {it.menge}
            </span>
            <span className="truncate">{it.name}</span>
          </div>
        ))}
        {extraCount > 0 && (
          <div className="text-[9px] text-muted-foreground">+{extraCount} weitere</div>
        )}
      </div>

      {/* Start-in + prep time row */}
      <div className="flex items-center justify-between gap-1 pt-0.5 border-t border-black/5">
        <div className="flex items-center gap-1">
          <Play className={cn(
            'h-3 w-3 shrink-0',
            variant === 'now' ? 'text-red-500' :
            variant === 'upcoming' ? 'text-amber-500' :
            'text-matcha-500',
          )} />
          <span className={cn(
            'text-[10px] font-black tabular-nums',
            isOverdue ? 'text-red-600' :
            isImminent ? 'text-red-500' :
            variant === 'upcoming' ? 'text-amber-700' :
            'text-matcha-700',
          )}>
            {fmtStartIn(cookStartInSec)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Timer className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-[10px] text-muted-foreground">{fmtPrepMin(prepSec)}</span>
        </div>
      </div>

      {/* Driver ETA chip (delivery only) */}
      {driverETA && (
        <div className={cn(
          'flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold w-fit',
          driverETA.eta_sec < 5 * 60 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600',
        )}>
          <Bike className="h-2.5 w-2.5 shrink-0" />
          {driverETA.driver_name} · {Math.ceil(driverETA.eta_sec / 60)} Min
        </div>
      )}
    </div>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  label,
  count,
  variant,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  variant: 'now' | 'upcoming' | 'buffered';
}) {
  return (
    <div className={cn(
      'flex items-center gap-2 rounded-lg px-3 py-1.5',
      variant === 'now' ? 'bg-red-100' :
      variant === 'upcoming' ? 'bg-amber-100' :
      'bg-matcha-100',
    )}>
      <span className={cn(
        'shrink-0',
        variant === 'now' ? 'text-red-600' :
        variant === 'upcoming' ? 'text-amber-700' :
        'text-matcha-700',
      )}>
        {icon}
      </span>
      <span className={cn(
        'text-[11px] font-black uppercase tracking-wider',
        variant === 'now' ? 'text-red-700' :
        variant === 'upcoming' ? 'text-amber-800' :
        'text-matcha-800',
      )}>
        {label}
      </span>
      <span className={cn(
        'ml-auto rounded-full px-2 py-0.5 text-[9px] font-black',
        variant === 'now' ? 'bg-red-600 text-white' :
        variant === 'upcoming' ? 'bg-amber-500 text-white' :
        'bg-matcha-600 text-white',
      )}>
        {count}
      </span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function KitchenSmartPrepTimingHub({
  orders,
  driverETAs = [],
  timings = [],
}: Props) {
  useTick(5000); // refresh every 5 seconds
  const nowMs = Date.now();

  const entries = useMemo(
    () => computeEntries(orders, driverETAs, timings, nowMs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, driverETAs, timings, nowMs],
  );

  const nowEntries      = entries.filter(e => e.zone === 'now');
  const upcomingEntries = entries.filter(e => e.zone === 'upcoming');
  const bufferedEntries = entries.filter(e => e.zone === 'buffered');

  // Active stations = orders currently in_zubereitung
  const activeCount = orders.filter(o => o.status === 'in_zubereitung').length;

  // Efficiency score: percentage of "now" orders that started on time (not overdue)
  const totalNow = nowEntries.length;
  const onTimeNow = nowEntries.filter(e => e.cookStartInSec >= 0).length;
  const efficiencyScore = useMemo(() => {
    if (entries.length === 0) return 100;
    const overdueCount = entries.filter(e => e.cookStartInSec < -60).length; // >1 min overdue
    return Math.max(0, Math.round(((entries.length - overdueCount) / entries.length) * 100));
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-matcha-100 bg-matcha-50 px-4 py-3">
        <ChefHat className="h-4 w-4 text-matcha-600 shrink-0" />
        <div>
          <div className="text-xs font-bold text-matcha-800">Keine Bestellungen</div>
          <div className="text-[11px] text-matcha-600">Küche wartet auf neue Aufträge</div>
        </div>
      </div>
    );
  }

  const overdueCount = nowEntries.filter(e => e.cookStartInSec < 0).length;

  return (
    <div className="rounded-xl border bg-card overflow-hidden shadow-sm space-y-0">
      {/* ── Header ── */}
      <div className={cn(
        'flex items-center gap-3 px-3 py-2.5 border-b flex-wrap',
        overdueCount > 0 ? 'bg-red-50 border-red-200' : 'bg-card border-border',
      )}>
        <div className="flex items-center gap-2 min-w-0">
          <Zap className={cn(
            'h-4 w-4 shrink-0',
            overdueCount > 0 ? 'text-red-500 animate-pulse' : 'text-matcha-600',
          )} />
          <span className="text-sm font-black">Smart Prep Timing</span>
          <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-bold">
            {entries.length} offen
          </span>
          {overdueCount > 0 && (
            <span className="rounded-full bg-red-600 text-white px-2 py-0.5 text-[10px] font-black animate-pulse flex items-center gap-1">
              <AlertTriangle className="h-2.5 w-2.5" />
              {overdueCount} überfällig
            </span>
          )}
        </div>

        {/* Capacity meter + efficiency gauge */}
        <div className="flex items-center gap-4 ml-auto flex-wrap">
          <div className="w-36">
            <CapacityMeter active={activeCount} total={MAX_STATIONS} />
          </div>
          <EfficiencyGauge score={efficiencyScore} />
        </div>
      </div>

      {/* ── Sections ── */}
      <div className="p-3 space-y-4">

        {/* JETZT KOCHEN */}
        {nowEntries.length > 0 && (
          <div className="space-y-2">
            <SectionHeader
              icon={<Flame className="h-3.5 w-3.5" />}
              label="Jetzt Kochen"
              count={nowEntries.length}
              variant="now"
            />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {nowEntries.map(entry => (
                <PrepOrderCard key={entry.order.id} entry={entry} variant="now" />
              ))}
            </div>
          </div>
        )}

        {/* BALD KOCHEN */}
        {upcomingEntries.length > 0 && (
          <div className="space-y-2">
            <SectionHeader
              icon={<Clock className="h-3.5 w-3.5" />}
              label="Bald Kochen"
              count={upcomingEntries.length}
              variant="upcoming"
            />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {upcomingEntries.map(entry => (
                <PrepOrderCard key={entry.order.id} entry={entry} variant="upcoming" />
              ))}
            </div>
          </div>
        )}

        {/* EINGEPLANT */}
        {bufferedEntries.length > 0 && (
          <div className="space-y-2">
            <SectionHeader
              icon={<Timer className="h-3.5 w-3.5" />}
              label="Eingeplant"
              count={bufferedEntries.length}
              variant="buffered"
            />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {bufferedEntries.map(entry => (
                <PrepOrderCard key={entry.order.id} entry={entry} variant="buffered" />
              ))}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 flex-wrap text-[9px] text-muted-foreground border-t pt-2">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
            JETZT — Start in {'<'} 5 Min
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
            BALD — 5–15 Min
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-matcha-500 inline-block" />
            EINGEPLANT — {'>'} 15 Min
          </span>
          <span className="ml-auto flex items-center gap-1">
            <Bike className="h-2.5 w-2.5" />
            ETA = Fahrer-Ankunft
          </span>
        </div>
      </div>
    </div>
  );
}

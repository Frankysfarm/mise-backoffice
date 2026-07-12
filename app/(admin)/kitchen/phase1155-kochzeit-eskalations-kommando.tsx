'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Clock, Flame, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Item = { name?: string; title?: string; quantity?: number };

type Order = {
  id: string;
  bestellnummer?: string;
  status?: string;
  bestellt_am?: string | null;
  fertig_am?: string | null;
  items?: Item[] | null;
};

type Timing = {
  id: string;
  order_id: string;
  cook_start_at?: string | null;
  ready_target?: string | null;
  prep_min?: number | null;
  status?: string;
};

interface Props {
  orders: Array<{
    id: string;
    bestellnummer?: string;
    status?: string;
    bestellt_am?: string | null;
    fertig_am?: string | null;
    items?: Array<{ name?: string; title?: string; quantity?: number }> | null;
  }>;
  timings: Array<{
    id: string;
    order_id: string;
    cook_start_at?: string | null;
    ready_target?: string | null;
    prep_min?: number | null;
    status?: string;
  }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AKTIVE_STATI = ['neu', 'angenommen', 'confirmed', 'cooking', 'in_preparation', 'in_zubereitung'];
const DEFAULT_PREP_MIN = 20;

const STATION_KEYWORDS: [string, string][] = [
  ['pizza', 'Ofen'],
  ['flammkuchen', 'Ofen'],
  ['auflauf', 'Ofen'],
  ['burger', 'Grill'],
  ['steak', 'Grill'],
  ['schnitzel', 'Grill'],
  ['pasta', 'Herd'],
  ['suppe', 'Herd'],
  ['curry', 'Herd'],
  ['risotto', 'Herd'],
  ['salat', 'Kalt'],
  ['bowl', 'Kalt'],
  ['wrap', 'Kalt'],
  ['pommes', 'Friteuse'],
  ['nuggets', 'Friteuse'],
  ['chicken', 'Friteuse'],
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStation(items?: Item[] | null): string {
  if (!items || items.length === 0) return 'Küche';
  const text = items
    .map((i) => (i.name ?? i.title ?? '').toLowerCase())
    .join(' ');
  for (const [kw, station] of STATION_KEYWORDS) {
    if (text.includes(kw)) return station;
  }
  return 'Küche';
}

function fmtSec(seconds: number): string {
  const abs = Math.abs(Math.round(seconds));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

type Dringlichkeit = 'gruen' | 'amber' | 'orange' | 'rot';

function getDringlichkeit(ratio: number): Dringlichkeit {
  if (ratio <= 0.5) return 'gruen';
  if (ratio <= 0.75) return 'amber';
  if (ratio <= 1.0) return 'orange';
  return 'rot';
}

const FARBEN: Record<
  Dringlichkeit,
  {
    card: string;
    border: string;
    ringStroke: string;
    ringTrack: string;
    label: string;
    sub: string;
    badge: string;
    stationBg: string;
  }
> = {
  gruen: {
    card: 'bg-matcha-50 dark:bg-matcha-950/40',
    border: 'border-matcha-200 dark:border-matcha-800',
    ringStroke: '#4d7c0f',
    ringTrack: 'text-matcha-100 dark:text-matcha-900',
    label: 'text-matcha-800 dark:text-matcha-200',
    sub: 'text-matcha-600 dark:text-matcha-400',
    badge: 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900/50 dark:text-matcha-300',
    stationBg: 'bg-matcha-500/20 text-matcha-700 dark:bg-matcha-700/30 dark:text-matcha-300',
  },
  amber: {
    card: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-300 dark:border-amber-700',
    ringStroke: '#d97706',
    ringTrack: 'text-amber-100 dark:text-amber-900',
    label: 'text-amber-900 dark:text-amber-200',
    sub: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    stationBg: 'bg-amber-400/20 text-amber-700 dark:bg-amber-700/30 dark:text-amber-300',
  },
  orange: {
    card: 'bg-orange-100 dark:bg-orange-950/40',
    border: 'border-orange-300 dark:border-orange-700',
    ringStroke: '#ea580c',
    ringTrack: 'text-orange-200 dark:text-orange-900',
    label: 'text-orange-900 dark:text-orange-200',
    sub: 'text-orange-600 dark:text-orange-400',
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
    stationBg: 'bg-orange-400/20 text-orange-700 dark:bg-orange-700/30 dark:text-orange-300',
  },
  rot: {
    card: 'bg-red-50 dark:bg-red-950/40',
    border: 'border-red-300 dark:border-red-700',
    ringStroke: '#dc2626',
    ringTrack: 'text-red-100 dark:text-red-900',
    label: 'text-red-900 dark:text-red-200',
    sub: 'text-red-600 dark:text-red-400',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
    stationBg: 'bg-red-400/20 text-red-700 dark:bg-red-700/30 dark:text-red-300',
  },
};

// ---------------------------------------------------------------------------
// Countdown Ring SVG
// ---------------------------------------------------------------------------

interface CountdownRingProps {
  ratio: number;
  level: Dringlichkeit;
  remainingSec: number;
  overdue: boolean;
}

function CountdownRing({ ratio, level, remainingSec, overdue }: CountdownRingProps) {
  const size = 60;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.min(ratio, 1);
  const dashoffset = circumference * (1 - filled);
  const f = FARBEN[level];

  return (
    <div
      className="relative flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        aria-hidden="true"
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className={f.ringTrack}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={f.ringStroke}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center leading-tight">
        {overdue ? (
          <>
            <span className={cn('text-[8px] font-bold uppercase', f.sub)}>+</span>
            <span className={cn('text-[9px] font-bold tabular-nums', f.label)}>
              {fmtSec(Math.abs(remainingSec))}
            </span>
          </>
        ) : (
          <span className={cn('text-[10px] font-bold tabular-nums', f.label)}>
            {fmtSec(remainingSec)}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function KitchenPhase1155KochzeitEskalationsKommando({ orders, timings }: Props) {
  const [tick, setTick] = useState(0);
  const [expanded, setExpanded] = useState(false);

  // 1-second tick for live countdown
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Build a fast lookup map: order_id → Timing
  const timingMap = useMemo(() => {
    const map = new Map<string, Timing>();
    for (const t of timings) {
      if (!map.has(t.order_id)) map.set(t.order_id, t);
    }
    return map;
  }, [timings]);

  const enriched = useMemo(() => {
    const now = Date.now();
    const aktiv = orders.filter((o) => AKTIVE_STATI.includes(o.status ?? ''));

    return aktiv.map((order) => {
      const timing = timingMap.get(order.id);

      // Elapsed: since bestellt_am
      const bestelltMs = order.bestellt_am ? new Date(order.bestellt_am).getTime() : now;
      const elapsedSec = Math.max(0, Math.floor((now - bestelltMs) / 1000));

      // Total budget: prefer ready_target − bestellt_am, else prep_min, else default
      let totalSec: number;
      if (timing?.ready_target) {
        const targetMs = new Date(timing.ready_target).getTime();
        totalSec = Math.max(60, Math.floor((targetMs - bestelltMs) / 1000));
      } else if (timing?.prep_min != null) {
        totalSec = timing.prep_min * 60;
      } else {
        totalSec = DEFAULT_PREP_MIN * 60;
      }

      const remainingSec = totalSec - elapsedSec;
      const ratio = totalSec > 0 ? elapsedSec / totalSec : 1;
      const overdue = remainingSec < 0;
      const level = getDringlichkeit(ratio);
      const station = getStation(order.items);

      return { order, timing, elapsedSec, totalSec, remainingSec, ratio, overdue, level, station };
    });
  }, [orders, timingMap, tick]);

  const summary = useMemo(() => {
    const ueberfaellig = enriched.filter((e) => e.overdue).length;
    const puenktlich = enriched.filter((e) => !e.overdue && e.level === 'gruen').length;
    return { aktiv: enriched.length, ueberfaellig, puenktlich };
  }, [enriched]);

  if (enriched.length === 0) return null;

  // Sort: red first, then orange, then amber, then green; within each by remaining (ascending)
  const sorted = [...enriched].sort((a, b) => {
    const order: Dringlichkeit[] = ['rot', 'orange', 'amber', 'gruen'];
    const ai = order.indexOf(a.level);
    const bi = order.indexOf(b.level);
    if (ai !== bi) return ai - bi;
    return a.remainingSec - b.remainingSec;
  });

  const headerAmpel =
    summary.ueberfaellig > 0
      ? 'rot'
      : enriched.some((e) => e.level === 'orange')
      ? 'orange'
      : enriched.some((e) => e.level === 'amber')
      ? 'amber'
      : 'gruen';

  const headerFarben = FARBEN[headerAmpel];

  return (
    <div
      className={cn(
        'rounded-2xl border overflow-hidden',
        headerFarben.card,
        headerFarben.border,
      )}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Header strip                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-black/10 dark:border-white/10">
        {headerAmpel === 'rot' ? (
          <Flame size={16} className={headerFarben.label} />
        ) : headerAmpel === 'orange' ? (
          <AlertTriangle size={16} className={headerFarben.label} />
        ) : (
          <Zap size={16} className={headerFarben.label} />
        )}
        <span className={cn('font-bold text-sm', headerFarben.label)}>
          Kochzeit-Eskalations-Kommando
        </span>

        {/* Summary badges */}
        <div className="ml-auto flex items-center gap-1.5 flex-wrap justify-end">
          <span className="inline-flex items-center gap-1 rounded-full bg-matcha-500 text-white px-2 py-0.5 text-[10px] font-bold">
            <Clock size={9} />
            {summary.aktiv} aktiv
          </span>
          {summary.ueberfaellig > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-600 text-white px-2 py-0.5 text-[10px] font-bold animate-pulse">
              <AlertTriangle size={9} />
              {summary.ueberfaellig} überfällig
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full bg-matcha-100 text-matcha-700 dark:bg-matcha-900/50 dark:text-matcha-300 px-2 py-0.5 text-[10px] font-bold">
            {summary.puenktlich} pünktlich
          </span>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Einklappen' : 'Ausklappen'}
          className={cn(
            'ml-2 rounded-lg p-1 transition-colors hover:bg-black/10 dark:hover:bg-white/10',
            headerFarben.sub,
          )}
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Collapsible card grid                                               */}
      {/* ------------------------------------------------------------------ */}
      {expanded && (
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {sorted.map(({ order, elapsedSec, remainingSec, ratio, overdue, level, station }) => {
            const f = FARBEN[level];
            const nr = order.bestellnummer ?? order.id.slice(-6).toUpperCase();
            const itemCount = order.items?.length ?? 0;
            const itemLabel =
              order.items
                ?.slice(0, 2)
                .map((i) => {
                  const n = i.name ?? i.title ?? '?';
                  return i.quantity && i.quantity > 1 ? `${i.quantity}× ${n}` : n;
                })
                .join(', ') ?? '—';
            const elapsedMin = Math.floor(elapsedSec / 60);

            return (
              <div
                key={order.id}
                className={cn(
                  'rounded-xl border p-3 flex flex-col gap-2',
                  f.card,
                  f.border,
                  overdue && 'ring-1 ring-red-400 dark:ring-red-700',
                )}
              >
                {/* Row 1: order number + station badge */}
                <div className="flex items-center justify-between gap-1">
                  <span className={cn('text-sm font-bold truncate', f.label)}>
                    #{nr}
                  </span>
                  <span
                    className={cn(
                      'rounded-md px-1.5 py-0.5 text-[10px] font-bold shrink-0',
                      f.stationBg,
                    )}
                  >
                    {station}
                  </span>
                </div>

                {/* Row 2: items preview */}
                {itemCount > 0 && (
                  <p className={cn('text-[11px] truncate leading-tight', f.sub)}>
                    {itemLabel}
                    {itemCount > 2 && (
                      <span className="ml-1 opacity-60">+{itemCount - 2}</span>
                    )}
                  </p>
                )}

                {/* Row 3: ring + time info */}
                <div className="flex items-center gap-3">
                  <CountdownRing
                    ratio={ratio}
                    level={level}
                    remainingSec={remainingSec}
                    overdue={overdue}
                  />

                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <Clock size={10} className={f.sub} />
                      <span className={cn('text-[11px] font-medium tabular-nums', f.sub)}>
                        {fmtSec(elapsedSec)} vergangen
                      </span>
                    </div>
                    {overdue ? (
                      <div className="flex items-center gap-1">
                        <Flame size={10} className="text-red-500" />
                        <span className="text-[11px] font-bold text-red-600 dark:text-red-400 tabular-nums">
                          +{fmtSec(-remainingSec)} überfällig
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Zap size={10} className={f.sub} />
                        <span className={cn('text-[11px] tabular-nums', f.sub)}>
                          {fmtSec(remainingSec)} verbleibend
                        </span>
                      </div>
                    )}
                    {/* Progress bar */}
                    <div className="h-1 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden mt-0.5">
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{
                          width: `${Math.min(100, Math.round(ratio * 100))}%`,
                          backgroundColor: f.ringStroke,
                        }}
                      />
                    </div>
                    <span className={cn('text-[9px] tabular-nums', f.sub)}>
                      {Math.round(ratio * 100)}% — {elapsedMin} Min gelaufen
                    </span>
                  </div>
                </div>

                {/* Status badge */}
                {order.status && (
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={cn(
                        'rounded-md px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide',
                        f.badge,
                      )}
                    >
                      {order.status}
                    </span>
                    {overdue && (
                      <AlertTriangle size={12} className="text-red-500 animate-pulse shrink-0" />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

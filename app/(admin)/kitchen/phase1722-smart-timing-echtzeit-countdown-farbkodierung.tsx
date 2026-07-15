'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, ChevronDown, ChevronUp, Zap } from 'lucide-react';

/**
 * Phase 1722 — Smart-Timing-Echtzeit-Countdown-Farbkodierung (Kitchen)
 *
 * 5-stufige Farbkodierung aller aktiven Bestellungen:
 * Grün (>8 Min) → Gelb (4-8 Min) → Orange (2-4 Min) → Rot (<2 Min) → Lila (überfällig)
 * SVG-Countdown-Ring je Bestellung. 1s-Tick.
 */

interface OrderItem {
  id: string;
  name?: string | null;
}

interface Order {
  id: string;
  bestellnummer?: string | null;
  status: string;
  bestellt_am?: string | null;
  created_at?: string | null;
  geschaetzte_zubereitung_min?: number | null;
  kunde_name?: string | null;
  items?: OrderItem[] | null;
}

interface Timing {
  order_id?: string | null;
  prep_min?: number | null;
}

interface Props {
  orders: Order[];
  timings?: Timing[];
  prep_min_default?: number;
}

const ACTIVE = new Set([
  'accepted', 'confirmed', 'preparing', 'in_progress',
  'in_zubereitung', 'bestätigt', 'angenommen',
]);

const RING_R = 20;
const CIRC = 2 * Math.PI * RING_R;

type Level = 'green' | 'yellow' | 'orange' | 'red' | 'purple';

function getLevel(remainSec: number): Level {
  if (remainSec > 480) return 'green';
  if (remainSec > 240) return 'yellow';
  if (remainSec > 120) return 'orange';
  if (remainSec > 0) return 'red';
  return 'purple';
}

const LEVEL_CFG: Record<Level, { ring: string; bg: string; text: string; label: string }> = {
  green:  { ring: 'text-matcha-500',  bg: 'bg-matcha-50 dark:bg-matcha-950/20 border-matcha-200 dark:border-matcha-800',   text: 'text-matcha-700 dark:text-matcha-300',  label: 'Gut' },
  yellow: { ring: 'text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800',       text: 'text-amber-700 dark:text-amber-300',    label: 'Bald' },
  orange: { ring: 'text-orange-500',  bg: 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800',   text: 'text-orange-700 dark:text-orange-300',  label: 'Dringend' },
  red:    { ring: 'text-red-500',     bg: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',               text: 'text-red-700 dark:text-red-300',        label: 'Kritisch' },
  purple: { ring: 'text-purple-500',  bg: 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800',   text: 'text-purple-700 dark:text-purple-300',  label: 'Überfällig' },
};

function CountdownRing({ remainSec, totalSec, level }: { remainSec: number; totalSec: number; level: Level }) {
  const pct = totalSec > 0 ? Math.max(0, Math.min(1, remainSec / totalSec)) : 0;
  const dash = pct * CIRC;
  const cfg = LEVEL_CFG[level];
  const absMin = Math.abs(Math.floor(remainSec / 60));
  const absSec = Math.abs(Math.floor(remainSec % 60));

  return (
    <svg width="48" height="48" className="shrink-0">
      <circle cx="24" cy="24" r={RING_R} fill="none" strokeWidth="4"
        stroke="currentColor" className="text-muted/20" />
      <circle cx="24" cy="24" r={RING_R} fill="none" strokeWidth="4"
        stroke="currentColor" className={cfg.ring}
        strokeDasharray={`${dash} ${CIRC}`}
        strokeLinecap="round"
        transform="rotate(-90 24 24)"
        style={{ transition: 'stroke-dasharray 0.9s linear' }} />
      <text x="24" y="20" textAnchor="middle" style={{ fontSize: 9, fontWeight: 700 }}
        className={`fill-current ${cfg.text}`}>
        {remainSec < 0 ? '+' : ''}{absMin}
      </text>
      <text x="24" y="31" textAnchor="middle" style={{ fontSize: 9, fontWeight: 700 }}
        className={`fill-current ${cfg.text}`}>
        {absSec.toString().padStart(2, '0')}
      </text>
    </svg>
  );
}

export function KitchenPhase1722SmartTimingEchtzeitCountdownFarbkodierung({
  orders,
  timings = [],
  prep_min_default = 15,
}: Props) {
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    ref.current = setInterval(() => setTick(t => t + 1), 1_000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, []);

  const rows = useMemo(() => {
    const now = Date.now();
    return orders
      .filter(o => ACTIVE.has(o.status))
      .map(o => {
        const startMs = o.bestellt_am
          ? new Date(o.bestellt_am).getTime()
          : o.created_at
          ? new Date(o.created_at).getTime()
          : now;

        const timing = timings.find(t => t.order_id === o.id);
        const prepMin = timing?.prep_min ?? o.geschaetzte_zubereitung_min ?? prep_min_default;
        const totalSec = prepMin * 60;
        const deadlineMs = startMs + totalSec * 1_000;
        const remainSec = Math.floor((deadlineMs - now) / 1_000);
        const level = getLevel(remainSec);

        const label = o.bestellnummer
          ? `#${o.bestellnummer}`
          : o.kunde_name ?? o.items?.[0]?.name ?? 'Bestellung';

        return { id: o.id, label, remainSec, totalSec, level };
      })
      .sort((a, b) => a.remainSec - b.remainSec);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, timings, prep_min_default, tick]);

  if (rows.length === 0) return null;

  const urgentCount = rows.filter(r => r.level === 'red' || r.level === 'purple').length;

  return (
    <div className={cn(
      'rounded-xl border p-3 mb-3',
      urgentCount > 0
        ? 'border-red-300 dark:border-red-700 bg-red-50/30 dark:bg-red-950/10'
        : 'border-border bg-card',
    )}>
      <button onClick={() => setOpen(v => !v)} className="flex w-full items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-bold">
          <Zap className={cn('h-4 w-4', urgentCount > 0 ? 'text-red-500' : 'text-matcha-500')} />
          Echtzeit-Countdown
          {urgentCount > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-black text-white">
              {urgentCount} kritisch
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">{rows.length} aktiv</span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {rows.slice(0, 10).map(row => {
            const cfg = LEVEL_CFG[row.level];
            return (
              <div key={row.id} className={cn('flex items-center gap-3 rounded-lg border p-2', cfg.bg)}>
                <CountdownRing remainSec={row.remainSec} totalSec={row.totalSec} level={row.level} />
                <div className="min-w-0 flex-1">
                  <div className={cn('text-xs font-bold truncate', cfg.text)}>{row.label}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={cn(
                      'rounded px-1.5 py-0.5 text-[9px] font-black uppercase',
                      row.level === 'green'  && 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900/30 dark:text-matcha-300',
                      row.level === 'yellow' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
                      row.level === 'orange' && 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
                      row.level === 'red'    && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
                      row.level === 'purple' && 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
                    )}>
                      {cfg.label}
                    </span>
                    <Clock className={cn('h-3 w-3', cfg.text)} />
                    <span className={cn('text-[10px] font-mono font-bold tabular-nums', cfg.text)}>
                      {row.remainSec < 0 ? '+' : ''}
                      {Math.abs(Math.floor(row.remainSec / 60))}:{Math.abs(Math.floor(row.remainSec % 60)).toString().padStart(2, '0')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <div className="mt-2 flex items-center gap-3 flex-wrap">
          {(Object.entries(LEVEL_CFG) as [Level, typeof LEVEL_CFG[Level]][]).map(([k, v]) => {
            const cnt = rows.filter(r => r.level === k).length;
            if (cnt === 0) return null;
            return (
              <span key={k} className={cn('text-[10px] font-bold', v.text)}>
                {v.label}: {cnt}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

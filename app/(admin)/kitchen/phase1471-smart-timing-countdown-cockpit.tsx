'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, ChevronDown, ChevronUp, Zap, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';

// Phase 1471 — Smart-Timing-Countdown-Cockpit (Kitchen)
// Farbkodiertes Countdown-Grid für alle aktiven Bestellungen:
// Grün (> 8 Min) / Gelb (4-8 Min) / Orange (1-4 Min) / Rot (< 1 Min / überfällig)
// Sortiert nach Dringlichkeit; 10s-Polling; Props-basiert.

interface Order {
  id: string;
  status?: string | null;
  prep_started_at?: string | null;
  prep_duration_min?: number | null;
  customer_name?: string | null;
  bestellnummer?: number | null;
  items?: Array<{ name: string; menge: number }>;
}

interface Timing {
  order_id: string;
  started_at?: string | null;
  target_ready_at?: string | null;
  prep_min?: number | null;
}

interface Props {
  orders: Order[];
  timings?: Timing[];
}

type Farbe = 'gruen' | 'gelb' | 'orange' | 'rot';

const FARB_CFG: Record<Farbe, {
  ring: string; badge: string; badgeBg: string; border: string; bg: string; label: string;
}> = {
  gruen:  { ring: 'stroke-emerald-500', badge: 'text-emerald-700 dark:text-emerald-300', badgeBg: 'bg-emerald-100 dark:bg-emerald-900/40', border: 'border-emerald-200 dark:border-emerald-800', bg: 'bg-emerald-50/50 dark:bg-emerald-950/20', label: 'OK' },
  gelb:   { ring: 'stroke-amber-400',   badge: 'text-amber-700 dark:text-amber-300',     badgeBg: 'bg-amber-100 dark:bg-amber-900/40',     border: 'border-amber-200 dark:border-amber-800',   bg: 'bg-amber-50/50 dark:bg-amber-950/20',   label: 'Bald' },
  orange: { ring: 'stroke-orange-500',  badge: 'text-orange-700 dark:text-orange-300',   badgeBg: 'bg-orange-100 dark:bg-orange-900/40',   border: 'border-orange-200 dark:border-orange-800', bg: 'bg-orange-50/50 dark:bg-orange-950/20', label: 'Dringend' },
  rot:    { ring: 'stroke-rose-500',    badge: 'text-rose-700 dark:text-rose-300',       badgeBg: 'bg-rose-100 dark:bg-rose-900/40',       border: 'border-rose-300 dark:border-rose-700',     bg: 'bg-rose-50/50 dark:bg-rose-950/20',     label: 'Überfällig' },
};

const ACTIVE_STATUSES = new Set(['neu', 'bestätigt', 'in_zubereitung', 'confirmed', 'accepted', 'preparing']);

function getRemainMin(order: Order, timing?: Timing): number | null {
  const targetStr = timing?.target_ready_at ?? null;
  if (targetStr) {
    const diff = (new Date(targetStr).getTime() - Date.now()) / 60_000;
    return Math.round(diff);
  }
  const startStr = timing?.started_at ?? order.prep_started_at ?? null;
  const prepMin = timing?.prep_min ?? order.prep_duration_min ?? null;
  if (startStr && prepMin) {
    const endMs = new Date(startStr).getTime() + prepMin * 60_000;
    return Math.round((endMs - Date.now()) / 60_000);
  }
  return null;
}

function getFarbe(remainMin: number | null): Farbe {
  if (remainMin === null) return 'gelb';
  if (remainMin < 1) return 'rot';
  if (remainMin < 4) return 'orange';
  if (remainMin < 8) return 'gelb';
  return 'gruen';
}

function fmtCountdown(min: number): string {
  if (min < 0) return `-${Math.abs(min)}m`;
  const m = Math.floor(min);
  return `${m}m`;
}

const R = 22;
const CIRC = 2 * Math.PI * R;

export function KitchenPhase1471SmartTimingCountdownCockpit({ orders, timings = [] }: Props) {
  const [tick, setTick] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(iv);
  }, []);

  const timingMap = useMemo(() => {
    const m = new Map<string, Timing>();
    timings.forEach((t) => m.set(t.order_id, t));
    return m;
  }, [timings]);

  const rows = useMemo(() => {
    return orders
      .filter((o) => ACTIVE_STATUSES.has(o.status ?? ''))
      .map((o) => {
        const timing = timingMap.get(o.id);
        const remainMin = getRemainMin(o, timing);
        const farbe = getFarbe(remainMin);
        const prepMin = timing?.prep_min ?? o.prep_duration_min ?? 15;
        const pct = remainMin !== null
          ? Math.min(100, Math.max(0, 100 - (remainMin / prepMin) * 100))
          : 50;
        return { order: o, remainMin, farbe, pct };
      })
      .sort((a, b) => {
        const order = { rot: 0, orange: 1, gelb: 2, gruen: 3 };
        if (order[a.farbe] !== order[b.farbe]) return order[a.farbe] - order[b.farbe];
        return (a.remainMin ?? 99) - (b.remainMin ?? 99);
      });
  }, [orders, timingMap, tick]);

  const rotCount = rows.filter((r) => r.farbe === 'rot').length;
  const orangeCount = rows.filter((r) => r.farbe === 'orange').length;

  if (rows.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition"
        onClick={() => setCollapsed((c) => !c)}
      >
        <Clock className="h-4 w-4 shrink-0 text-matcha-600" />
        <span className="text-xs font-bold uppercase tracking-wider">Smart Timing Cockpit</span>
        {rotCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-100 dark:bg-rose-900/40 dark:text-rose-300 rounded-full px-2 py-0.5">
            <AlertTriangle className="h-3 w-3" />
            {rotCount} überfällig
          </span>
        )}
        {orangeCount > 0 && rotCount === 0 && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-100 dark:bg-orange-900/40 rounded-full px-2 py-0.5">
            <Zap className="h-3 w-3" />
            {orangeCount} dringend
          </span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">{rows.length} aktiv</span>
        {collapsed
          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          : <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {!collapsed && (
        <div className="p-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map(({ order, remainMin, farbe, pct }) => {
            const cfg = FARB_CFG[farbe];
            const dash = (pct / 100) * CIRC;
            return (
              <div
                key={order.id}
                className={cn(
                  'rounded-xl border p-3 flex flex-col items-center gap-2',
                  cfg.border, cfg.bg,
                )}
              >
                {/* SVG ring */}
                <div className="relative flex items-center justify-center">
                  <svg width={56} height={56}>
                    <circle cx={28} cy={28} r={R} fill="none" strokeWidth={5} className="stroke-muted" />
                    <circle
                      cx={28} cy={28} r={R} fill="none" strokeWidth={5}
                      className={cn('transition-all duration-700', cfg.ring)}
                      strokeDasharray={`${dash} ${CIRC}`}
                      strokeLinecap="round"
                      transform="rotate(-90 28 28)"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={cn('text-sm font-black tabular-nums leading-none', cfg.badge)}>
                      {remainMin !== null ? fmtCountdown(remainMin) : '?'}
                    </span>
                  </div>
                </div>

                {/* Order info */}
                <div className="w-full text-center space-y-0.5">
                  <div className="text-[10px] font-bold truncate">
                    {order.bestellnummer ? `#${order.bestellnummer}` : order.id.slice(-4)}
                  </div>
                  {order.customer_name && (
                    <div className="text-[9px] text-muted-foreground truncate">{order.customer_name}</div>
                  )}
                  <span className={cn('inline-block text-[9px] font-bold rounded-full px-1.5 py-0.5', cfg.badgeBg, cfg.badge)}>
                    {cfg.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

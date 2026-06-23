'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, Flame, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface OrderItem {
  name: string;
  menge: number;
}

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  items: OrderItem[];
}

interface Timing {
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
}

interface Props {
  orders: Order[];
  timings: Timing[];
}

type ColorBand = 'green' | 'amber' | 'red' | 'gray';

interface EnrichedOrder {
  order: Order;
  timing: Timing | undefined;
  band: ColorBand;
  remainSec: number | null;
  urgencyScore: number;
}

function getColorBand(order: Order, timing: Timing | undefined, nowMs: number): {
  band: ColorBand;
  remainSec: number | null;
  urgencyScore: number;
} {
  if (!timing) {
    return { band: 'gray', remainSec: null, urgencyScore: 9999 };
  }

  if (timing.ready_target) {
    const remainSec = Math.floor(
      (new Date(timing.ready_target).getTime() - nowMs) / 1000,
    );
    const remainMin = remainSec / 60;

    if (remainSec < 0 || remainMin < 2) {
      return { band: 'red', remainSec, urgencyScore: remainSec };
    }
    if (remainMin < 5) {
      return { band: 'amber', remainSec, urgencyScore: remainSec };
    }
    return { band: 'green', remainSec, urgencyScore: remainSec };
  }

  // Cook hasn't started yet — check if the order is recent (< 3 min old)
  if (!timing.cook_start_at && order.bestellt_am) {
    const ageMin = (nowMs - new Date(order.bestellt_am).getTime()) / 60_000;
    if (ageMin < 3) {
      return { band: 'green', remainSec: null, urgencyScore: 5000 + ageMin * 60 };
    }
  }

  return { band: 'gray', remainSec: null, urgencyScore: 9999 };
}

function fmtCountdown(remainSec: number): string {
  const abs = Math.abs(remainSec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const timeStr = `${m}:${String(s).padStart(2, '0')}`;
  return remainSec < 0 ? `+${timeStr}` : timeStr;
}

function totalItems(items: OrderItem[]): number {
  return items.reduce((acc, i) => acc + i.menge, 0);
}

const BAND_STYLES: Record<ColorBand, { card: string; timer: string; dot: string }> = {
  green: {
    card: 'bg-green-900/40 border-green-500',
    timer: 'text-green-300',
    dot: 'bg-green-500',
  },
  amber: {
    card: 'bg-amber-900/40 border-amber-500',
    timer: 'text-amber-300',
    dot: 'bg-amber-400',
  },
  red: {
    card: 'bg-red-900/40 border-red-500',
    timer: 'text-red-300',
    dot: 'bg-red-500',
  },
  gray: {
    card: 'bg-matcha-900/30 border-matcha-700',
    timer: 'text-matcha-400',
    dot: 'bg-matcha-600',
  },
};

function OrderCard({ enriched }: { enriched: EnrichedOrder }) {
  const { order, remainSec, band } = enriched;
  const styles = BAND_STYLES[band];
  const count = totalItems(order.items);
  const isOverdue = remainSec !== null && remainSec < 0;

  return (
    <div
      className={cn(
        'rounded-lg border-2 p-2.5 flex flex-col gap-1.5 transition-all',
        styles.card,
        isOverdue && 'animate-pulse',
      )}
    >
      <div className="flex items-center justify-between gap-1 min-w-0">
        <span className="font-mono text-[11px] font-black text-matcha-100 truncate shrink-0">
          #{order.bestellnummer}
        </span>
        <span className={cn('h-2 w-2 rounded-full shrink-0', styles.dot)} />
      </div>

      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] text-matcha-300 font-semibold">
          {count} {count === 1 ? 'Artikel' : 'Artikel'}
        </span>
        <div className="flex items-center gap-0.5">
          <Clock className={cn('h-2.5 w-2.5 shrink-0', styles.timer)} />
          {remainSec !== null ? (
            <span className={cn('font-mono text-[11px] font-black tabular-nums', styles.timer)}>
              {fmtCountdown(remainSec)}
            </span>
          ) : (
            <span className={cn('text-[10px] font-semibold', styles.timer)}>—</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function KitchenSmartFarbkodierungCockpit({ orders, timings }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('smart-farbkodierung-cockpit')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customer_orders' },
        () => setNow(Date.now()),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kitchen_timings' },
        () => setNow(Date.now()),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const timingMap = new Map(timings.map((t) => [t.order_id, t]));

  const activeOrders = orders.filter(
    (o) => !['geliefert', 'abgebrochen', 'storniert', 'abgeholt'].includes(o.status),
  );

  const enriched: EnrichedOrder[] = activeOrders.map((order) => {
    const timing = timingMap.get(order.id);
    const { band, remainSec, urgencyScore } = getColorBand(order, timing, now);
    return { order, timing, band, remainSec, urgencyScore };
  });

  enriched.sort((a, b) => {
    const bandPriority: Record<ColorBand, number> = { red: 0, amber: 1, green: 2, gray: 3 };
    const bandDiff = bandPriority[a.band] - bandPriority[b.band];
    if (bandDiff !== 0) return bandDiff;
    return a.urgencyScore - b.urgencyScore;
  });

  const counts = {
    green: enriched.filter((e) => e.band === 'green').length,
    amber: enriched.filter((e) => e.band === 'amber').length,
    red: enriched.filter((e) => e.band === 'red').length,
    gray: enriched.filter((e) => e.band === 'gray').length,
  };

  return (
    <div className="rounded-xl border border-matcha-700 bg-matcha-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-matcha-700 flex-wrap">
        <Flame className="h-4 w-4 text-matcha-300 shrink-0" />
        <span className="text-[11px] font-black uppercase tracking-widest text-matcha-200 flex-1">
          🎨 Farbkodierung Live
        </span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {counts.red > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 border border-red-500/50 px-2 py-0.5 text-[9px] font-black text-red-300 animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
              {counts.red}×
            </span>
          )}
          {counts.amber > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-500/50 px-2 py-0.5 text-[9px] font-black text-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
              {counts.amber}×
            </span>
          )}
          {counts.green > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-500/20 border border-green-500/50 px-2 py-0.5 text-[9px] font-black text-green-300">
              <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />
              {counts.green}×
            </span>
          )}
          {counts.gray > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-matcha-700/50 px-2 py-0.5 text-[9px] font-semibold text-matcha-400">
              {counts.gray}×
            </span>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="p-3">
        {enriched.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <CheckCircle2 className="h-6 w-6 text-matcha-500" />
            <span className="text-xs font-bold text-matcha-400">Keine aktiven Bestellungen</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {enriched.map((e) => (
              <OrderCard key={e.order.id} enriched={e} />
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      {enriched.length > 0 && (
        <div className="px-3 pb-2.5 flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1 text-[9px] text-matcha-500">
            <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
            &gt;5 Min
          </span>
          <span className="flex items-center gap-1 text-[9px] text-matcha-500">
            <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
            2–5 Min
          </span>
          <span className="flex items-center gap-1 text-[9px] text-matcha-500">
            <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
            &lt;2 Min / überfällig
          </span>
        </div>
      )}
    </div>
  );
}

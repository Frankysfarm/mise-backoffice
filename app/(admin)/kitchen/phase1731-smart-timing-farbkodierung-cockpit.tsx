'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Clock, Flame, CheckCircle2, AlertTriangle, Timer, Zap, ChefHat } from 'lucide-react';

interface OrderTiming {
  id: string;
  order_nr: string;
  status: string;
  bestellt_am: string;
  estimated_prep_min: number | null;
  items_count: number;
  zone?: string | null;
}

type TimingColor = 'green' | 'amber' | 'red' | 'blue';

function getTimingColor(elapsedMin: number, estimatedMin: number): TimingColor {
  const ratio = elapsedMin / estimatedMin;
  if (ratio < 0.6) return 'green';
  if (ratio < 0.85) return 'amber';
  if (ratio < 1.1) return 'red';
  return 'blue'; // fertig oder überfällig
}

function formatCountdown(remainSec: number): string {
  if (remainSec <= 0) return '00:00';
  const m = Math.floor(remainSec / 60);
  const s = remainSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const colorConfig: Record<TimingColor, {
  bg: string; border: string; badge: string; bar: string; text: string; label: string;
}> = {
  green: { bg: 'bg-matcha-50', border: 'border-matcha-200', badge: 'bg-matcha-500 text-white', bar: 'bg-matcha-500', text: 'text-matcha-700', label: 'Pünktlich' },
  amber: { bg: 'bg-amber-50',  border: 'border-amber-200',  badge: 'bg-amber-400 text-white',  bar: 'bg-amber-400',  text: 'text-amber-700',  label: 'Bald fertig' },
  red:   { bg: 'bg-red-50',   border: 'border-red-200',    badge: 'bg-red-500 text-white',    bar: 'bg-red-500',    text: 'text-red-700',    label: 'Dringend' },
  blue:  { bg: 'bg-blue-50',  border: 'border-blue-200',   badge: 'bg-blue-500 text-white',   bar: 'bg-blue-300',   text: 'text-blue-700',   label: 'Überzogen' },
};

const MOCK_ORDERS: OrderTiming[] = [
  { id: '1', order_nr: '#1042', status: 'in_zubereitung', bestellt_am: new Date(Date.now() - 8 * 60000).toISOString(), estimated_prep_min: 18, items_count: 3, zone: 'A' },
  { id: '2', order_nr: '#1043', status: 'in_zubereitung', bestellt_am: new Date(Date.now() - 15 * 60000).toISOString(), estimated_prep_min: 18, items_count: 5, zone: 'B' },
  { id: '3', order_nr: '#1044', status: 'in_zubereitung', bestellt_am: new Date(Date.now() - 20 * 60000).toISOString(), estimated_prep_min: 18, items_count: 2, zone: 'A' },
  { id: '4', order_nr: '#1045', status: 'neu',            bestellt_am: new Date(Date.now() - 2 * 60000).toISOString(),  estimated_prep_min: 18, items_count: 4, zone: 'C' },
];

export function KitchenPhase1731SmartTimingFarbkodierungCockpit({
  locationId,
}: {
  locationId?: string | null;
}) {
  const [orders, setOrders] = useState<OrderTiming[]>([]);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    if (!locationId) {
      setOrders(MOCK_ORDERS);
      setLoading(false);
      return;
    }
    try {
      const sb = createClient();
      const { data } = await sb
        .from('customer_orders')
        .select('id, order_nr, status, bestellt_am, estimated_prep_min, items:order_items(id)')
        .in('status', ['neu', 'bestätigt', 'in_zubereitung'])
        .order('bestellt_am', { ascending: true })
        .limit(20);
      if (data) {
        setOrders(data.map((o: any) => ({
          ...o,
          items_count: Array.isArray(o.items) ? o.items.length : 0,
          estimated_prep_min: o.estimated_prep_min ?? 18,
        })));
      }
    } catch {
      setOrders(MOCK_ORDERS);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 30000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  // Tick every second for countdown
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();

  const rows = orders.map((o) => {
    const elapsedMs = now - new Date(o.bestellt_am).getTime();
    const elapsedMin = elapsedMs / 60000;
    const estMin = o.estimated_prep_min ?? 18;
    const remainSec = Math.round((estMin * 60) - (elapsedMs / 1000));
    const color = getTimingColor(elapsedMin, estMin);
    const pct = Math.min(100, Math.round((elapsedMin / estMin) * 100));
    return { ...o, elapsedMin, remainSec, color, pct, estMin };
  });

  // Counters
  const counts = { green: 0, amber: 0, red: 0, blue: 0 };
  rows.forEach((r) => { counts[r.color]++; });

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3 animate-pulse">
        <div className="h-4 w-48 bg-stone-100 rounded" />
        {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-stone-100 rounded-xl" />)}
      </div>
    );
  }

  if (rows.length === 0) return null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-100 bg-stone-50">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-matcha-600 text-white">
          <ChefHat className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-foreground">Smart Timing · Farbkodierung</div>
          <div className="text-[10px] text-muted-foreground">{rows.length} Bestellungen aktiv</div>
        </div>
        {/* Color legend */}
        <div className="flex gap-2 shrink-0">
          {(Object.entries(counts) as [TimingColor, number][]).filter(([, n]) => n > 0).map(([color, n]) => (
            <span key={color} className={cn('text-[9px] font-black px-2 py-0.5 rounded-full', colorConfig[color].badge)}>
              {n}
            </span>
          ))}
        </div>
      </div>

      {/* Order rows */}
      <div className="divide-y divide-stone-100">
        {rows.map((row) => {
          const cfg = colorConfig[row.color];
          const isOverdue = row.remainSec <= 0;
          return (
            <div key={row.id} className={cn('px-4 py-3', cfg.bg)}>
              <div className="flex items-center gap-3">
                {/* Status icon */}
                <div className={cn('shrink-0 w-8 h-8 rounded-full flex items-center justify-center', cfg.badge)}>
                  {row.color === 'green' ? <Zap className="h-3.5 w-3.5" /> :
                   row.color === 'amber' ? <Flame className="h-3.5 w-3.5" /> :
                   row.color === 'red'   ? <AlertTriangle className="h-3.5 w-3.5" /> :
                                          <CheckCircle2 className="h-3.5 w-3.5" />}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold">{row.order_nr}</span>
                    {row.zone && (
                      <span className="text-[9px] border border-current rounded-full px-1.5 font-bold opacity-70">
                        Zone {row.zone}
                      </span>
                    )}
                    <span className={cn('text-[9px] font-bold', cfg.text)}>{cfg.label}</span>
                    <span className="text-[9px] text-muted-foreground">{row.items_count} Pos.</span>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-1.5 h-1.5 rounded-full bg-black/10 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-1000', cfg.bar)}
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                </div>

                {/* Countdown */}
                <div className="shrink-0 text-right">
                  <div className={cn(
                    'font-mono text-sm font-black tabular-nums',
                    isOverdue ? 'text-blue-600 animate-pulse' : cfg.text,
                  )}>
                    {isOverdue ? '+' : ''}{isOverdue
                      ? formatCountdown(Math.abs(row.remainSec))
                      : formatCountdown(row.remainSec)}
                  </div>
                  <div className="text-[8px] text-muted-foreground">
                    {isOverdue ? 'überfällig' : 'verbleibend'}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary bar */}
      <div className="px-4 py-2.5 border-t border-stone-100 bg-stone-50 flex items-center gap-4">
        <Timer className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
          <span>Ø Elapsed: {rows.length > 0 ? (rows.reduce((s, r) => s + r.elapsedMin, 0) / rows.length).toFixed(0) : 0} Min</span>
          <span className="text-matcha-600 font-bold">{counts.green} pünktlich</span>
          {counts.red > 0 && <span className="text-red-600 font-bold">{counts.red} dringend</span>}
        </div>
        <div className="ml-auto flex items-center gap-1 text-[9px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          Echtzeit
        </div>
      </div>
    </div>
  );
}

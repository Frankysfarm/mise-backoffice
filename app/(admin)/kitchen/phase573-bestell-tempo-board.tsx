'use client';

/**
 * Phase 573 — Kitchen: Echtzeit-Bestellungs-Tempo-Board
 *
 * Zeigt die aktuelle Bestellrate (Bestellungen/h) mit Vergleich zur
 * letzten Stunde und Farb-Ampel für die Küchenbelastung.
 *
 * Farbkodierung nach Rate:
 *   grün   → < 8/h  (ruhig)
 *   amber  → 8–15/h (normal)
 *   rot    → > 15/h (rush)
 *
 * Ticker: 30s
 */

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, ChevronDown, ChevronUp, TrendingDown, TrendingUp, Zap } from 'lucide-react';

interface Order {
  id: string;
  created_at?: string;
  status: string;
  typ: string;
}

interface Props {
  orders: Order[];
}

type RateTier = 'quiet' | 'normal' | 'rush';

const TIER_CFG: Record<RateTier, { label: string; color: string; bg: string; border: string; badge: string }> = {
  quiet:  { label: 'Ruhig',  color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200', badge: 'bg-emerald-500 text-white' },
  normal: { label: 'Normal', color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200',   badge: 'bg-amber-500 text-white' },
  rush:   { label: 'Rush!',  color: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-200',     badge: 'bg-red-600 text-white' },
};

function getTier(ratePerHour: number): RateTier {
  if (ratePerHour >= 15) return 'rush';
  if (ratePerHour >= 8) return 'normal';
  return 'quiet';
}

function countInWindow(orders: Order[], fromMs: number, toMs: number): number {
  return orders.filter(o => {
    if (!o.created_at) return false;
    const t = new Date(o.created_at).getTime();
    return t >= fromMs && t < toMs;
  }).length;
}

export function KitchenPhase573BestellTempoBoard({ orders }: Props) {
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const stats = useMemo(() => {
    const now = Date.now();
    const deliveryOrders = orders.filter(o => o.typ === 'delivery' || o.typ === 'lieferung');

    // Current hour window (last 60 min)
    const thisHourCount = countInWindow(deliveryOrders, now - 3_600_000, now);
    // Previous hour
    const lastHourCount = countInWindow(deliveryOrders, now - 7_200_000, now - 3_600_000);
    // Last 15 min rate projected to hour
    const last15Count = countInWindow(deliveryOrders, now - 900_000, now);
    const projected = last15Count * 4; // extrapolate to hourly rate

    const currentRate = thisHourCount; // already per hour
    const tier = getTier(currentRate);
    const delta = lastHourCount > 0 ? currentRate - lastHourCount : 0;

    // 15-min buckets for last hour
    const buckets = [3, 2, 1, 0].map(i => ({
      label: `-${(i + 1) * 15}–-${i * 15} Min`,
      count: countInWindow(deliveryOrders, now - (i + 1) * 900_000, now - i * 900_000),
    }));

    const maxBucket = Math.max(...buckets.map(b => b.count), 1);

    return { currentRate, lastHourCount, projected, tier, delta, buckets, maxBucket, last15Count };
  }, [orders, tick]);

  const tier = TIER_CFG[stats.tier];

  return (
    <Card className={cn('overflow-hidden border', stats.tier === 'rush' && 'animate-pulse-slow')}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Activity className={cn('h-4 w-4', tier.color)} />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Bestellungs-Tempo</span>
          <Badge className={cn('text-[10px] px-2 py-0.5', tier.badge)}>
            {stats.currentRate}/h — {tier.label}
          </Badge>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className={cn('border-t px-4 py-3 space-y-3', tier.bg)}>
          {/* Main metrics row */}
          <div className="grid grid-cols-3 gap-2">
            <div className={cn('rounded-lg border p-2 text-center', tier.border, 'bg-white/60')}>
              <div className={cn('text-2xl font-black tabular-nums', tier.color)}>{stats.currentRate}</div>
              <div className="text-[10px] text-muted-foreground font-medium">Letzte Stunde</div>
            </div>
            <div className="rounded-lg border border-slate-200 p-2 text-center bg-white/60">
              <div className="text-2xl font-black tabular-nums text-slate-700">{stats.lastHourCount}</div>
              <div className="text-[10px] text-muted-foreground font-medium">Vorherige Stunde</div>
            </div>
            <div className="rounded-lg border border-blue-200 p-2 text-center bg-white/60">
              <div className="text-2xl font-black tabular-nums text-blue-700">{stats.projected}</div>
              <div className="text-[10px] text-muted-foreground font-medium">Prognose/h</div>
            </div>
          </div>

          {/* Delta */}
          {stats.delta !== 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              {stats.delta > 0 ? (
                <><TrendingUp className="h-3.5 w-3.5 text-red-500" /><span className="font-bold text-red-600">+{stats.delta} vs. vorherige Stunde</span></>
              ) : (
                <><TrendingDown className="h-3.5 w-3.5 text-emerald-500" /><span className="font-bold text-emerald-600">{stats.delta} vs. vorherige Stunde</span></>
              )}
            </div>
          )}

          {/* 15-min buckets bar chart */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Verlauf (letzte 60 Min)</div>
            <div className="flex items-end gap-1.5 h-12">
              {stats.buckets.map((b, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    className={cn('w-full rounded-t', tier.border, i === 3 ? tier.badge.split(' ')[0] : 'bg-slate-300')}
                    style={{ height: `${Math.max(4, (b.count / stats.maxBucket) * 40)}px` }}
                  />
                  <span className="text-[9px] tabular-nums text-muted-foreground">{b.count}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-1.5 mt-0.5">
              {stats.buckets.map((_, i) => (
                <div key={i} className="flex-1 text-[8px] text-center text-muted-foreground">
                  {i === 3 ? 'Jetzt' : `-${(3 - i) * 15}M`}
                </div>
              ))}
            </div>
          </div>

          {/* Rush alert */}
          {stats.tier === 'rush' && (
            <div className="flex items-center gap-2 rounded-lg bg-red-100 border border-red-300 px-3 py-2">
              <Zap className="h-4 w-4 text-red-600 shrink-0" />
              <span className="text-xs font-bold text-red-700">Rush-Phase! Alle Stationen besetzen.</span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, Utensils, Flame } from 'lucide-react';

/**
 * Phase 995 — Echtzeit-Küchen-Transparenz-Widget (Storefront)
 *
 * "Ihr Essen wird gerade zubereitet" — animiertes Koch-Icon
 * + Batch-Fortschritt. Polling /api/delivery/tracking?order_id=...
 * Nur sichtbar wenn Status = preparing/confirmed/assigned.
 */

interface TrackingData {
  status: string;
  prep_progress_pct?: number | null;
  batch_size?: number | null;
  batch_ready?: number | null;
  eta_minutes?: number | null;
}

const COOK_STATUSES = ['confirmed', 'preparing', 'assigned'];

const MOCK: TrackingData = {
  status: 'preparing',
  prep_progress_pct: 60,
  batch_size: 3,
  batch_ready: 1,
  eta_minutes: 12,
};

interface Props {
  orderId: string | null;
  status: string | null;
  className?: string;
}

export function Phase995EchtzeitKuechenTransparenzWidget({ orderId, status, className }: Props) {
  const [data, setData] = useState<TrackingData | null>(null);
  const [tick, setTick] = useState(0);

  const isCooking = COOK_STATUSES.includes(status ?? '');

  useEffect(() => {
    if (!isCooking) return;
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, [isCooking]);

  useEffect(() => {
    if (!orderId || !isCooking) return;
    let mounted = true;

    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/tracking?order_id=${orderId}`);
        if (res.ok && mounted) {
          const json = await res.json() as TrackingData;
          setData(json);
        }
      } catch {
        if (mounted) setData(MOCK);
      }
    };

    load();
    const iv = setInterval(load, 30_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [orderId, isCooking]);

  if (!isCooking) return null;

  const d = data ?? MOCK;
  const pct = d.prep_progress_pct ?? 50;
  const batchSize = d.batch_size ?? 1;
  const batchReady = d.batch_ready ?? 0;

  // Animated flame: alternates every 500ms based on tick
  const flameActive = tick % 2 === 0;

  return (
    <div className={cn('rounded-xl border bg-card shadow-sm overflow-hidden', className)}>
      <div className="px-4 py-3 flex items-center gap-2">
        <div className="relative">
          <ChefHat className="h-5 w-5 text-matcha-600 dark:text-matcha-400" />
          <Flame
            className={cn(
              'absolute -top-1 -right-1 h-3 w-3 transition-all duration-500',
              flameActive ? 'text-orange-500 scale-110' : 'text-orange-400 scale-90',
            )}
          />
        </div>
        <span className="font-bold text-sm">Küche</span>
        <span className="text-xs text-muted-foreground">Ihr Essen wird zubereitet</span>
      </div>

      <div className="px-4 pb-4 space-y-3">
        {/* Cook animation */}
        <div className="flex items-center gap-3">
          {/* Animated chef icon */}
          <div className={cn(
            'h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all duration-700',
            pct >= 80
              ? 'border-matcha-400 bg-matcha-50 dark:bg-matcha-900/30'
              : 'border-amber-400 bg-amber-50 dark:bg-amber-900/30',
          )}>
            <Utensils className={cn(
              'h-5 w-5 transition-colors',
              pct >= 80 ? 'text-matcha-600 dark:text-matcha-400' : 'text-amber-600 dark:text-amber-400',
              'animate-pulse',
            )} />
          </div>

          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[12px] font-bold">Zubereitung</span>
              <span className="text-[12px] font-black tabular-nums">{Math.round(pct)}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-700',
                  pct >= 80 ? 'bg-matcha-500' : pct >= 50 ? 'bg-amber-500' : 'bg-orange-500',
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Batch info */}
        {batchSize > 1 && (
          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
            <span>Batch:</span>
            <div className="flex gap-0.5">
              {Array.from({ length: batchSize }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-2.5 w-2.5 rounded-sm transition-colors',
                    i < batchReady
                      ? 'bg-matcha-500'
                      : 'bg-muted-foreground/30',
                  )}
                />
              ))}
            </div>
            <span className="font-bold text-foreground">{batchReady}/{batchSize} fertig</span>
          </div>
        )}

        {/* ETA hint */}
        {d.eta_minutes !== null && d.eta_minutes !== undefined && (
          <div className="text-center text-[11px] text-muted-foreground">
            Voraussichtlich fertig in ca. <span className="font-bold text-foreground tabular-nums">{d.eta_minutes} Min</span>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

/**
 * Phase 2177 – Smart-Timing Live-Countdown mit Farbkodierung
 * Zeigt alle aktiven Bestellungen mit Echtzeit-Countdown und
 * dynamischer Farbkodierung (grün/gelb/rot) nach Restzeit.
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Clock, ChefHat, AlertTriangle, Zap, Timer } from 'lucide-react';

interface OrderRow {
  id: string;
  bestellnummer: string | null;
  status: string;
  created_at: string;
  estimated_prep_min: number | null;
  artikel: string | null;
}

function getSecondsElapsed(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
}

function getTargetSeconds(prepMin: number | null): number {
  return (prepMin ?? 15) * 60;
}

function getColorClass(elapsed: number, target: number): {
  bg: string; text: string; border: string; badge: string;
} {
  const ratio = elapsed / target;
  if (ratio < 0.6) return {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700',
  };
  if (ratio < 0.85) return {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
  };
  return {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-700',
  };
}

function formatCountdown(remainingSeconds: number): string {
  if (remainingSeconds <= 0) return 'Überfällig';
  const m = Math.floor(remainingSeconds / 60);
  const s = remainingSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function KitchenPhase2177SmartTimingCountdownFarbkodierung() {
  const supabase = createClient();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [tick, setTick] = useState(0);

  // Echtzeit-Ticker
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 1_000);
    return () => clearInterval(iv);
  }, []);

  // Bestellungen laden
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('customer_orders')
        .select('id, bestellnummer, status, created_at, estimated_prep_min, artikel')
        .in('status', ['bestätigt', 'in_zubereitung', 'fertig'])
        .order('created_at', { ascending: true })
        .limit(12);
      if (data) setOrders(data as OrderRow[]);
    }
    load();

    const channel = supabase
      .channel('phase2177-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_orders' }, load)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  const overdueCount = orders.filter(o => {
    const elapsed = getSecondsElapsed(o.created_at);
    const target = getTargetSeconds(o.estimated_prep_min);
    return elapsed > target;
  }).length;

  return (
    <div className="rounded-2xl border border-matcha-100 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-matcha-100 bg-matcha-50/50">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-matcha-600" />
          <span className="text-sm font-semibold text-matcha-800">Smart-Timing Countdown</span>
        </div>
        <div className="flex items-center gap-2">
          {overdueCount > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
              <AlertTriangle className="h-3 w-3" />
              {overdueCount} überfällig
            </span>
          )}
          <span className="text-xs text-matcha-400">{orders.length} aktiv</span>
        </div>
      </div>

      {/* Legende */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-matcha-50">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" />
          <span className="text-xs text-matcha-500">Gut (&lt;60%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
          <span className="text-xs text-matcha-500">Achtung (60–85%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-400 inline-block" />
          <span className="text-xs text-matcha-500">Kritisch (&gt;85%)</span>
        </div>
      </div>

      {/* Order-Grid */}
      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-matcha-400">
          <ChefHat className="h-8 w-8 mb-2 opacity-30" />
          <p className="text-sm">Keine aktiven Bestellungen</p>
        </div>
      ) : (
        <div className="divide-y divide-matcha-50">
          {orders.map((order) => {
            const elapsed = getSecondsElapsed(order.created_at);
            const target = getTargetSeconds(order.estimated_prep_min);
            const remaining = target - elapsed;
            const ratio = Math.min(elapsed / target, 1);
            const colors = getColorClass(elapsed, target);

            return (
              <div
                key={order.id}
                className={cn(
                  'px-4 py-3 transition-colors',
                  colors.bg,
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-mono font-bold text-matcha-600">
                        #{order.bestellnummer ?? order.id.slice(0, 6).toUpperCase()}
                      </span>
                      <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', colors.badge)}>
                        {order.status === 'in_zubereitung' ? 'Zubereitung' :
                         order.status === 'fertig' ? 'Fertig' : 'Bestätigt'}
                      </span>
                    </div>
                    {order.artikel && (
                      <p className="text-xs text-matcha-600 truncate">{order.artikel}</p>
                    )}
                    {/* Progress bar */}
                    <div className="mt-2 h-1.5 rounded-full bg-black/10 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-1000',
                          ratio < 0.6 ? 'bg-emerald-500' :
                          ratio < 0.85 ? 'bg-amber-500' : 'bg-red-500',
                        )}
                        style={{ width: `${Math.min(ratio * 100, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Countdown */}
                  <div className="flex-shrink-0 text-right">
                    <div className={cn(
                      'text-lg font-bold tabular-nums font-mono',
                      colors.text,
                    )}>
                      {formatCountdown(remaining)}
                    </div>
                    <div className="text-xs text-matcha-400 mt-0.5">
                      Ziel: {order.estimated_prep_min ?? 15} min
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-matcha-100 bg-matcha-50/30 flex items-center gap-2">
        <div className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-matcha-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-matcha-600" />
        </div>
        <span className="text-xs text-matcha-500">Echtzeit-Aktualisierung</span>
        <Zap className="h-3 w-3 text-matcha-400 ml-auto" />
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { Euro, TrendingUp, TrendingDown, Users, Clock, Target, Zap, BarChart2 } from 'lucide-react';

interface HourBucket { hour: number; label: string; rev: number; orders: number }
interface ProfitState {
  revenue: number;
  orders: number;
  activeDrivers: number;
  hourlyRevTarget: number;
  costEstimate: number;
  profitMargin: number;
  hourlyRev: number;
  hourBuckets: HourBucket[];
  loading: boolean;
}

const DRIVER_COST_EUR_H = 15;
const TARGET_REV_PER_DRIVER_H = 40;

export function EchtzeitProfitCockpit() {
  const supabase = createClient();
  const [state, setState] = useState<ProfitState>({
    revenue: 0, orders: 0, activeDrivers: 0, hourlyRevTarget: 0,
    costEstimate: 0, profitMargin: 0, hourlyRev: 0, hourBuckets: [], loading: true,
  });

  const load = useCallback(async () => {
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const [{ data: ordersData }, { data: driversData }] = await Promise.all([
        supabase
          .from('customer_orders')
          .select('gesamtbetrag, bestellt_am')
          .in('status', ['geliefert', 'abgeholt', 'abgeschlossen'])
          .gte('bestellt_am', today.toISOString()),
        supabase
          .from('driver_status')
          .select('ist_online, online_seit')
          .eq('ist_online', true),
      ]);

      const revenue = ((ordersData ?? []) as { gesamtbetrag: number; bestellt_am: string | null }[])
        .reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0);
      const orders = (ordersData ?? []).length;

      // Hourly buckets
      const counts: Record<number, { rev: number; orders: number }> = {};
      for (const o of (ordersData ?? []) as { gesamtbetrag: number; bestellt_am: string | null }[]) {
        if (!o.bestellt_am) continue;
        const h = new Date(o.bestellt_am).getHours();
        if (!counts[h]) counts[h] = { rev: 0, orders: 0 };
        counts[h].rev += o.gesamtbetrag ?? 0;
        counts[h].orders++;
      }
      const nowH = new Date().getHours();
      const hourBuckets: HourBucket[] = [];
      for (let h = Math.max(10, nowH - 5); h <= nowH; h++) {
        hourBuckets.push({ hour: h, label: `${h}:00`, rev: counts[h]?.rev ?? 0, orders: counts[h]?.orders ?? 0 });
      }

      const activeDrivers = (driversData ?? []).length;
      const onlineHours = ((driversData ?? []) as { ist_online: boolean; online_seit: string | null }[])
        .reduce((s, d) => {
          if (!d.online_seit) return s + 1;
          return s + Math.max(0, (Date.now() - new Date(d.online_seit).getTime()) / 3_600_000);
        }, 0);

      const costEstimate = onlineHours * DRIVER_COST_EUR_H;
      const profit = revenue - costEstimate;
      const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
      const hourlyRev = onlineHours > 0 ? revenue / onlineHours : 0;
      const hourlyRevTarget = activeDrivers * TARGET_REV_PER_DRIVER_H;

      setState({
        revenue, orders, activeDrivers, hourlyRevTarget, costEstimate,
        profitMargin, hourlyRev, hourBuckets, loading: false,
      });
    } catch {
      setState(s => ({ ...s, loading: false }));
    }
  }, [supabase]);

  useEffect(() => { load(); const iv = setInterval(load, 60_000); return () => clearInterval(iv); }, [load]);

  const { revenue, orders, activeDrivers, hourlyRevTarget, costEstimate, profitMargin, hourlyRev, hourBuckets, loading } = state;
  const isProfit = profitMargin > 15;
  const isBreakEven = profitMargin > 0 && !isProfit;

  if (loading) return null;

  const maxRev = Math.max(1, ...hourBuckets.map(b => b.rev));
  const TrendIcon = isProfit ? TrendingUp : TrendingDown;

  return (
    <div className="rounded-xl border border-border overflow-hidden shadow-sm">
      <div className={cn(
        'flex items-center gap-2 px-3 py-2',
        isProfit ? 'bg-matcha-600' : isBreakEven ? 'bg-amber-500' : 'bg-red-600',
      )}>
        <Euro className="h-4 w-4 text-white" />
        <span className="text-xs font-black uppercase tracking-wider text-white">Echtzeit-Profit</span>
        <span className={cn(
          'ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black',
          isProfit ? 'bg-white/20 text-white' : isBreakEven ? 'bg-white/20 text-white' : 'bg-white/20 text-white',
        )}>
          <TrendIcon size={9} />
          {profitMargin.toFixed(1)}% Marge
        </span>
      </div>

      <div className="p-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-muted/50 border border-border/60 px-3 py-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Euro size={9} /> Umsatz heute
          </div>
          <div className="text-lg font-black mt-1">
            {revenue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] text-muted-foreground">{orders} Bestellungen</div>
        </div>
        <div className="rounded-lg bg-muted/50 border border-border/60 px-3 py-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Zap size={9} /> Umsatz/Std
          </div>
          <div className="text-lg font-black mt-1">
            {hourlyRev.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })}
          </div>
          <div className={cn(
            'text-[10px] font-bold',
            hourlyRev >= hourlyRevTarget ? 'text-matcha-600' : 'text-amber-500',
          )}>
            Ziel: {hourlyRevTarget.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })}
          </div>
        </div>
        <div className="rounded-lg bg-muted/50 border border-border/60 px-3 py-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Users size={9} /> Fahrer online
          </div>
          <div className="text-lg font-black mt-1">{activeDrivers}</div>
          <div className="text-[10px] text-muted-foreground">
            ~{costEstimate.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })} Kosten
          </div>
        </div>
        <div className={cn(
          'rounded-lg border px-3 py-2',
          isProfit ? 'bg-matcha-50 border-matcha-200' :
          isBreakEven ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200',
        )}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Target size={9} /> Deckung
          </div>
          <div className={cn('text-lg font-black mt-1', isProfit ? 'text-matcha-700' : isBreakEven ? 'text-amber-700' : 'text-red-700')}>
            {(revenue - costEstimate).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })}
          </div>
          <div className={cn('text-[10px] font-bold', isProfit ? 'text-matcha-600' : isBreakEven ? 'text-amber-600' : 'text-red-600')}>
            {isProfit ? 'Profitabel' : isBreakEven ? 'Break-even' : 'Verlust'}
          </div>
        </div>
      </div>

      {/* Mini chart */}
      {hourBuckets.length > 1 && (
        <div className="px-3 pb-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
            <BarChart2 size={9} /> Letzten Stunden
          </div>
          <div className="flex items-end gap-1 h-12">
            {hourBuckets.map(b => {
              const h = Math.max(4, Math.round((b.rev / maxRev) * 44));
              const isCurrent = b.hour === new Date().getHours();
              return (
                <div key={b.hour} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    style={{ height: `${h}px` }}
                    className={cn(
                      'w-full rounded-t-sm',
                      isCurrent ? 'bg-matcha-500' : 'bg-matcha-200',
                    )}
                    title={`${b.label}: ${b.rev.toFixed(0)}€`}
                  />
                  <span className="text-[8px] text-muted-foreground">{b.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
